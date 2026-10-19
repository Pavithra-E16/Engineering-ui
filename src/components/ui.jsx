import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BedDouble,
  BellRing,
  BookOpen,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  Info,
  LayoutDashboard,
  Layers,
  Loader2,
  MessageSquareText,
  Receipt,
  ScrollText,
  Settings,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
  Inbox,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { MODULES } from '../lib/roles';

export const ICONS = {
  LayoutDashboard,
  Wallet,
  Layers,
  CreditCard,
  BellRing,
  BookOpen,
  Receipt,
  FileBarChart,
  UserPlus,
  Users,
  Award,
  BedDouble,
  DoorOpen,
  MessageSquareText,
  Settings,
  UserCheck,
  ScrollText,
};

/* ------------------------------ Button ------------------------------ */
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...rest }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}>
      {loading ? <Loader2 className="spin" /> : Icon ? <Icon /> : null}
      {children}
    </button>
  );
}

/* ------------------------------ Layout ------------------------------ */
export function Card({ children, className, title, actions, subtitle, bodyClass }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={cn('card-body', bodyClass)}>{children}</div>
    </section>
  );
}

/** Blue gradient page banner; the icon comes from the current module unless one is passed. */
export function PageHeader({ title, subtitle, actions, icon }) {
  const { pathname } = useLocation();
  const mod = [...MODULES].sort((a, b) => b.path.length - a.path.length).find((m) => pathname.startsWith(m.path));
  const Icon =
    icon ??
    (pathname.startsWith('/profile') ? Users : pathname.startsWith('/students/') ? GraduationCap : (ICONS[mod?.icon] ?? LayoutDashboard));
  return (
    <div className="page-banner">
      <span className="banner-icon">
        <Icon />
      </span>
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row banner-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'navy', onClick }) {
  return (
    <div onClick={onClick} className={cn('stat', onClick && 'clickable')}>
      <div className="stat-top">
        <div style={{ minWidth: 0 }}>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        {Icon && (
          <span className={cn('stat-icon', `tone-${tone}`)}>
            <Icon />
          </span>
        )}
      </div>
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  );
}

const STATUS_TONE = {
  active: 'green',
  approved: 'green',
  paid: 'green',
  completed: 'green',
  verified: 'green',
  published: 'green',
  present: 'green',
  selected: 'green',
  resolved: 'green',
  returned: 'green',
  allocated: 'green',
  'in use': 'green',
  'in service': 'green',
  admitted: 'green',
  eligible: 'green',
  pass: 'green',
  closed: 'slate',
  open: 'blue',
  ongoing: 'blue',
  'in progress': 'blue',
  scheduled: 'blue',
  issued: 'blue',
  upcoming: 'blue',
  planned: 'blue',
  'marks entered': 'blue',
  shortlisted: 'violet',
  mapped: 'violet',
  'under review': 'amber',
  'pending review': 'amber',
  pending: 'amber',
  'partially paid': 'amber',
  delayed: 'amber',
  draft: 'slate',
  applied: 'slate',
  'on leave': 'amber',
  'under repair': 'amber',
  maintenance: 'amber',
  'needs revision': 'amber',
  important: 'amber',
  high: 'amber',
  medium: 'blue',
  low: 'slate',
  normal: 'slate',
  inactive: 'slate',
  rejected: 'red',
  unpaid: 'red',
  overdue: 'red',
  absent: 'red',
  urgent: 'red',
  critical: 'red',
  cancelled: 'slate',
  detained: 'red',
  discontinued: 'red',
  fail: 'red',
  disposed: 'slate',
  vacated: 'slate',
  'in store': 'slate',
  resigned: 'slate',
  proposed: 'amber',
  archived: 'slate',
  'not eligible': 'red',
  'high risk': 'red',
  'moderate risk': 'amber',
  'low risk': 'green',
  accruing: 'amber',
  waived: 'slate',
  'checked out': 'blue',
  delivered: 'green',
  sent: 'green',
  success: 'green',
  valid: 'green',
  'course completed': 'green',
  failed: 'red',
  revoked: 'red',
  queued: 'amber',
  created: 'slate',
  enquiry: 'slate',
  'follow-up': 'blue',
  registered: 'violet',
  'not interested': 'slate',
  relieved: 'slate',
  internal: 'blue',
  external: 'violet',
  receipt: 'green',
  payment: 'red',
};
export function Badge({ children, tone }) {
  const t = tone ?? STATUS_TONE[String(children).toLowerCase()] ?? 'slate';
  return <span className={cn('badge', `tone-${t}`)}>{children}</span>;
}

export function Spinner({ label = 'Loading…', className }) {
  return (
    <div className={cn('spinner', className)} role="status">
      <Loader2 className="spin" /> {label}
    </div>
  );
}

export function EmptyState({ title = 'No records found', message, action, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon />
      </span>
      <h4>{title}</h4>
      {message && <p>{message}</p>}
      {action && <div className="action">{action}</div>}
    </div>
  );
}

const ALERT_ICON = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle2 };
export function Alert({ tone = 'info', children, title }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={cn('alert', tone)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon />
      <div>
        {title && <p className="alert-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn('tab', value === t.id && 'active')}
        >
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Form fields ------------------------------ */
export function Field({ label, error, required, children, hint, className }) {
  return (
    <label className={cn('field', className)}>
      <span className="field-label">
        {label}
        {required && <span className="req"> *</span>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
export const Input = ({ error, className, ...p }) => <input {...p} className={cn('input', error && 'error', className)} />;
export const Select = ({ error, className, children, ...p }) => (
  <select {...p} className={cn('input', error && 'error', className)}>
    {children}
  </select>
);
export const Textarea = ({ error, className, ...p }) => <textarea rows={3} {...p} className={cn('input', error && 'error', className)} />;

/* ------------------------------ Modal ------------------------------ */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Focus the first field only when the dialog opens (not on every re-render while typing).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('.modal-body input, .modal-body select, .modal-body textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cn('modal', size !== 'md' && size)}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Confirm dialog ------------------------------ */
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {state?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={state?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="muted">{state?.message}</div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ------------------------------ Toasts ------------------------------ */
const ToastCtx = createContext({ success() {}, error() {}, info() {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((tone, text) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, tone, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3800);
  }, []);
  const api = useRef({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }).current;
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
          return (
            <div key={t.id} className={cn('toast', t.tone)}>
              <Icon />
              <span>{t.text}</span>
              <button className="close-btn" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss">
                <X className="icon-16" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ Misc ------------------------------ */
export function ProgressBar({ value, tone }) {
  const t = tone ?? (value >= 75 ? 'green' : value >= 60 ? 'amber' : 'red');
  return (
    <div className="progress">
      <span className={t} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Label + value line above a progress bar. */
export function Meter({ label, right, value, tone, rightClass }) {
  return (
    <div>
      <div className="meter-label">
        <span className="truncate">{label}</span>
        <span className={rightClass ?? 'muted'}>{right}</span>
      </div>
      <ProgressBar value={value} tone={tone} />
    </div>
  );
}
