import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import { APP_MODE, auth as fbAuth, SESSION_TIMEOUT_MIN } from '../config/firebase';
import { demoUsers } from '../data/demoBackend';
import { fetchProfile } from '../data/firestoreBackend';
import { DEMO_PASSWORD } from '../data/seed';
import { hashPassword } from '../lib/utils';
import { roleLabel } from '../lib/roles';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const SESSION_KEY = 'kvce.session';
const LOCK_KEY = 'kvce.lock.';
const TIMEOUT_MS = SESSION_TIMEOUT_MIN * 60_000;
const readDemoSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeDemoSession = (s) => {
  const store = s.remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(s));
};
/** Removes user-specific cached data from the browser (not the demo database itself). */
function clearUserCaches() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.clear();
    Object.keys(localStorage)
      .filter((k) => k.startsWith('kvce.user.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
function friendlyFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact the IT Administrator.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [lastSignOut, setLastSignOut] = useState(null);
  const [signInEvent, setSignInEvent] = useState(0);
  const lastActive = useRef(Date.now());
  const signOut = useCallback(async (reason = 'user') => {
    if (APP_MODE === 'firebase') {
      try {
        await fbSignOut(fbAuth);
      } catch {
        /* ignore */
      }
    }
    clearUserCaches();
    setUser(null);
    setStatus('signedOut');
    setLastSignOut(reason);
  }, []);
  // ---- restore session ----
  useEffect(() => {
    if (APP_MODE === 'firebase') {
      return onAuthStateChanged(fbAuth, async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setStatus('signedOut');
          return;
        }
        try {
          const profile = await fetchProfile(fbUser.uid);
          if (!profile || !profile.active) {
            await signOut('unauthorized');
            return;
          }
          lastActive.current = Date.now();
          setUser(profile);
          setStatus('signedIn');
        } catch {
          await signOut('unauthorized');
        }
      });
    }
    (async () => {
      const s = readDemoSession();
      if (!s) {
        setStatus('signedOut');
        return;
      }
      if (s.expiresAt < Date.now()) {
        clearUserCaches();
        setStatus('signedOut');
        setLastSignOut('expired');
        return;
      }
      const u = (await demoUsers()).find((x) => x.id === s.userId && x.active);
      if (!u) {
        clearUserCaches();
        setStatus('signedOut');
        return;
      }
      setUser(u);
      setStatus('signedIn');
    })();
  }, [signOut]);
  // ---- idle session expiry ----
  useEffect(() => {
    if (status !== 'signedIn') return;
    let lastWrite = 0;
    const touch = () => {
      lastActive.current = Date.now();
      if (APP_MODE === 'demo' && Date.now() - lastWrite > 30_000) {
        lastWrite = Date.now();
        const s = readDemoSession();
        if (s) writeDemoSession({ ...s, expiresAt: Date.now() + TIMEOUT_MS });
      }
    };
    const evs = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      if (Date.now() - lastActive.current > TIMEOUT_MS) signOut('expired');
    }, 15_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(iv);
    };
  }, [status, signOut]);
  // ---- protect against bfcache restoring a private page after sign-out ----
  useEffect(() => {
    const onShow = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  /** expectedRole (optional): the role chosen on the Sign In page; sign-in is refused if the account has a different role. */
  const signIn = useCallback(async (email, password, remember, expectedRole) => {
    const em = email.trim().toLowerCase();
    if (APP_MODE === 'firebase') {
      try {
        await setPersistence(fbAuth, remember ? browserLocalPersistence : browserSessionPersistence);
        const cred = await signInWithEmailAndPassword(fbAuth, em, password);
        const profile = await fetchProfile(cred.user.uid);
        if (!profile || !profile.active) {
          await fbSignOut(fbAuth);
          throw new Error('Your account is not authorised for the ERP. Contact the IT Administrator.');
        }
        if (expectedRole && profile.role !== expectedRole) {
          await fbSignOut(fbAuth);
          throw new Error(`This account is not registered as ${roleLabel(expectedRole)}. Choose the correct role or “Any role”.`);
        }
        lastActive.current = Date.now();
        setUser(profile);
        setStatus('signedIn');
        setLastSignOut(null);
        setSignInEvent(Date.now());
        return profile;
      } catch (e) {
        throw new Error(e?.code ? friendlyFirebaseError(e.code) : (e?.message ?? 'Sign in failed.'));
      }
    }
    // DEMO: verify PBKDF2 hash; lock out after 5 failures for 5 minutes.
    const lockRaw = localStorage.getItem(LOCK_KEY + em);
    const lock = lockRaw ? JSON.parse(lockRaw) : { n: 0, until: 0 };
    if (lock.until > Date.now())
      throw new Error(`Too many failed attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 60000)} minute(s).`);
    const users = await demoUsers();
    const u = users.find((x) => x.email.toLowerCase() === em);
    const ok = !!u && !!u.salt && (await hashPassword(password, u.salt)) === u.passwordHash;
    if (!ok) {
      const n = lock.n + 1;
      localStorage.setItem(LOCK_KEY + em, JSON.stringify({ n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 }));
      throw new Error('Invalid email or password.');
    }
    if (!u.active) throw new Error('This account has been deactivated. Contact the IT Administrator.');
    if (expectedRole && u.role !== expectedRole)
      throw new Error(`This account is not registered as ${roleLabel(expectedRole)}. Choose the correct role or “Any role”.`);
    localStorage.removeItem(LOCK_KEY + em);
    writeDemoSession({ userId: u.id, expiresAt: Date.now() + TIMEOUT_MS, remember });
    lastActive.current = Date.now();
    setUser(u);
    setStatus('signedIn');
    setLastSignOut(null);
    setSignInEvent(Date.now());
    return u;
  }, []);
  /** Social sign-in (Google / Microsoft / Apple) through Firebase. The account must already have an ERP profile. */
  const signInWithProvider = useCallback(async (name, remember) => {
    if (APP_MODE !== 'firebase')
      throw new Error('Social sign-in is available once Firebase is configured. In demo mode, use a demo account.');
    const provider = name === 'google' ? new GoogleAuthProvider() : new OAuthProvider(name === 'microsoft' ? 'microsoft.com' : 'apple.com');
    try {
      await setPersistence(fbAuth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithPopup(fbAuth, provider);
      const profile = await fetchProfile(cred.user.uid);
      if (!profile || !profile.active) {
        await fbSignOut(fbAuth);
        throw new Error('This account is not registered in the ERP. Contact the IT Administrator.');
      }
      lastActive.current = Date.now();
      setUser(profile);
      setStatus('signedIn');
      setLastSignOut(null);
      setSignInEvent(Date.now());
      return profile;
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user') throw new Error('Sign-in window was closed.');
      if (e?.code === 'auth/operation-not-allowed') throw new Error('This sign-in method is not enabled for the institution.');
      throw new Error(e?.code ? friendlyFirebaseError(e.code) : (e?.message ?? 'Sign in failed.'));
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    const em = email.trim().toLowerCase();
    if (APP_MODE === 'firebase') {
      try {
        await sendPasswordResetEmail(fbAuth, em);
      } catch (e) {
        if (e?.code === 'auth/invalid-email') throw new Error('Please enter a valid email address.');
        if (e?.code === 'auth/network-request-failed') throw new Error('Network error. Please try again.');
        // Don't reveal whether an account exists.
      }
      return 'If an account exists for this email, a password reset link has been sent.';
    }
    return `Demo mode: no email is sent. Demo accounts use the password "${DEMO_PASSWORD}". In production, Firebase sends a secure reset link.`;
  }, []);
  return (
    <Ctx.Provider
      value={{
        status,
        user,
        mode: APP_MODE,
        lastSignOut,
        signInEvent,
        signIn,
        signInWithProvider,
        signOut,
        resetPassword,
        clearSignOutReason: () => setLastSignOut(null),
        refreshProfile: (u) => setUser(u),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
