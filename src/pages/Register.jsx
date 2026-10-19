import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { APP_MODE } from '../config/firebase';
import { addAccessRequestDemo, loadDemo } from '../data/demoBackend';
import { fsCreate } from '../data/firestoreBackend';
import { ROLES } from '../lib/roles';
import { nowISO, uid } from '../lib/utils';
import { Alert } from '../components/ui';
import { AuthShell } from './AuthShell';

const DEPARTMENTS = [
  ['dep_cse', 'Computer Science & Engineering'],
  ['dep_ece', 'Electronics & Communication'],
  ['dep_eee', 'Electrical & Electronics'],
  ['dep_mech', 'Mechanical Engineering'],
  ['dep_civil', 'Civil Engineering'],
  ['dep_it', 'Information Technology'],
];

/**
 * Account request form. Nobody can create their own account or pick their own access:
 * the request goes to the Administrator, who creates the account in User Management.
 */
export default function RegisterPage() {
  const { mode } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', requestedRole: 'student', departmentId: '', reference: '', message: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    document.title = 'Request an account · EduERP';
  }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const er = {};
    if (f.name.trim().length < 3) er.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = 'Enter a valid email address';
    if (f.phone && !/^[0-9+\-\s]{7,15}$/.test(f.phone)) er.phone = 'Enter a valid phone number';
    if (!f.reference.trim()) er.reference = 'Roll number, employee ID or application number is required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      const t = nowISO();
      const rec = {
        id: uid('req_'),
        ...f,
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        message: f.message.slice(0, 1000),
        status: 'Pending',
        active: true,
        createdAt: t,
        updatedAt: t,
      };
      if (!rec.departmentId) delete rec.departmentId;
      if (APP_MODE === 'firebase') await fsCreate('accessRequests', rec);
      else {
        const db = await loadDemo();
        if ((db.accessRequests ?? []).some((r) => r.email === rec.email && r.status === 'Pending'))
          throw new Error('A request for this email is already pending.');
        await addAccessRequestDemo(rec);
      }
      setDone(true);
    } catch (err) {
      setFormError(err?.message ?? 'Could not submit the request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-title">
        <h2 style={{ fontSize: 30 }}>Register</h2>
        <p>Request access to the ERP</p>
      </div>
      {done ? (
        <div className="auth-form">
          <Alert tone="success" title="Request submitted">
            The Administrator will verify your details and email you your login.{' '}
            {mode === 'demo' && 'In demo mode, sign in as admin to see it under Users & Access → Account requests.'}
          </Alert>
          <Link to="/login" className="auth-btn" style={{ textDecoration: 'none' }}>
            BACK TO SIGN IN
          </Link>
        </div>
      ) : (
        <form className="auth-form compact" onSubmit={submit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="auth-field">
            <label htmlFor="r-name">Full name</label>
            <div className={`auth-input ${errors.name ? 'error' : ''}`}>
              <User />
              <input id="r-name" value={f.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="auth-field">
            <label htmlFor="r-email">Email Id</label>
            <div className={`auth-input ${errors.email ? 'error' : ''}`}>
              <Mail />
              <input id="r-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="auth-two">
            <div className="auth-field">
              <label htmlFor="r-role">I am a</label>
              <div className="auth-input">
                <ShieldCheck />
                <select id="r-role" value={f.requestedRole} onChange={(e) => set('requestedRole', e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="r-phone">Phone</label>
              <div className={`auth-input ${errors.phone ? 'error' : ''}`}>
                <Phone />
                <input id="r-phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>
          </div>
          <div className="auth-two">
            <div className="auth-field">
              <label htmlFor="r-dept">Department</label>
              <div className="auth-input">
                <Building2 />
                <select id="r-dept" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  <option value="">Not applicable</option>
                  {DEPARTMENTS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="r-ref">Roll / Employee / App no.</label>
              <div className={`auth-input ${errors.reference ? 'error' : ''}`}>
                <input id="r-ref" value={f.reference} onChange={(e) => set('reference', e.target.value)} style={{ paddingLeft: 4 }} />
              </div>
              {errors.reference && <span className="field-error">{errors.reference}</span>}
            </div>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading && <Loader2 className="spin" />}SUBMIT REQUEST
          </button>
          <p className="auth-foot">
            <Link to="/login" className="row" style={{ justifyContent: 'center', gap: 4 }}>
              <ArrowLeft className="icon-14" />
              Back to Sign In
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
