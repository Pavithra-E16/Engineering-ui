import { useState } from 'react';
import { KeyRound, Pencil, Plus, Ban, RotateCcw, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { UrlTabs } from '../../components/TabbedEntities';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { ROLES, roleLabel } from '../../lib/roles';
import { fmtDateTime, hashPassword, uid } from '../../lib/utils';
const strong = (p) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
function UserForm({ u, onClose, onSaved }) {
  const { user: me } = useAuth();
  const { db, create, update, mode } = useData();
  const toast = useToast();
  const isNew = !u?.id;
  const [f, setF] = useState({ role: 'staff', ...u, uidInput: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setErr('');
    if (!f.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email ?? '')) return setErr('Name and a valid email are required.');
    if (db.users.some((x) => x.id !== u?.id && x.email.toLowerCase() === f.email.toLowerCase()))
      return setErr('A user with this email already exists.');
    if (u?.id === me.id && f.role !== me.role) return setErr('You cannot change your own role.');
    if (f.role === 'student' && !f.studentId) return setErr('Link the student record.');
    if (isNew && mode === 'demo' && !strong(f.password))
      return setErr('Initial password must be 8+ characters with upper, lower case and a digit.');
    if (isNew && mode === 'firebase' && !f.uidInput.trim()) return setErr('Enter the Firebase Authentication UID for this user.');
    const data = {
      name: f.name.trim(),
      email: f.email.trim().toLowerCase(),
      role: f.role,
      departmentId: f.departmentId || undefined,
      employeeId: f.employeeId || undefined,
      studentId: f.role === 'student' ? f.studentId : undefined,
      linkedStudentIds: f.role === 'student' ? [f.studentId] : undefined,
      hostelId: f.role === 'warden' ? f.hostelId || undefined : undefined,
      designation: f.role === 'student' ? undefined : f.designation || db.employees.find((e) => e.id === f.employeeId)?.designation,
      phone: f.phone || undefined,
    };
    try {
      if (isNew) {
        const id = mode === 'firebase' ? f.uidInput.trim() : uid('usr_');
        const extra = mode === 'demo' ? { salt: id + '.' + uid(), passwordHash: '' } : {};
        if (mode === 'demo') extra.passwordHash = await hashPassword(f.password, extra.salt);
        await create('users', { ...data, ...extra, id }, { audit: 'Created', details: `${data.email} (${roleLabel(data.role)})` });
      } else {
        await update('users', u.id, data, {
          audit: u.role !== data.role ? `Role changed ${roleLabel(u.role)} → ${roleLabel(data.role)}` : 'Updated',
          details: data.email,
        });
      }
      await onSaved?.();
      toast.success(`User ${isNew ? 'created' : 'updated'}.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  const staffRole = f.role !== 'student';
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'New user' : `Edit ${u?.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{isNew ? 'Create user' : 'Save'}</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Full name" required>
            <Input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={f.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              disabled={!isNew && mode === 'firebase'}
            />
          </Field>
          <Field label="Role" required hint="Roles are assigned only by Administrators">
            <Select value={f.role} onChange={(e) => set('role', e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phone">
            <Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          {staffRole && (
            <Field label="Linked employee record">
              <Select
                value={f.employeeId ?? ''}
                onChange={(e) => {
                  const emp = db.employees.find((x) => x.id === e.target.value);
                  setF((x) => ({ ...x, employeeId: e.target.value, departmentId: emp?.departmentId ?? x.departmentId }));
                }}
              >
                <option value="">None</option>
                {options(db, 'employees').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {staffRole && (
            <Field label="Designation" hint="Shown on approvals (e.g. Hostel Warden)">
              <Input value={f.designation ?? ''} onChange={(e) => set('designation', e.target.value)} />
            </Field>
          )}
          {f.role === 'warden' && (
            <Field label="Hostel" hint="The warden sees and approves only this hostel">
              <Select value={f.hostelId ?? ''} onChange={(e) => set('hostelId', e.target.value)}>
                <option value="">All hostels</option>
                {options(db, 'hostels').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {f.role === 'student' && (
            <Field label="Student record" required className="full">
              <Select value={f.studentId ?? ''} onChange={(e) => set('studentId', e.target.value)}>
                <option value="">Select…</option>
                {options(db, 'students').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {isNew && mode === 'demo' && (
            <Field label="Initial password" required hint="8+ chars, upper & lower case, digit. Stored only as a PBKDF2 hash.">
              <Input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
            </Field>
          )}
          {isNew && mode === 'firebase' && (
            <Field label="Firebase Auth UID" required hint="Create the account in Firebase Authentication first, then paste its UID">
              <Input value={f.uidInput} onChange={(e) => set('uidInput', e.target.value)} />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
function ResetPassword({ u, onClose }) {
  const { update, mode } = useData();
  const { resetPassword } = useAuth();
  const toast = useToast();
  const [p, setP] = useState('');
  const go = async () => {
    try {
      if (mode === 'firebase') {
        toast.info(await resetPassword(u.email));
        onClose();
        return;
      }
      if (!strong(p)) {
        toast.error('Password must be 8+ characters with upper, lower case and a digit.');
        return;
      }
      const salt = u.id + '.' + uid();
      await update('users', u.id, { salt, passwordHash: await hashPassword(p, salt) }, { audit: 'Password reset', details: u.email });
      toast.success('Password reset.');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password · ${u.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go}>{mode === 'firebase' ? 'Send reset email' : 'Set password'}</Button>
        </>
      }
    >
      {mode === 'firebase' ? (
        <p className="muted">A password reset link will be emailed to {u.email}.</p>
      ) : (
        <Field label="New password">
          <Input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" />
        </Field>
      )}
    </Modal>
  );
}
export default function Users() {
  const { user: me } = useAuth();
  const { db, can, deactivate, restore, mode, update, remove } = useData();
  const delUser = async (u) => {
    const ok = await confirm({
      title: 'Delete user account?',
      message: `${u.name} (${u.email}) will be permanently removed and can no longer sign in. Their audit history is kept. To block access temporarily, deactivate instead.${mode === 'firebase' ? ' Also delete the login in Firebase Authentication.' : ''}`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await remove('users', u.id, { details: u.email });
      toast.success('User deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const delRequest = async (r) => {
    if (
      !(await confirm({
        title: 'Delete request?',
        message: `Delete the ${r.status.toLowerCase()} request from ${r.name}?`,
        confirmLabel: 'Delete',
      }))
    )
      return;
    try {
      await remove('accessRequests', r.id, { details: r.email });
      toast.success('Request deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(undefined);
  const [reset, setReset] = useState(null);
  const [approving, setApproving] = useState(null);
  const pending = db.accessRequests.filter((r) => r.status === 'Pending');
  const decide = async (r, status) => {
    try {
      await update('accessRequests', r.id, { status }, { audit: status, details: r.email });
      toast.success(`Request ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const reject = async (r) => {
    if (
      await confirm({
        title: 'Reject request?',
        message: `Reject the account request from ${r.name} (${r.email})?`,
        confirmLabel: 'Reject',
      })
    )
      decide(r, 'Rejected');
  };
  const edit = can('users', 'edit');
  const toggle = async (u) => {
    if (u.id === me.id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }
    const d = u.active !== false;
    if (
      !(await confirm({
        title: d ? 'Deactivate user?' : 'Reactivate user?',
        message: d ? `${u.name} will no longer be able to sign in.` : `${u.name} will be able to sign in again.`,
        confirmLabel: d ? 'Deactivate' : 'Reactivate',
        tone: d ? 'danger' : 'primary',
      }))
    )
      return;
    try {
      await (d ? deactivate('users', u.id) : restore('users', u.id));
      toast.success(`User ${d ? 'deactivated' : 'reactivated'}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Users & Access" subtitle="Individual logins and role-based access for the Principal, Accounts, Admin, Staff, Wardens and Students" />
      {mode === 'firebase' && (
        <div className="mb-12">
          <Alert tone="info">
            Firebase mode: create the login in Firebase Authentication, then add the ERP profile here using its UID. Roles are stored
            server-side and enforced by Firestore security rules.
          </Alert>
        </div>
      )}
      <UrlTabs
        tabs={[
          { id: 'users', label: 'Users', count: db.users.length },
          { id: 'requests', label: 'Account requests', count: pending.length },
        ]}
      >
        {(tab) =>
          tab === 'requests' ? (
            <DataTable
              title="Account requests"
              rows={db.accessRequests}
              initialSort={{ key: 'createdAt', dir: 'desc' }}
              emptyMessage="Requests submitted from the Register page appear here."
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: ['Pending', 'Approved', 'Rejected'].map((v) => ({ value: v, label: v })),
                  match: (r, v) => r.status === v,
                },
              ]}
              columns={[
                { key: 'createdAt', header: 'Received', render: (r) => fmtDateTime(r.createdAt) },
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                { key: 'requestedRole', header: 'Requested role', value: (r) => roleLabel(r.requestedRole) },
                { key: 'dept', header: 'Department', value: (r) => (r.departmentId ? labelOf(db, 'departments', r.departmentId) : '—') },
                { key: 'reference', header: 'Reference' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
              actions={
                edit
                  ? (r) =>
                      r.status === 'Pending' ? (
                        <>
                          <Button size="sm" variant="ghost" icon={CheckCircle2} className="ok" onClick={() => setApproving(r)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" icon={XCircle} className="bad" onClick={() => reject(r)}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" icon={Trash2} className="danger" onClick={() => delRequest(r)} title="Delete" />
                      )
                  : undefined
              }
            />
          ) : (
            <DataTable
              title="Users"
              rows={db.users}
              showInactiveToggle
              initialSort={{ key: 'role', dir: 'asc' }}
              toolbar={
                edit ? (
                  <Button size="sm" icon={Plus} onClick={() => setForm({})}>
                    Add user
                  </Button>
                ) : undefined
              }
              filters={[
                { key: 'role', label: 'Role', options: ROLES.map((r) => ({ value: r.id, label: r.label })), match: (r, v) => r.role === v },
              ]}
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                {
                  key: 'role',
                  header: 'Role',
                  value: (r) => roleLabel(r.role),
                  render: (r) => <Badge tone="navy">{roleLabel(r.role)}</Badge>,
                },
                {
                  key: 'scope',
                  header: 'Scope / links',
                  value: (r) =>
                    r.role === 'student'
                      ? (r.linkedStudentIds ?? []).map((s) => labelOf(db, 'students', s)).join(', ')
                      : r.hostelId
                        ? labelOf(db, 'hostels', r.hostelId)
                        : r.departmentId
                        ? labelOf(db, 'departments', r.departmentId)
                        : 'Institution',
                },
                { key: 'lastLogin', header: 'Last sign-in', render: (r) => fmtDateTime(r.lastLogin) },
                {
                  key: 'active',
                  header: 'Status',
                  value: (r) => (r.active === false ? 'Inactive' : 'Active'),
                  render: (r) => <Badge>{r.active === false ? 'Inactive' : 'Active'}</Badge>,
                },
              ]}
              actions={
                edit
                  ? (r) => (
                      <>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm(r)} title="Edit" />
                        <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setReset(r)} title="Reset password" />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={r.active === false ? RotateCcw : Ban}
                          onClick={() => toggle(r)}
                          title={r.active === false ? 'Reactivate' : 'Deactivate'}
                        />
                        {r.id !== me.id && (
                          <Button size="sm" variant="ghost" icon={Trash2} className="danger" onClick={() => delUser(r)} title="Delete" />
                        )}
                      </>
                    )
                  : undefined
              }
            />
          )
        }
      </UrlTabs>
      {form !== undefined && <UserForm u={form} onClose={() => setForm(undefined)} />}
      {approving && (
        <UserForm
          u={{
            name: approving.name,
            email: approving.email,
            role: approving.requestedRole,
            departmentId: approving.departmentId,
            phone: approving.phone,
          }}
          onSaved={() => decide(approving, 'Approved')}
          onClose={() => setApproving(null)}
        />
      )}
      {reset && <ResetPassword u={reset} onClose={() => setReset(null)} />}
    </>
  );
}
