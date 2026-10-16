import { useState } from 'react';
import { MessageSquare, Plus, LifeBuoy, Clock, CheckCheck, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { DataTable } from '../../components/DataTable';
import { options } from '../../data/labels';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  useConfirm,
  useToast,
} from '../../components/ui';
import { fmtDateTime, nowISO } from '../../lib/utils';
const CATS = ['Academic', 'Examination', 'Fees', 'Hostel', 'Transport', 'Library', 'IT / Wi-Fi', 'Certificates', 'Other'];
const STAFF = [
  'Support Desk',
  'Office Superintendent',
  'Hostel Warden',
  'System Administrator',
  'Finance Officer',
  'Examination Cell',
  'Librarian',
  'Transport Supervisor',
];
function NewTicket({ onClose }) {
  const { user } = useAuth();
  const { db, create, notify } = useData();
  const scope = useScope();
  const toast = useToast();
  const [f, setF] = useState({ category: 'Academic', subject: '', description: '', priority: 'Medium', studentId: scope.linked[0] ?? '' });
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!f.studentId) return setErr('Select the student this ticket is for.');
    if (f.subject.trim().length < 5) return setErr('Subject must be at least 5 characters.');
    if (f.description.trim().length < 10) return setErr('Please describe the issue (at least 10 characters).');
    try {
      const t = await create(
        'tickets',
        {
          ...f,
          priority: f.priority,
          ticketNo: 'TKT-' + Date.now().toString().slice(-6),
          studentId: f.studentId,
          raisedBy: user.id,
          raisedByName: user.name,
          status: 'Open',
          responses: [],
        },
        { audit: 'Raised' },
      );
      await notify({ role: 'it-admin', title: 'New support ticket', message: `${t.ticketNo}: ${f.subject}`, link: '/services/support' });
      toast.success(`Ticket ${t.ticketNo} submitted.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="New support request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Submit</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        {!scope.personal && (
          <Field label="Student" required>
            <Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
              <option value="">Select…</option>
              {options(db, 'students').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="form-grid">
          <Field label="Category" required>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" required>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              {['Low', 'Medium', 'High', 'Critical'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Subject" required>
          <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Description" required>
          <Textarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}
function TicketDetail({ t, onClose }) {
  const { user } = useAuth();
  const { db, update, can } = useData();
  const scope = useScope();
  const toast = useToast();
  const ticket = db.tickets.find((x) => x.id === t.id) ?? t;
  const staff = !scope.personal && can('support', 'view');
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState(ticket.status);
  const [assignee, setAssignee] = useState(ticket.assignedTo ?? '');
  const save = async () => {
    try {
      const responses = reply.trim()
        ? [...ticket.responses, { at: nowISO(), by: `${user.name}${staff ? '' : ' (requester)'}`, text: reply.trim() }]
        : ticket.responses;
      const history =
        status !== ticket.status
          ? [...responses, { at: nowISO(), by: user.name, text: `Status changed: ${ticket.status} → ${status}` }]
          : responses;
      await update(
        'tickets',
        ticket.id,
        { responses: history, status, assignedTo: assignee || undefined },
        { audit: status !== ticket.status ? `Status → ${status}` : 'Responded', details: ticket.ticketNo },
      );
      toast.success('Ticket updated.');
      setReply('');
      if (status === 'Resolved' || status === 'Closed') onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${ticket.ticketNo} · ${ticket.subject}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} disabled={!reply.trim() && status === ticket.status && assignee === (ticket.assignedTo ?? '')}>
            Save
          </Button>
        </>
      }
    >
      <div className="row mb-12">
        <Badge>{ticket.status}</Badge>
        <Badge>{ticket.priority}</Badge>
        <Badge tone="slate">{ticket.category}</Badge>
        <span className="muted">
          by {ticket.raisedByName} · {fmtDateTime(ticket.createdAt)}
        </span>
      </div>
      <p className="quote pre-line">{ticket.description}</p>
      <h4 className="section-label mt-16">Responses & resolution history</h4>
      <ul className="stack tight">
        {ticket.responses.length === 0 && <li className="muted">No responses yet.</li>}
        {ticket.responses.map((r, i) => (
          <li key={i} className="slot-row">
            <p className="xs muted">
              {r.by} · {fmtDateTime(r.at)}
            </p>
            <p>{r.text}</p>
          </li>
        ))}
      </ul>
      {ticket.status !== 'Closed' && (
        <div className="stack mt-16">
          <Field label="Add response">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          {staff && (
            <div className="form-grid">
              <Field label="Assign to">
                <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {STAFF.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {!staff && ticket.status === 'Resolved' && (
            <Button size="sm" variant="secondary" onClick={() => setStatus('Closed')}>
              Confirm resolved & close
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
export default function Support() {
  const { db, can, remove } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const del = async (t) => {
    const ok = await confirm({
      title: scope.personal ? 'Withdraw ticket?' : 'Delete ticket?',
      message: `${t.ticketNo}: ${t.subject}`,
      confirmLabel: scope.personal ? 'Withdraw' : 'Delete',
    });
    if (!ok) return;
    try {
      await remove('tickets', t.id, { audit: scope.personal ? 'Withdrawn' : 'Deleted', details: t.ticketNo });
      toast.success(scope.personal ? 'Ticket withdrawn.' : 'Ticket deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const rows = scope.personal ? db.tickets.filter((t) => scope.linked.includes(t.studentId ?? '')) : db.tickets;
  return (
    <>
      <PageHeader title="Student Support" subtitle="Support tickets with priority, assignment, responses and resolution history" />
      <div className="grid cols-4 stats">
        <StatCard label="Tickets" value={rows.length} icon={LifeBuoy} />
        <StatCard label="Open" value={rows.filter((t) => t.status === 'Open').length} icon={Clock} tone="blue" />
        <StatCard
          label="High / critical open"
          value={
            rows.filter((t) => (t.priority === 'High' || t.priority === 'Critical') && (t.status === 'Open' || t.status === 'In Progress'))
              .length
          }
          icon={AlertTriangle}
          tone="red"
        />
        <StatCard
          label="Resolved / closed"
          value={rows.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length}
          icon={CheckCheck}
          tone="green"
        />
      </div>
      <DataTable
        title="Support tickets"
        rows={rows}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        onRowClick={setView}
        toolbar={
          scope.personal || can('support', 'edit') ? (
            <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
              New ticket
            </Button>
          ) : undefined
        }
        emptyMessage={scope.personal ? 'Raise a ticket for academic, hostel, transport, fee or IT issues.' : undefined}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: ['Open', 'In Progress', 'Resolved', 'Closed'].map((v) => ({ value: v, label: v })),
            match: (r, v) => r.status === v,
          },
          {
            key: 'priority',
            label: 'Priority',
            options: ['Low', 'Medium', 'High', 'Critical'].map((v) => ({ value: v, label: v })),
            match: (r, v) => r.priority === v,
          },
          { key: 'category', label: 'Category', options: CATS.map((v) => ({ value: v, label: v })), match: (r, v) => r.category === v },
        ]}
        columns={[
          { key: 'ticketNo', header: 'Ticket' },
          { key: 'subject', header: 'Subject' },
          { key: 'category', header: 'Category' },
          ...(scope.personal ? [] : [{ key: 'raisedByName', header: 'Raised by' }]),
          { key: 'priority', header: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 'assignedTo', header: 'Assigned to' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'createdAt', header: 'Raised', render: (r) => fmtDateTime(r.createdAt) },
        ]}
        actions={(r) => (
          <>
            <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => setView(r)}>
              Open
            </Button>
            {(can('support', 'edit') || (scope.personal && r.status === 'Open')) && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="danger"
                title={scope.personal ? 'Withdraw' : 'Delete'}
                onClick={() => del(r)}
              />
            )}
          </>
        )}
      />
      {open && <NewTicket onClose={() => setOpen(false)} />}
      {view && <TicketDetail t={view} onClose={() => setView(null)} />}
    </>
  );
}
