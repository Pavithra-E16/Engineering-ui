import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { KeyRound, Shield } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../config/firebase';
import { useData } from '../data/store';
import { labelOf } from '../data/labels';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, useToast } from '../components/ui';
import { MODULES, PERMISSIONS, roleLabel } from '../lib/roles';
import { fmtDateTime, hashPassword, initials, uid } from '../lib/utils';
export default function Profile() {
  const { user, mode, refreshProfile } = useAuth();
  const { db, update } = useData();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const perms = PERMISSIONS[user.role];
  const change = async () => {
    setErr('');
    if (!cur) return setErr('Enter your current password.');
    if (p1.length < 8 || !/[A-Z]/.test(p1) || !/[a-z]/.test(p1) || !/\d/.test(p1))
      return setErr('New password must be 8+ characters with upper and lower case letters and a digit.');
    if (p1 !== p2) return setErr('New passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'firebase') {
        const u = auth.currentUser;
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
        await updatePassword(u, p1);
      } else {
        const me = db.users.find((u) => u.id === user.id);
        if ((await hashPassword(cur, me.salt)) !== me.passwordHash) throw new Error('Current password is incorrect.');
        const salt = user.id + '.' + uid();
        const passwordHash = await hashPassword(p1, salt);
        await update('users', user.id, { salt, passwordHash }, { audit: 'Changed own password' });
        refreshProfile({ ...me, salt, passwordHash });
      }
      toast.success('Password changed successfully.');
      setCur('');
      setP1('');
      setP2('');
    } catch (e) {
      setErr(
        e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password'
          ? 'Current password is incorrect.'
          : (e.message ?? 'Could not change password.'),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="My Profile" subtitle="Account details, access permissions and security" />
      <div className="grid cols-3">
        <Card>
          <div className="profile-card">
            <span className="avatar lg">{initials(user.name)}</span>
            <p className="strong mt-12">{user.name}</p>
            <p className="muted">{user.email}</p>
            <Badge tone="navy">{roleLabel(user.role)}</Badge>
          </div>
          <dl className="kv mt-16">
            {user.departmentId && (
              <div className="row between nowrap">
                <dt className="muted">Department</dt>
                <dd>{labelOf(db, 'departments', user.departmentId)}</dd>
              </div>
            )}
            {user.employeeId && (
              <div className="row between nowrap">
                <dt className="muted">Employee</dt>
                <dd>{db.employees.find((e) => e.id === user.employeeId)?.empNo}</dd>
              </div>
            )}
            {user.linkedStudentIds?.length ? (
              <div className="row between nowrap">
                <dt className="muted">Linked student(s)</dt>
                <dd className="text-right">{user.linkedStudentIds.map((s) => labelOf(db, 'students', s)).join(', ')}</dd>
              </div>
            ) : null}
            <div className="row between nowrap">
              <dt className="muted">Last sign-in</dt>
              <dd>{fmtDateTime(db.users.find((u) => u.id === user.id)?.lastLogin)}</dd>
            </div>
            <div className="row between nowrap">
              <dt className="muted">Authentication</dt>
              <dd>{mode === 'firebase' ? 'Firebase Auth' : 'Demo (PBKDF2 hash)'}</dd>
            </div>
          </dl>
        </Card>
        <Card
          title={
            <span className="row">
              <KeyRound className="icon-16" />
              Change password
            </span>
          }
        >
          <div className="stack">
            {err && <Alert tone="error">{err}</Alert>}
            <Field label="Current password">
              <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="New password" hint="8+ characters, upper & lower case, digit">
              <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button onClick={change} loading={busy}>
              Update password
            </Button>
          </div>
        </Card>
        <Card
          title={
            <span className="row">
              <Shield className="icon-16" />
              My access
            </span>
          }
          subtitle="Granted by your role; changeable only by an IT Administrator"
          bodyClass="scroll"
        >
          <ul className="stack tight">
            {MODULES.filter((m) => perms[m.id]).map((m) => (
              <li key={m.id} className="row between nowrap">
                <span>{m.label}</span>
                <Badge tone={perms[m.id] === 'edit' ? 'green' : 'slate'}>{perms[m.id] === 'edit' ? 'Manage' : 'View'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
