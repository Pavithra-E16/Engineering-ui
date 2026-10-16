import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ROLES } from '../lib/roles';
import { DEMO_DOMAIN, DEMO_PASSWORD } from '../data/seed';
import { Alert } from '../components/ui';
import { AuthShell } from './AuthShell';

export default function LoginPage() {
  const { signIn, mode, lastSignOut, clearSignOutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('kvce.rememberEmail') ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('kvce.rememberEmail'));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice] = useState(lastSignOut);

  useEffect(() => {
    document.title = 'Sign In · EduERP';
    if (lastSignOut) clearSignOutReason();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** In demo mode, choosing a role also fills that role's demo credentials. */
  const chooseRole = (r) => {
    setRole(r);
    setFormError('');
    if (mode === 'demo' && r) {
      setEmail(`${r}@${DEMO_DOMAIN}`);
      setPassword(DEMO_PASSWORD);
      setErrors({});
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const er = {};
    if (!email.trim()) er.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) er.email = 'Enter a valid email address';
    if (!password) er.password = 'Password is required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const u = await signIn(email, password, remember, role || undefined);
      if (remember) localStorage.setItem('kvce.rememberEmail', email.trim());
      else localStorage.removeItem('kvce.rememberEmail');
      // Only return to a previously requested page when the same user signs back in.
      const sameUser = localStorage.getItem('kvce.lastUser') === u.id;
      localStorage.setItem('kvce.lastUser', u.id);
      const from = location.state?.from;
      navigate(sameUser && from && from !== '/login' ? from : '/dashboard', { replace: true, state: null });
    } catch (err) {
      setFormError(err?.message ?? 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-title">
        <h2>Welcome</h2>
        <p>Sign in to your account</p>
      </div>

      {(notice || formError) && (
        <div className="auth-alerts">
          {notice === 'user' && <Alert tone="success">You have signed out successfully.</Alert>}
          {notice === 'expired' && <Alert tone="warning">Your session expired due to inactivity. Please sign in again.</Alert>}
          {notice === 'unauthorized' && <Alert tone="error">Your account is not authorised for this application.</Alert>}
          {formError && <Alert tone="error">{formError}</Alert>}
        </div>
      )}

      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="role">Role</label>
          <div className="auth-input">
            <ShieldCheck />
            <select id="role" value={role} onChange={(e) => chooseRole(e.target.value)}>
              <option value="">Any role</option>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="chev" />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email Id</label>
          <div className={`auth-input ${errors.email ? 'error' : ''}`}>
            <Mail />
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@college.edu"
              aria-invalid={!!errors.email}
            />
          </div>
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <div className={`auth-input ${errors.password ? 'error' : ''}`}>
            <Lock />
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
            />
            <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        <div className="auth-row">
          <label>
            <input type="checkbox" className="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading && <Loader2 className="spin" />}
          {loading ? 'SIGNING IN…' : 'SIGN IN'}
        </button>

        <div className="auth-or">OR</div>
        <p className="auth-foot">
          Don't have an account? <Link to="/register">Register Now</Link>
        </p>

        {mode === 'demo' && (
          <p className="auth-demo">
            Demo: <b>it-admin@{DEMO_DOMAIN}</b> / <b>{DEMO_PASSWORD}</b> · or choose a role above to auto-fill
          </p>
        )}
      </form>
    </AuthShell>
  );
}
