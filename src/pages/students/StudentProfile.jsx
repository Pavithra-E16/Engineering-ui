import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, BedDouble, LogOut, MessageSquareText, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { labelOf } from '../../data/labels';
import { LedgerStats } from '../../components/fees';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, useToast } from '../../components/ui';
import { ACTIVITY_TYPES, categoryOf, headOf, invBalance, ledger } from '../../lib/domain';
import { SMS_TEMPLATES, maskPhone, toParent, useSms } from '../../lib/sms';
import { fmtDate, fmtDateTime, fmtMoney, initials, todayISO } from '../../lib/utils';
import { ForbiddenPage, NotFoundPage } from '../Errors';
import { Relieve } from './Students';

function AddActivity({ st, onClose }) {
  const { create, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const [f, setF] = useState({ type: 'Achievement', title: '', date: todayISO(), details: '', notify: true });
  const save = async () => {
    if (!f.title.trim()) return toast.error('Enter a title.');
    try {
      await create('studentActivities', { studentId: st.id, type: f.type, title: f.title.trim(), date: f.date, details: f.details || undefined, smsSent: f.notify });
      if (f.notify) await sms([toParent(st, 'Student Activity', SMS_TEMPLATES.activity({ st, title: f.title.trim() }, settings))]);
      toast.success(`Activity recorded${f.notify ? ' and parent notified by SMS' : ''}.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record activity · ${st.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Type">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Title" required>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Details">
          <Textarea value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
        </Field>
        <label className="check-row">
          <input type="checkbox" className="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} />
          Send SMS update to parent ({st.parentName})
        </label>
      </div>
    </Modal>
  );
}

const Item = ({ k, v }) => (
  <div>
    <dt>{k}</dt>
    <dd>{v || '—'}</dd>
  </div>
);

export default function StudentProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { db, ayId, can } = useData();
  const [modal, setModal] = useState(null);
  const own = user?.role === 'student' && user.studentId === id;
  if (!own && !can('students')) return <ForbiddenPage />;
  const st = db.students.find((s) => s.id === id);
  if (!st) return <NotFoundPage />;
  const l = ledger(db, st.id, ayId);
  const enq = db.enquiries.find((e) => e.studentId === st.id || e.id === st.enquiryId);
  const acts = db.studentActivities.filter((a) => a.studentId === st.id).sort((a, b) => b.date.localeCompare(a.date));
  const certs = db.certificates.filter((c) => c.studentId === st.id);
  const alloc = db.hostelAllocations.find((a) => a.studentId === st.id && a.status === 'Allocated');
  const room = alloc && db.hostelRooms.find((r) => r.id === alloc.roomId);
  const leaves = db.hostelLeaves.filter((x) => x.studentId === st.id).sort((a, b) => b.fromAt.localeCompare(a.fromAt));
  const sms = db.smsLogs.filter((x) => x.studentId === st.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const editStudent = can('students', 'edit');
  const fullContact = own || ['principal', 'admin', 'finance', 'admission', 'warden'].includes(user?.role);
  const phone = (p) => (fullContact ? p : maskPhone(p));
  const steps = [
    enq && { t: 'Enquiry', d: enq.date, s: `${enq.source}${enq.referenceBy ? ` · ref. ${enq.referenceBy}` : ''}` },
    enq?.registeredOn && { t: 'Registration', d: enq.registeredOn, s: enq.registrationNo },
    { t: 'Admission', d: st.admissionDate, s: `${st.admissionNo} · ${st.quota ?? ''}` },
    st.relievedOn && { t: st.status, d: st.relievedOn, s: st.relievingReason },
  ].filter(Boolean);
  return (
    <>
      <PageHeader
        title={own ? 'My Profile' : st.name}
        subtitle={`${st.rollNo} · ${labelOf(db, 'programs', st.programId)} · Year ${st.year}`}
        actions={
          editStudent &&
          st.status === 'Active' && (
            <Button variant="secondary" icon={LogOut} onClick={() => setModal('relieve')}>
              Relieve
            </Button>
          )
        }
      />
      <div className="grid cols-3 mb-16">
        <Card>
          <div className="profile-card">
            <span className="avatar lg">{initials(st.name)}</span>
            <p className="strong mt-12">{st.name}</p>
            <p className="muted">{st.rollNo}</p>
            <Badge>{st.status}</Badge>
          </div>
          <dl className="details mt-16">
            <Item k="Admission no" v={st.admissionNo} />
            <Item k="Department" v={labelOf(db, 'departments', st.departmentId)} />
            <Item k="Batch" v={st.batch} />
            <Item k="Date of birth" v={fmtDate(st.dob)} />
            <Item k="Category / quota" v={`${st.category ?? '—'} · ${st.quota ?? '—'}`} />
            <Item k="Admission source" v={st.admissionSource} />
          </dl>
        </Card>
        <Card title="Contact">
          <dl className="details">
            <Item k="Student mobile" v={phone(st.phone)} />
            <Item k="Email" v={st.email} />
            <Item k="Parent / guardian" v={`${st.parentName} (${st.parentRelation ?? 'Parent'})`} />
            <Item k="Parent mobile (SMS)" v={phone(st.parentPhone)} />
            <div className="full">
              <dt>Address</dt>
              <dd>{st.address || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Student lifecycle">
          <ol className="timeline">
            {steps.map((x) => (
              <li key={x.t}>
                <p className="strong">
                  {x.t} <span className="muted small">· {fmtDate(x.d)}</span>
                </p>
                <p className="xs muted">{x.s}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <Card
        title={
          <span className="row">
            <Wallet className="icon-16" />
            Fees · {labelOf(db, 'academicYears', ayId)}
          </span>
        }
        subtitle={[st.scholarshipScheme && `Scholarship: ${st.scholarshipScheme}`, st.discountReason && `Discount: ${st.discountReason}`].filter(Boolean).join(' · ') || 'No scholarship or discount'}
        actions={
          <Link className="btn btn-secondary btn-sm" to={own ? '/finance/fees' : `/finance/fees?q=${encodeURIComponent(st.rollNo)}`}>
            {own ? 'Pay / view receipts' : 'Open in Student Fees'}
          </Link>
        }
        className="mb-16"
      >
        <LedgerStats l={l} />
        <div className="bordered table-scroll">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Fee head</th>
                <th>Category</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Concession</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th>Cut-off</th>
                <th>Receipts</th>
              </tr>
            </thead>
            <tbody>
              {l.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="strong">{headOf(db, i.feeHeadId)?.name ?? i.description}</td>
                  <td>
                    <Badge>{categoryOf(db, i.feeHeadId)}</Badge>
                  </td>
                  <td className="text-right">{fmtMoney(i.amount)}</td>
                  <td className="text-right">{fmtMoney((i.discount ?? 0) + (i.scholarship ?? 0))}</td>
                  <td className="text-right">{fmtMoney(i.paid)}</td>
                  <td className="text-right strong">{fmtMoney(invBalance(i))}</td>
                  <td>{fmtDate(i.dueDate)}</td>
                  <td className="xs">
                    {db.payments
                      .filter((p) => p.invoiceId === i.id)
                      .map((p) => p.receiptNo)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid cols-2 mb-16">
        <Card
          title="Activities"
          actions={
            editStudent && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setModal('activity')}>
                Add
              </Button>
            )
          }
          bodyClass="scroll"
        >
          {!acts.length ? (
            <EmptyState title="No activities recorded" />
          ) : (
            <ul className="stack tight">
              {acts.map((a) => (
                <li key={a.id} className="row between nowrap">
                  <span>
                    <Badge>{a.type}</Badge> {a.title}
                  </span>
                  <span className="xs muted nowrap">{fmtDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={
            <span className="row">
              <Award className="icon-16" />
              Certificates
            </span>
          }
          actions={
            <Link className="btn btn-secondary btn-sm" to="/certificates">
              {own ? 'Request / download' : 'Open certificates'}
            </Link>
          }
          bodyClass="scroll"
        >
          {!certs.length ? (
            <EmptyState title="No certificate requests" />
          ) : (
            <ul className="stack tight">
              {certs.map((c) => (
                <li key={c.id} className="row between nowrap">
                  <span>
                    {c.type} <span className="xs muted">· {c.requestNo}</span>
                  </span>
                  <Badge>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={
            <span className="row">
              <BedDouble className="icon-16" />
              Hostel
            </span>
          }
          bodyClass="scroll"
        >
          {!alloc ? (
            <EmptyState title="Not a hosteller" />
          ) : (
            <>
              <p className="mb-12">
                <b>{labelOf(db, 'hostels', alloc.hostelId)}</b> · Room {room?.roomNo} ({room?.type}) · Bed {alloc.bedNo ?? '—'}
                <br />
                <span className="xs muted">Provisions: {(alloc.provisions ?? []).join(', ') || '—'}</span>
              </p>
              <ul className="stack tight">
                {leaves.slice(0, 6).map((x) => (
                  <li key={x.id} className="row between nowrap">
                    <span className="small">
                      {x.leaveType} · {fmtDateTime(x.fromAt)} {x.pickupRelation && <span className="muted">· {x.pickupRelation}</span>}
                    </span>
                    <Badge>{x.status}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        {!own && (
          <Card
            title={
              <span className="row">
                <MessageSquareText className="icon-16" />
                SMS sent to parent
              </span>
            }
            bodyClass="scroll"
          >
            {!sms.length ? (
              <EmptyState title="No SMS sent" />
            ) : (
              <ul className="stack tight">
                {sms.slice(0, 12).map((x) => (
                  <li key={x.id}>
                    <p className="small">
                      <Badge>{x.type}</Badge> <span className="xs muted">{fmtDateTime(x.sentAt)}</span>
                    </p>
                    <p className="xs muted">{x.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
      {modal === 'activity' && <AddActivity st={st} onClose={() => setModal(null)} />}
      {modal === 'relieve' && <Relieve st={st} onClose={() => setModal(null)} />}
    </>
  );
}
