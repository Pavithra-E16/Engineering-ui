import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  Award,
  BedDouble,
  CreditCard,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  IndianRupee,
  Landmark,
  MessageSquareText,
  Search,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../data/store';
import { useScope } from '../data/scope';
import { labelOf } from '../data/labels';
import { roleLabel } from '../lib/roles';
import { categoryOf, invBalance, ledger, sourceGroup } from '../lib/domain';
import { fmtDate, fmtDateTime, fmtMoney, pct, sum, todayISO } from '../lib/utils';
import { Badge, Card, EmptyState, Input, PageHeader, StatCard } from '../components/ui';
import { ShareBars, SimpleBar } from '../components/charts';
import { LedgerStats } from '../components/fees';
import { externalSummary } from './finance/Expenses';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Quick actions — large touch targets so staff can work from a phone. */
function QuickActions({ items }) {
  return (
    <div className="quick-grid mb-16">
      {items.map(({ to, label, icon: Icon, hint }) => (
        <Link key={to} to={to} className="quick-tile">
          <Icon />
          <span className="strong">{label}</span>
          {hint && <span className="xs muted">{hint}</span>}
        </Link>
      ))}
    </div>
  );
}

function StudentLookup() {
  const { db } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const hits = q.trim().length < 2 ? [] : db.students.filter((s) => `${s.name} ${s.rollNo}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6);
  return (
    <Card title="Find a student" className="mb-16">
      <div className="row nowrap">
        <Search className="icon-16 muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or roll number" aria-label="Find a student" />
      </div>
      {hits.length > 0 && (
        <ul className="stack tight mt-12">
          {hits.map((s) => (
            <li key={s.id}>
              <button className="dropdown-item" onClick={() => navigate(`/students/${s.id}`)}>
                <span className="strong">{s.name}</span>
                <span className="xs muted">
                  {s.rollNo} · {labelOf(db, 'departments', s.departmentId)} · Year {s.year}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FinanceSection() {
  const { db, ayId } = useData();
  const today = todayISO();
  const d = useMemo(() => {
    const inv = db.invoices.filter((i) => i.academicYearId === ayId && i.status !== 'Cancelled');
    const pays = db.payments;
    const todayPays = pays.filter((p) => p.date === today);
    const internal = sum(pays.filter((p) => categoryOf(db, p.feeHeadId) === 'Internal').map((p) => p.amount));
    const external = sum(pays.map((p) => p.amount)) - internal;
    const ext = externalSummary(db);
    const months = [...new Set([...pays.map((p) => p.date.slice(0, 7)), ...db.expenses.map((e) => e.date.slice(0, 7))])].filter((m) => m <= today.slice(0, 7)).sort().slice(-6);
    const trend = months.map((m) => ({
      month: MONTHS[Number(m.slice(5)) - 1],
      Collected: Math.round(sum(pays.filter((p) => p.date.startsWith(m)).map((p) => p.amount)) / 1e4) / 10,
      Spent: Math.round(sum(db.expenses.filter((e) => e.status === 'Paid' && e.date.startsWith(m)).map((e) => e.amount)) / 1e4) / 10,
    }));
    const overdueStudents = new Set(inv.filter((i) => invBalance(i) > 0 && i.dueDate < today).map((i) => i.studentId)).size;
    const byMode = Object.entries(pays.reduce((a, p) => ((a[p.mode] = (a[p.mode] ?? 0) + p.amount), a), {}))
      .map(([label, value]) => ({ label, value: Math.round(value / 1000), sub: 'thousand ₹' }))
      .sort((a, b) => b.value - a.value);
    return {
      todayAmt: sum(todayPays.map((p) => p.amount)),
      todayN: todayPays.length,
      collected: sum(inv.map((i) => i.paid)),
      outstanding: sum(inv.map(invBalance)),
      overdueStudents,
      internal,
      external,
      remitted: sum(ext.map((x) => x.remitted)),
      payable: sum(ext.map((x) => x.payable)),
      trend,
      byMode,
      recent: [...pays].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6),
    };
  }, [db, ayId, today]);
  return (
    <>
      <h3 className="section-title">Accounts & Finance</h3>
      <div className="grid cols-4 stats">
        <StatCard label="Collected today" value={fmtMoney(d.todayAmt)} icon={ArrowDownLeft} tone="green" hint={`${d.todayN} receipts`} />
        <StatCard label="Collected this year" value={fmtMoney(d.collected)} icon={Wallet} tone="blue" />
        <StatCard label="Outstanding fees" value={fmtMoney(d.outstanding)} icon={IndianRupee} tone="red" hint={`${d.overdueStudents} students past cut-off`} />
        <StatCard label="Paid to external parties" value={fmtMoney(d.remitted)} icon={Landmark} tone="violet" hint={`${fmtMoney(d.payable)} still payable`} />
      </div>
      <div className="grid cols-3 mb-16">
        <Card title="Collections vs expenditure" subtitle="Last six months · ₹ lakh" className="span-2">
          <SimpleBar
            data={d.trend}
            x="month"
            bars={[
              { key: 'Collected', label: 'Collected' },
              { key: 'Spent', label: 'Spent' },
            ]}
            unit=" L"
            height={230}
          />
        </Card>
        <Card title="What the college collects">
          <ShareBars
            items={[
              { label: 'Internal fees (college)', value: Math.round(d.internal / 1000), sub: 'thousand ₹' },
              { label: 'External fees (university/exam)', value: Math.round(d.external / 1000), sub: 'thousand ₹' },
              { label: 'Remitted to external parties', value: Math.round(d.remitted / 1000), sub: 'thousand ₹' },
            ]}
          />
          <h4 className="mt-16 mb-8">By payment mode</h4>
          <ShareBars items={d.byMode} />
        </Card>
      </div>
      <Card title="Latest receipts" actions={<Link to="/finance/reports">Daily report →</Link>} className="mb-16">
        <ul className="stack tight">
          {d.recent.map((p) => (
            <li key={p.id} className="row between nowrap">
              <span className="truncate">
                <b>{fmtMoney(p.amount)}</b> · {labelOf(db, 'students', p.studentId)}
              </span>
              <span className="xs muted nowrap">
                {p.mode} · {fmtDate(p.date)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function AdmissionsSection() {
  const { db } = useData();
  const e = db.enquiries;
  const by = (s) => e.filter((x) => x.stage === s).length;
  const src = Object.values(
    e
      .filter((x) => x.stage === 'Admitted')
      .reduce((a, x) => {
        const g = sourceGroup(x.source);
        a[g] ||= { label: g, value: 0 };
        a[g].value++;
        return a;
      }, {}),
  ).sort((a, b) => b.value - a.value);
  return (
    <>
      <h3 className="section-title">Admissions</h3>
      <div className="grid cols-3 mb-16">
        <Card title="Admission funnel">
          <ShareBars
            items={[
              { label: 'Enquiries', value: e.length },
              { label: 'Follow-up', value: by('Follow-up') },
              { label: 'Registered', value: by('Registered') + by('Admitted') },
              { label: 'Admitted', value: by('Admitted'), sub: `${pct(by('Admitted'), e.length)}%` },
            ]}
          />
        </Card>
        <Card title="Admissions by source" actions={<Link to="/admissions?tab=sources">Details →</Link>}>
          <ShareBars items={src.slice(0, 6)} />
        </Card>
        <Card title="Recent enquiries">
          <ul className="stack tight">
            {[...e]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 6)
              .map((x) => (
                <li key={x.id} className="row between nowrap">
                  <span className="truncate">
                    {x.name} <span className="xs muted">· {labelOf(db, 'programs', x.programId)}</span>
                  </span>
                  <Badge>{x.stage}</Badge>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function OfficeSection() {
  const { user } = useAuth();
  const { db, can } = useData();
  const mine = (h) => !user?.hostelId || h === user.hostelId;
  const leaves = db.hostelLeaves.filter((l) => mine(l.hostelId));
  const cards = [
    can('certificates') && { label: 'Pending certificates', value: db.certificates.filter((c) => c.status === 'Pending').length, icon: Award, tone: 'amber', to: '/certificates' },
    can('hostel-leave') && { label: 'Pending leave requests', value: leaves.filter((l) => l.status === 'Pending').length, icon: DoorOpen, tone: 'amber', to: '/hostel/leave' },
    can('hostel-leave') && { label: 'Out of hostel now', value: leaves.filter((l) => l.status === 'Checked Out').length, icon: BedDouble, tone: 'violet', to: '/hostel/leave?tab=out' },
    can('students') && { label: 'Active students', value: db.students.filter((s) => s.status === 'Active').length, icon: Users, tone: 'blue', to: '/students' },
    can('sms') && { label: 'SMS sent today', value: db.smsLogs.filter((s) => s.sentAt?.slice(0, 10) === todayISO()).length, icon: MessageSquareText, tone: 'green', to: '/sms' },
  ].filter(Boolean);
  if (!cards.length) return null;
  return (
    <div className="grid cols-4 stats">
      {cards.slice(0, 4).map((c) => (
        <Link key={c.label} to={c.to} className="plain-link">
          <StatCard label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
        </Link>
      ))}
    </div>
  );
}

function StudentHome() {
  const { db, ayId } = useData();
  const scope = useScope();
  const st = scope.linkedStudent;
  if (!st) return <EmptyState title="Account not linked" message="Your login is not linked to a student record. Contact the college office." />;
  const l = ledger(db, st.id, ayId);
  const certs = db.certificates;
  const leave = [...db.hostelLeaves].sort((a, b) => b.fromAt.localeCompare(a.fromAt))[0];
  return (
    <>
      <QuickActions
        items={[
          { to: '/finance/fees', label: 'My fees', icon: CreditCard, hint: l.balance ? `${fmtMoney(l.balance)} due` : 'All paid' },
          { to: '/certificates', label: 'Certificates', icon: Award, hint: `${certs.filter((c) => c.status === 'Approved').length} ready` },
          ...(db.hostelAllocations.length ? [{ to: '/hostel/leave', label: 'Hostel leave', icon: DoorOpen, hint: leave ? leave.status : 'Request' }] : []),
          { to: `/students/${st.id}`, label: 'My profile', icon: GraduationCap },
        ]}
      />
      <LedgerStats l={l} />
      <div className="grid cols-2">
        <Card title="My details">
          <dl className="details">
            {[
              ['Roll number', st.rollNo],
              ['Program', labelOf(db, 'programs', st.programId)],
              ['Year / batch', `${st.year} · ${st.batch}`],
              ['Parent', st.parentName],
              ['Scholarship', st.scholarshipScheme],
              ['Discount', st.discountReason],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="My certificates" actions={<Link to="/certificates">Open →</Link>}>
          {!certs.length ? (
            <EmptyState title="No requests yet" />
          ) : (
            <ul className="stack tight">
              {certs.map((c) => (
                <li key={c.id} className="row between nowrap">
                  <span>{c.type}</span>
                  <Badge>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { can, db } = useData();
  const scope = useScope();
  const role = user?.role;
  const finance = can('finance-reports');
  const quick = [
    can('admissions', 'edit') && { to: '/admissions', label: 'New enquiry', icon: UserPlus },
    can('fees', 'edit') && { to: '/finance/fees', label: 'Collect fee', icon: Wallet },
    can('students') && { to: '/students', label: 'Students', icon: Users },
    can('certificates') && { to: '/certificates', label: 'Certificates', icon: Award },
    can('hostel-leave') && { to: '/hostel/leave', label: 'Leave & out-pass', icon: DoorOpen },
    can('finance-reports') && { to: '/finance/reports', label: 'Daily report', icon: FileBarChart },
  ].filter(Boolean);
  const notes = db.notifications.filter((n) => n.role === role).slice(0, 4);
  return (
    <>
      <PageHeader title={`${greeting()}, ${user?.name?.split(' ').slice(role === 'student' ? 0 : 1, 3).join(' ') || user?.name}`} subtitle={`${roleLabel(role)} dashboard · ${fmtDate(todayISO())}`} />
      {scope.personal ? (
        <StudentHome />
      ) : (
        <>
          <QuickActions items={quick} />
          {(role === 'staff' || role === 'warden' || role === 'admission') && can('students') && <StudentLookup />}
          <OfficeSection />
          {finance && <FinanceSection />}
          {can('admissions') && role !== 'staff' && <AdmissionsSection />}
          {notes.length > 0 && (
            <Card title="Notifications">
              <ul className="stack tight">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link to={n.link ?? '/dashboard'} className="strong">
                      {n.title}
                    </Link>
                    <p className="xs muted">
                      {n.message} · {fmtDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
