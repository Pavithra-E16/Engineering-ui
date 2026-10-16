import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { APP_MODE } from '../config/firebase';
import { canAccess } from '../lib/roles';
import { nowISO, uid } from '../lib/utils';
import { COLLECTIONS } from '../types';
import { loadDemo, persist, resetDemo as resetDemoStore } from './demoBackend';
import { fsCreate, fsDelete, fsUpdate, subscribeAll } from './firestoreBackend';
import { META, canRead, canWrite } from './meta';
const Ctx = createContext(null);
export const useData = () => useContext(Ctx);
const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
const PREFIX = { auditLogs: 'log_', notifications: 'ntf_' };
const NO_AUDIT = new Set(['auditLogs', 'notifications']);
/** Emulates server-side scoped reads in demo mode (Firestore queries + rules do this in production). */
function scope(full, user) {
  const personal = user.role === 'student' || user.role === 'parent';
  const linked = new Set(user.linkedStudentIds ?? (user.studentId ? [user.studentId] : []));
  const out = {};
  COLLECTIONS.forEach((c) => {
    const rows = full[c];
    if (!canRead(user, c)) {
      out[c] = [];
      return;
    }
    if (c === 'users' && user.role !== 'it-admin' && user.role !== 'principal') {
      out[c] = rows.filter((u) => u.id === user.id);
      return;
    }
    const m = META[c];
    if (personal && !m.shared) {
      const k = m.studentKey;
      out[c] = !k ? [] : rows.filter((r) => (k === 'studentIds' ? r.studentIds?.some((s) => linked.has(s)) : linked.has(r[k])));
      return;
    }
    out[c] = rows;
  });
  return out;
}
export function DataProvider({ children }) {
  const { user, status, signInEvent } = useAuth();
  const [db, setDb] = useState(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const full = useRef(null);
  const [ayOverride, setAyOverride] = useState(() => localStorage.getItem('kvce.user.ay'));
  // ---- load / subscribe ----
  useEffect(() => {
    setReady(false);
    setError(null);
    if (status !== 'signedIn' || !user) {
      setDb(empty());
      full.current = null;
      return;
    }
    if (APP_MODE === 'demo') {
      let alive = true;
      loadDemo()
        .then((d) => {
          if (!alive) return;
          full.current = d;
          setDb(scope(d, user));
          setReady(true);
        })
        .catch((e) => setError(String(e?.message ?? e)));
      return () => {
        alive = false;
      };
    }
    const seen = new Set();
    const unsub = subscribeAll(
      user,
      (col, rows) => {
        setDb((prev) => ({ ...prev, [col]: rows }));
        seen.add(col);
        if (seen.size === COLLECTIONS.length) setReady(true);
      },
      (e) => setError(e.message.includes('permission') ? 'You do not have permission to read some data.' : e.message),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id, user?.role]);
  const settings = useMemo(() => db.settings[0] ?? {}, [db.settings]);
  const ayId = ayOverride && db.academicYears.some((a) => a.id === ayOverride) ? ayOverride : settings.currentAcademicYearId;
  const setAyId = (id) => {
    localStorage.setItem('kvce.user.ay', id);
    setAyOverride(id);
  };
  const can = useCallback((m, a = 'view') => canAccess(user?.role, m, a), [user?.role]);
  const commitDemo = (col, rows) => {
    if (!full.current || !user) return;
    full.current = { ...full.current, [col]: rows };
    persist(full.current, [col]);
    setDb(scope(full.current, user));
  };
  const source = (col) => (APP_MODE === 'demo' ? full.current?.[col] : db[col]) ?? [];
  const writeAudit = useCallback(
    async (action, entity, entityId, details) => {
      if (!user) return;
      const rec = {
        id: uid('log_'),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        active: true,
        userId: user.id,
        userName: user.name,
        role: user.role,
        action,
        entity,
        entityId,
        details,
      };
      if (APP_MODE === 'demo') commitDemo('auditLogs', [rec, ...source('auditLogs')].slice(0, 3000));
      else await fsCreate('auditLogs', rec);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user, db],
  );
  const create = async (col, data, opts = {}) => {
    if (!user) throw new Error('Not signed in');
    if (!canWrite(user, col, data, true)) throw new Error(`You do not have permission to create ${META[col].label.toLowerCase()} records.`);
    const t = nowISO();
    const rec = {
      active: true,
      ...data,
      id: data.id ?? uid(PREFIX[col] ?? col.slice(0, 3) + '_'),
      createdAt: t,
      updatedAt: t,
      createdBy: user.id,
    };
    if (APP_MODE === 'demo') commitDemo(col, [...source(col), rec]);
    else await fsCreate(col, rec);
    if (!NO_AUDIT.has(col) && opts.audit !== false)
      await writeAudit(
        opts.audit || 'Created',
        META[col].label,
        rec.id,
        opts.details ?? rec.name ?? rec.title ?? rec.code ?? rec.invoiceNo ?? rec.receiptNo,
      );
    return rec;
  };
  const update = async (col, id, patch, opts = {}) => {
    if (!user) throw new Error('Not signed in');
    const existing = source(col).find((r) => r.id === id);
    if (!existing) throw new Error('Record not found or not accessible.');
    const selfLogin =
      col === 'users' && id === user.id && Object.keys(patch).every((k) => ['lastLogin', 'passwordHash', 'salt', 'phone'].includes(k));
    if (!selfLogin && !canWrite(user, col, { ...existing, ...patch }))
      throw new Error(`You do not have permission to modify ${META[col].label.toLowerCase()} records.`);
    const p = { ...patch, updatedAt: nowISO(), updatedBy: user.id };
    if (APP_MODE === 'demo')
      commitDemo(
        col,
        source(col).map((r) => (r.id === id ? { ...r, ...p } : r)),
      );
    else await fsUpdate(col, id, p);
    if (!NO_AUDIT.has(col) && opts.audit !== false && !(selfLogin && 'lastLogin' in patch))
      await writeAudit(
        opts.audit || 'Updated',
        META[col].label,
        id,
        opts.details ?? existing.name ?? existing.title ?? existing.code ?? existing.invoiceNo,
      );
  };
  const remove = async (col, id, opts = {}) => {
    if (!user) throw new Error('Not signed in');
    const existing = source(col).find((r) => r.id === id);
    if (!existing) return;
    if (!canWrite(user, col, existing)) throw new Error('You do not have permission to delete this record.');
    if (APP_MODE === 'demo')
      commitDemo(
        col,
        source(col).filter((r) => r.id !== id),
      );
    else await fsDelete(col, id);
    if (opts.audit !== false && !NO_AUDIT.has(col)) await writeAudit(opts.audit || 'Deleted', META[col].label, id, opts.details);
  };
  const notify = async (n) => {
    await create('notifications', { ...n, read: false, readBy: [] }, { audit: false });
  };
  // Audit successful sign-in once data is ready.
  const auditedEvent = useRef(0);
  useEffect(() => {
    if (!ready || !user || !signInEvent || auditedEvent.current === signInEvent) return;
    auditedEvent.current = signInEvent;
    writeAudit('Signed in', 'Session', user.id);
    update('users', user.id, { lastLogin: nowISO() }, { audit: false }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signInEvent]);
  const value = {
    db,
    ready,
    error,
    mode: APP_MODE,
    settings,
    ayId,
    setAyId,
    can,
    create,
    update,
    remove,
    notify,
    audit: writeAudit,
    deactivate: (col, id) => update(col, id, { active: false }, { audit: 'Deactivated' }),
    restore: (col, id) => update(col, id, { active: true }, { audit: 'Reactivated' }),
    resetDemo: async () => {
      await resetDemoStore();
      full.current = null;
      window.location.reload();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
/** Id → record map, memoised per collection. */
export function useLookup(col) {
  const { db } = useData();
  return useMemo(() => new Map(db[col].map((r) => [r.id, r])), [db, col]);
}
