import { useState } from 'react';
import { AlarmClock, CheckCircle2, DoorOpen, LogIn, LogOut, Plus, Undo2, UserCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, useConfirm, useToast } from '../../components/ui';
import { LEAVE_STATUSES, LEAVE_TYPES, PICKUP_RELATIONS } from '../../lib/domain';
import { SMS_TEMPLATES, toParent, useSms } from '../../lib/sms';
import { addDays, fmtDateTime, nowISO, todayISO } from '../../lib/utils';

const local = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const self = (rel) => rel?.startsWith('Self');

/** Leave / out-pass request: raised by the student or by the warden on the student's behalf. */
function LeaveForm({ onClose }) {
  const { db, create } = useData();
  const scope = useScope();
  const toast = useToast();
  const residents = db.hostelAllocations.filter((a) => a.status === 'Allocated');
  const [f, setF] = useState({
    studentId: scope.linkedStudent?.id ?? '',
    leaveType: 'Home Visit',
    reason: '',
    destination: '',
    fromAt: local(Date.now() + 3600e3),
    toAt: local(Date.now() + 2 * 864e5),
    pickupRelation: 'Father',
    pickupName: '',
    pickupPhone: '',
  });
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const st = db.students.find((s) => s.id === f.studentId);
  const save = async () => {
    setErr('');
    const alloc = residents.find((a) => a.studentId === f.studentId);
    if (!alloc) return setErr(scope.personal ? 'You are not allotted a hostel room.' : 'Select a hostel resident.');
    if (!f.reason.trim()) return setErr('Enter the reason for leave.');
    if (f.toAt <= f.fromAt) return setErr('Return date/time must be after the leaving time.');
    if (!self(f.pickupRelation) && (!f.pickupName.trim() || !/^[0-9+\-\s]{7,15}$/.test(f.pickupPhone)))
      return setErr('Enter the name and mobile number of the person picking up the student.');
    if (db.hostelLeaves.some((l) => l.studentId === f.studentId && ['Pending', 'Approved', 'Checked Out'].includes(l.status)))
      return setErr('There is already an open leave request for this student.');
    try {
      await create('hostelLeaves', {
        passNo: 'OP-' + Date.now().toString().slice(-7),
        studentId: f.studentId,
        hostelId: alloc.hostelId ?? db.hostelRooms.find((r) => r.id === alloc.roomId)?.hostelId,
        leaveType: f.leaveType,
        reason: f.reason.trim(),
        destination: f.destination || undefined,
        fromAt: f.fromAt,
        toAt: f.toAt,
        pickupRelation: f.pickupRelation,
        pickupName: self(f.pickupRelation) ? undefined : f.pickupName.trim(),
        pickupPhone: self(f.pickupRelation) ? undefined : f.pickupPhone,
        status: 'Pending',
      });
      toast.success('Leave request submitted to the warden.');
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Hostel leave / out-pass request"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Submit</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          {!scope.personal && (
            <Field label="Student" required className="full">
              <Select value={f.studentId} onChange={(e) => set('studentId', e.target.value)}>
                <option value="">Select…</option>
                {options(db, 'students', (s) => residents.some((a) => a.studentId === s.id)).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Leave type" required>
            <Select value={f.leaveType} onChange={(e) => set('leaveType', e.target.value)}>
              {LEAVE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Destination">
            <Input value={f.destination} onChange={(e) => set('destination', e.target.value)} />
          </Field>
          <Field label="Leaving on" required>
            <Input type="datetime-local" value={f.fromAt} onChange={(e) => set('fromAt', e.target.value)} />
          </Field>
          <Field label="Returning by" required>
            <Input type="datetime-local" value={f.toAt} onChange={(e) => set('toAt', e.target.value)} />
          </Field>
          <Field label="Reason" required className="full">
            <Textarea value={f.reason} onChange={(e) => set('reason', e.target.value)} />
          </Field>
          <Field label="Picked up by" required hint="Relation of the person collecting the student">
            <Select value={f.pickupRelation} onChange={(e) => set('pickupRelation', e.target.value)}>
              {PICKUP_RELATIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          {!self(f.pickupRelation) && (
            <>
              <Field label="Pick-up person's name" required>
                <Input value={f.pickupName} onChange={(e) => set('pickupName', e.target.value)} placeholder={f.pickupRelation === 'Father' ? st?.parentName : ''} />
              </Field>
              <Field label="Pick-up person's mobile" required>
                <Input value={f.pickupPhone} onChange={(e) => set('pickupPhone', e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Warden check-out at the gate: confirms who actually picked the student up. */
function CheckOut({ l, onClose }) {
  const { db, update, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const st = db.students.find((s) => s.id === l.studentId);
  const [f, setF] = useState({ pickupRelation: l.pickupRelation ?? 'Father', pickupName: l.pickupName ?? '', pickupPhone: l.pickupPhone ?? '', pickupIdProof: '' });
  const [err, setErr] = useState('');
  const go = async () => {
    if (!self(f.pickupRelation) && (!f.pickupName.trim() || !f.pickupPhone.trim() || !f.pickupIdProof.trim()))
      return setErr("Record the pick-up person's name, mobile and ID proof.");
    try {
      await update('hostelLeaves', l.id, { ...f, status: 'Checked Out', checkedOutAt: nowISO() }, { audit: 'Student checked out', details: `${l.passNo} · ${f.pickupRelation}` });
      await sms([toParent(st, 'Hostel Leave', SMS_TEMPLATES.leaveOut({ st, by: self(f.pickupRelation) ? 'no escort' : f.pickupName, rel: f.pickupRelation }, settings))]);
      toast.success(`${st.name} checked out; parent notified.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Check out · ${st?.name} (${l.passNo})`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={LogOut} onClick={go}>
            Confirm check-out
          </Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Picked up by">
          <Select value={f.pickupRelation} onChange={(e) => setF({ ...f, pickupRelation: e.target.value })}>
            {PICKUP_RELATIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        {!self(f.pickupRelation) && (
          <>
            <Field label="Name" required>
              <Input value={f.pickupName} onChange={(e) => setF({ ...f, pickupName: e.target.value })} />
            </Field>
            <Field label="Mobile" required>
              <Input value={f.pickupPhone} onChange={(e) => setF({ ...f, pickupPhone: e.target.value })} />
            </Field>
            <Field label="ID proof seen" required hint="e.g. Aadhaar last 4 digits">
              <Input value={f.pickupIdProof} onChange={(e) => setF({ ...f, pickupIdProof: e.target.value })} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

function RejectLeave({ l, onClose }) {
  const { user } = useAuth();
  const { update } = useData();
  const toast = useToast();
  const [r, setR] = useState('');
  const go = async () => {
    if (!r.trim()) return toast.error('Enter the reason.');
    try {
      await update('hostelLeaves', l.id, { status: 'Rejected', wardenRemarks: r.trim(), approvedById: user.employeeId, approvedByName: user.name, approvedAt: nowISO() }, { audit: 'Leave rejected', details: l.passNo });
      toast.success('Leave rejected.');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reject ${l.passNo}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={go}>
            Reject
          </Button>
        </>
      }
    >
      <Field label="Reason" required>
        <Textarea value={r} onChange={(e) => setR(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const { db, can, update, settings } = useData();
  const scope = useScope();
  const sms = useSms();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null);
  const edit = can('hostel-leave', 'edit');
  const designation = user?.designation ?? db.employees.find((e) => e.id === user?.employeeId)?.designation ?? (user?.role === 'principal' ? 'Principal' : 'Hostel Warden');
  const rows = db.hostelLeaves.filter((l) => !user?.hostelId || l.hostelId === user.hostelId);
  const stu = (id) => db.students.find((s) => s.id === id);
  const approve = async (l) => {
    const st = stu(l.studentId);
    try {
      await update(
        'hostelLeaves',
        l.id,
        { status: 'Approved', approvedById: user.employeeId, approvedByName: user.name, approvedByDesignation: designation, approvedAt: nowISO(), parentNotified: true },
        { audit: 'Leave approved', details: l.passNo },
      );
      await sms([toParent(st, 'Hostel Leave', SMS_TEMPLATES.leaveApproved({ st, from: l.fromAt, to: l.toAt }, settings))]);
      toast.success(`Leave approved by ${user.name}; parent notified.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const returned = async (l) => {
    const st = stu(l.studentId);
    const at = nowISO();
    try {
      await update('hostelLeaves', l.id, { status: 'Returned', returnedAt: at, lateReturn: local(at) > l.toAt }, { audit: 'Student returned', details: l.passNo });
      await sms([toParent(st, 'Hostel Leave', SMS_TEMPLATES.leaveReturned({ st }, settings))]);
      toast.success(`${st.name} marked as returned${local(at) > l.toAt ? ' (late)' : ''}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const cancel = async (l) => {
    if (!(await confirm({ title: 'Cancel request?', message: `Cancel leave request ${l.passNo}?`, confirmLabel: 'Cancel request' }))) return;
    try {
      await update('hostelLeaves', l.id, { status: 'Cancelled' }, { audit: 'Leave cancelled', details: l.passNo });
      toast.success('Request cancelled.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const now = local(Date.now());
  const out = rows.filter((l) => l.status === 'Checked Out');
  const overdue = out.filter((l) => l.toAt < now);
  const cols = [
    { key: 'passNo', header: 'Pass no' },
    ...(scope.personal ? [] : [{ key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) }, { key: 'hostel', header: 'Hostel', value: (r) => labelOf(db, 'hostels', r.hostelId) }]),
    { key: 'leaveType', header: 'Type' },
    { key: 'fromAt', header: 'Leaving', render: (r) => fmtDateTime(r.fromAt) },
    { key: 'toAt', header: 'Return by', render: (r) => <span className={r.status === 'Checked Out' && r.toAt < now ? 'text-red' : ''}>{fmtDateTime(r.toAt)}</span> },
    { key: 'reason', header: 'Reason' },
    { key: 'pickup', header: 'Picked up by', value: (r) => (r.pickupRelation ? `${r.pickupRelation}${r.pickupName ? ` – ${r.pickupName}` : ''}` : '') },
    { key: 'pickupPhone', header: 'Pick-up mobile' },
    { key: 'pickupIdProof', header: 'ID proof' },
    { key: 'approvedByName', header: 'Approving warden', value: (r) => (r.approvedByName ? `${r.approvedByName}${r.approvedByDesignation ? ` (${r.approvedByDesignation})` : ''}` : '') },
    { key: 'approvedAt', header: 'Approved at', render: (r) => fmtDateTime(r.approvedAt) },
    { key: 'checkedOutAt', header: 'Left at', render: (r) => fmtDateTime(r.checkedOutAt) },
    { key: 'returnedAt', header: 'Returned at', render: (r) => (r.returnedAt ? <span className={r.lateReturn ? 'text-red' : ''}>{fmtDateTime(r.returnedAt)}{r.lateReturn ? ' (late)' : ''}</span> : '—') },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
  ];
  const actions = (r) =>
    scope.personal ? (
      r.status === 'Pending' ? <Button size="sm" variant="ghost" icon={Undo2} className="danger" title="Cancel request" onClick={() => cancel(r)} /> : null
    ) : edit ? (
      <>
        {r.status === 'Pending' && (
          <>
            <Button size="sm" variant="ghost" icon={CheckCircle2} className="ok" onClick={() => approve(r)}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" icon={XCircle} className="bad" title="Reject" onClick={() => setModal({ kind: 'reject', l: r })} />
          </>
        )}
        {r.status === 'Approved' && (
          <Button size="sm" variant="ghost" icon={LogOut} onClick={() => setModal({ kind: 'out', l: r })}>
            Check out
          </Button>
        )}
        {r.status === 'Checked Out' && (
          <Button size="sm" variant="ghost" icon={LogIn} onClick={() => returned(r)}>
            Returned
          </Button>
        )}
      </>
    ) : null;
  const table = (title, list, extra = {}) => (
    <DataTable
      title={title}
      exportName="hostel-leave-register"
      rows={list}
      initialSort={{ key: 'fromAt', dir: 'desc' }}
      filters={[
        { key: 'status', label: 'Status', options: LEAVE_STATUSES.map((v) => ({ value: v, label: v })), match: (r, v) => r.status === v },
        { key: 'type', label: 'Type', options: LEAVE_TYPES.map((v) => ({ value: v, label: v })), match: (r, v) => r.leaveType === v },
        { key: 'rel', label: 'Picked up by', options: PICKUP_RELATIONS.map((v) => ({ value: v, label: v })), match: (r, v) => r.pickupRelation === v },
      ]}
      columns={cols}
      actions={actions}
      {...extra}
    />
  );
  return (
    <>
      <PageHeader
        title={scope.personal ? 'My Hostel Leave' : 'Leave & Out-pass'}
        subtitle="Leave and permission when a student leaves the hostel: approving warden and who picked the student up"
        actions={
          (scope.personal || edit) && (
            <Button icon={Plus} onClick={() => setModal({ kind: 'new' })}>
              {scope.personal ? 'Request leave' : 'New leave'}
            </Button>
          )
        }
      />
      {scope.personal ? (
        table('My leave requests', rows)
      ) : (
        <>
          <div className="grid cols-4 stats">
            <StatCard label="Awaiting approval" value={rows.filter((l) => l.status === 'Pending').length} icon={UserCheck} tone="amber" />
            <StatCard label="Approved, yet to leave" value={rows.filter((l) => l.status === 'Approved').length} icon={DoorOpen} tone="blue" />
            <StatCard label="Currently out" value={out.length} icon={LogOut} tone="violet" hint={`${overdue.length} past return time`} />
            <StatCard label="Late returns (30 days)" value={rows.filter((l) => l.lateReturn && l.returnedAt >= addDays(todayISO(), -30)).length} icon={AlarmClock} tone="red" />
          </div>
          <UrlTabs
            tabs={[
              { id: 'pending', label: 'Pending', count: rows.filter((l) => l.status === 'Pending').length },
              { id: 'out', label: 'Approved & out', count: rows.filter((l) => l.status === 'Approved').length + out.length },
              { id: 'all', label: 'Leave register' },
            ]}
          >
            {(t) =>
              t === 'pending'
                ? table('Pending leave requests', rows.filter((l) => l.status === 'Pending'), { emptyMessage: 'No requests waiting.' })
                : t === 'out'
                  ? table('Approved and currently out', rows.filter((l) => l.status === 'Approved' || l.status === 'Checked Out'))
                  : table('Leave & out-pass register', rows)
            }
          </UrlTabs>
        </>
      )}
      {modal?.kind === 'new' && <LeaveForm onClose={() => setModal(null)} />}
      {modal?.kind === 'out' && <CheckOut l={modal.l} onClose={() => setModal(null)} />}
      {modal?.kind === 'reject' && <RejectLeave l={modal.l} onClose={() => setModal(null)} />}
    </>
  );
}
