import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, FilePlus2, HandCoins, Printer, Undo2 } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { CollectPayment, GatewayCheckout, LedgerStats, printReceipt } from '../../components/fees';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { PAYMENT_MODES, categoryOf, headOf, invBalance, invNet, invStatus, ledger } from '../../lib/domain';
import { fmtDate, fmtMoney, sum, todayISO } from '../../lib/utils';

/** Bulk-raise fee demands for a program from its fee structure (concessions applied to tuition). */
function GenerateDemands({ onClose }) {
  const { db, ayId, create } = useData();
  const toast = useToast();
  const [fsId, setFsId] = useState('');
  const [due, setDue] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const fs = db.feeStructures.find((f) => f.id === fsId);
  const plan = useMemo(() => {
    if (!fs) return [];
    const out = [];
    db.students
      .filter((s) => s.programId === fs.programId && s.status === 'Active' && s.active !== false)
      .forEach((s) => {
        const items = fs.items.filter((it) => !headOf(db, it.feeHeadId)?.oneTime || s.year === 1);
        const alloc = s.hosteller && db.hostelAllocations.find((a) => a.studentId === s.id && a.status === 'Allocated');
        const room = alloc && db.hostelRooms.find((r) => r.id === alloc.roomId);
        const hostelHead = db.feeHeads.find((h) => h.hostelOnly);
        if (room && hostelHead) items.push({ feeHeadId: hostelHead.id, amount: room.fee });
        items.forEach((it) => {
          if (db.invoices.some((i) => i.studentId === s.id && i.feeHeadId === it.feeHeadId && i.academicYearId === ayId && i.status !== 'Cancelled')) return;
          const tuition = headOf(db, it.feeHeadId)?.code === 'TUI';
          out.push({ s, it, discount: tuition ? Math.min(s.discountAmount ?? 0, it.amount) : 0, scholarship: tuition ? Math.min(s.scholarshipAmount ?? 0, it.amount) : 0 });
        });
      });
    return out;
  }, [db, fs, ayId]);
  const go = async () => {
    setBusy(true);
    try {
      let n = 1;
      for (const { s, it, discount, scholarship } of plan) {
        const inv = {
          invoiceNo: `FD-${Date.now().toString().slice(-6)}-${n++}`,
          studentId: s.id,
          academicYearId: ayId,
          feeStructureId: fs.id,
          feeHeadId: it.feeHeadId,
          description: `${headOf(db, it.feeHeadId)?.name} ${labelOf(db, 'academicYears', ayId)}`,
          amount: it.amount,
          discount,
          scholarship,
          concessionNote: [s.scholarshipScheme, s.discountReason].filter(Boolean).join(' · ') || undefined,
          dueDate: due,
          paid: 0,
        };
        await create('invoices', { ...inv, status: invStatus(inv) }, { audit: false });
      }
      toast.success(`${plan.length} fee demand(s) raised.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const students = new Set(plan.map((p) => p.s.id)).size;
  return (
    <Modal
      open
      onClose={onClose}
      title="Raise fee demands from fee structure"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={!plan.length}>
            Raise {plan.length || ''} demands
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Fee structure" required>
          <Select value={fsId} onChange={(e) => setFsId(e.target.value)}>
            <option value="">Select…</option>
            {options(db, 'feeStructures', (f) => f.academicYearId === ayId).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment cut-off date" required>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {fs && (
          <p className="muted">
            {plan.length} demand(s) for {students} active student(s) who do not have them yet. Admission fee applies to 1st-year students only, hostel
            fee to hostellers, and recorded scholarships/discounts are deducted from tuition.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** One student's fee card: demands, receipts and actions. */
export function StudentFeeCard({ student, onClose, onCollect }) {
  const { db, ayId, can, settings } = useData();
  const l = ledger(db, student.id, ayId);
  const rc = db.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Modal
      open
      onClose={onClose}
      title={`${student.name} (${student.rollNo})`}
      size="xl"
      footer={
        <>
          <Link className="btn btn-secondary left" to={`/students/${student.id}`}>
            Open student profile
          </Link>
          {can('fees', 'edit') && l.balance > 0 && (
            <Button icon={HandCoins} onClick={onCollect}>
              Collect fee
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <p className="muted mb-12">
        {labelOf(db, 'programs', student.programId)} · Year {student.year} · {student.quota} · Parent {student.parentName} ({student.parentPhone})
        {student.scholarshipScheme && <> · Scholarship: {student.scholarshipScheme}</>}
        {student.discountReason && <> · Discount: {student.discountReason}</>}
      </p>
      <LedgerStats l={l} />
      <div className="bordered mb-16">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Fee head</th>
              <th>Category</th>
              <th className="text-right">Fee</th>
              <th className="text-right">Discount</th>
              <th className="text-right">Scholarship</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Balance</th>
              <th>Cut-off</th>
              <th>Status</th>
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
                <td className="text-right">{i.discount ? fmtMoney(i.discount) : '—'}</td>
                <td className="text-right">{i.scholarship ? fmtMoney(i.scholarship) : '—'}</td>
                <td className="text-right">{fmtMoney(i.paid)}</td>
                <td className="text-right strong">{fmtMoney(invBalance(i))}</td>
                <td className={invBalance(i) && i.dueDate < todayISO() ? 'text-red' : ''}>{fmtDate(i.dueDate)}</td>
                <td>
                  <Badge>{i.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="mb-8">Receipts</h4>
      <div className="bordered">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Fee head</th>
              <th>Mode</th>
              <th className="text-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rc.map((p) => (
              <tr key={p.id}>
                <td>{p.receiptNo}</td>
                <td>{fmtDate(p.date)}</td>
                <td>{headOf(db, p.feeHeadId)?.name}</td>
                <td>{p.mode}</td>
                <td className="text-right">{fmtMoney(p.amount)}</td>
                <td className="text-right">
                  <Button size="sm" variant="ghost" icon={Printer} title="Print receipt" onClick={() => printReceipt(db, [p], settings)} />
                </td>
              </tr>
            ))}
            {!rc.length && (
              <tr>
                <td colSpan={6} className="muted text-center">
                  No receipts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function MyFees() {
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const st = scope.linkedStudent;
  const [sel, setSel] = useState([]);
  const [pay, setPay] = useState(null);
  if (!st) return <Alert tone="warning">Your account is not linked to a student record. Contact the college office.</Alert>;
  const l = ledger(db, st.id, ayId);
  const due = l.invoices.filter((i) => invBalance(i) > 0);
  const chosen = due.filter((i) => sel.includes(i.id));
  return (
    <>
      <LedgerStats l={l} />
      {due.length > 0 && (
        <div className="mb-16">
          <Alert tone="warning" title="Fees due">
            You have {fmtMoney(l.balance)} outstanding. Payment cut-off date: <b>{fmtDate(l.nextDue)}</b>. Select the fee heads below and pay
            online, or pay at the accounts office.
          </Alert>
        </div>
      )}
      <DataTable
        title="My fee details"
        rows={l.invoices}
        hideExport
        toolbar={
          due.length > 0 && (
            <Button size="sm" icon={CreditCard} disabled={!chosen.length} onClick={() => setPay(chosen)}>
              Pay {chosen.length ? fmtMoney(sum(chosen.map(invBalance))) : 'selected'} online
            </Button>
          )
        }
        columns={[
          {
            key: 'sel',
            header: '',
            sortable: false,
            exportable: false,
            render: (r) =>
              invBalance(r) > 0 ? (
                <input
                  type="checkbox"
                  className="checkbox"
                  aria-label={`Select ${r.description}`}
                  checked={sel.includes(r.id)}
                  onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))}
                />
              ) : null,
          },
          { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name ?? r.description },
          { key: 'cat', header: 'Category', value: (r) => categoryOf(db, r.feeHeadId), render: (r) => <Badge>{categoryOf(db, r.feeHeadId)}</Badge> },
          { key: 'amount', header: 'Fee', value: (r) => r.amount, render: (r) => fmtMoney(r.amount) },
          { key: 'conc', header: 'Concession', value: (r) => (r.discount ?? 0) + (r.scholarship ?? 0), render: (r) => fmtMoney((r.discount ?? 0) + (r.scholarship ?? 0)) },
          { key: 'paid', header: 'Paid', value: (r) => r.paid, render: (r) => fmtMoney(r.paid) },
          { key: 'bal', header: 'Balance', value: invBalance, render: (r) => <b>{fmtMoney(invBalance(r))}</b> },
          { key: 'dueDate', header: 'Cut-off date', render: (r) => fmtDate(r.dueDate) },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
      />
      <div className="mt-16">
        <DataTable
          title="My receipts"
          rows={db.payments.filter((p) => p.studentId === st.id)}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'receiptNo', header: 'Receipt' },
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
            { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => fmtMoney(r.amount) },
            { key: 'mode', header: 'Mode' },
          ]}
          actions={(r) => <Button size="sm" variant="ghost" icon={Printer} title="Print receipt" onClick={() => printReceipt(db, [r], settings)} />}
        />
      </div>
      {pay && (
        <GatewayCheckout
          student={st}
          invoices={pay}
          onClose={() => {
            setPay(null);
            setSel([]);
          }}
        />
      )}
    </>
  );
}

export default function Fees() {
  const { db, ayId, can, settings, remove, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const [card, setCard] = useState(null);
  const [collect, setCollect] = useState(null);
  const [gen, setGen] = useState(false);
  const edit = can('fees', 'edit');
  const rows = useMemo(
    () =>
      db.students
        .filter((s) => s.active !== false && s.status !== 'Course Completed')
        .map((s) => ({ ...s, l: ledger(db, s.id, ayId) }))
        .filter((s) => s.l.invoices.length),
    [db, ayId],
  );
  if (scope.personal)
    return (
      <>
        <PageHeader title="My Fees" subtitle="Total fees, discounts, scholarships, payments and outstanding balance" />
        <MyFees />
      </>
    );
  const reverse = async (p) => {
    const inv = db.invoices.find((i) => i.id === p.invoiceId);
    const ok = await confirm({
      title: 'Reverse receipt?',
      message: `Reverse receipt ${p.receiptNo} for ${fmtMoney(p.amount)}? The amount is added back to the student's balance. Use only for bounced or wrongly recorded payments.`,
      confirmLabel: 'Reverse receipt',
    });
    if (!ok) return;
    try {
      await remove('payments', p.id, { audit: 'Reversed receipt', details: `${p.receiptNo} ${fmtMoney(p.amount)}` });
      if (inv) {
        const paid = Math.max(0, inv.paid - p.amount);
        await update('invoices', inv.id, { paid, status: invStatus({ ...inv, paid }) }, { audit: false });
      }
      toast.success('Receipt reversed and balance restored.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const stu = (id) => db.students.find((s) => s.id === id);
  const deptFilter = (get) => ({
    key: 'dept',
    label: 'Department',
    options: db.departments.map((d) => ({ value: d.id, label: d.code })),
    match: (r, v) => get(r)?.departmentId === v,
  });
  const yearFilter = (get) => ({
    key: 'year',
    label: 'Year',
    options: [1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` })),
    match: (r, v) => String(get(r)?.year) === v,
  });
  const totals = {
    gross: sum(rows.map((r) => r.l.gross)),
    discount: sum(rows.map((r) => r.l.discount)),
    scholarship: sum(rows.map((r) => r.l.scholarship)),
    net: sum(rows.map((r) => r.l.net)),
    paid: sum(rows.map((r) => r.l.paid)),
    balance: sum(rows.map((r) => r.l.balance)),
  };
  return (
    <>
      <PageHeader title="Student Fees" subtitle="Complete fee records: total fees, amount paid, outstanding balance, discounts and scholarships" />
      <LedgerStats l={totals} />
      <UrlTabs
        tabs={[
          { id: 'ledger', label: 'Student fee ledger' },
          { id: 'demands', label: 'Fee demands' },
          { id: 'receipts', label: 'Receipts' },
          { id: 'concessions', label: 'Discounts & scholarships' },
        ]}
      >
        {(t) => {
          switch (t) {
            case 'ledger':
              return (
                <DataTable
                  title="Student fee ledger"
                  exportName="student-fee-ledger"
                  rows={rows}
                  initialSort={{ key: 'balance', dir: 'desc' }}
                  onRowClick={(r) => setCard(r)}
                  filters={[
                    deptFilter((r) => r),
                    yearFilter((r) => r),
                    {
                      key: 'dues',
                      label: 'Dues',
                      options: [
                        { value: 'due', label: 'Has outstanding' },
                        { value: 'overdue', label: 'Overdue (past cut-off)' },
                        { value: 'clear', label: 'Fully paid' },
                      ],
                      match: (r, v) => (v === 'clear' ? r.l.balance === 0 : v === 'overdue' ? r.l.balance > 0 && r.l.nextDue < todayISO() : r.l.balance > 0),
                    },
                    {
                      key: 'conc',
                      label: 'Concession',
                      options: [
                        { value: 'sch', label: 'Scholarship' },
                        { value: 'dis', label: 'Discount' },
                      ],
                      match: (r, v) => (v === 'sch' ? r.l.scholarship > 0 : r.l.discount > 0),
                    },
                  ]}
                  columns={[
                    { key: 'rollNo', header: 'Roll no' },
                    { key: 'name', header: 'Student' },
                    { key: 'dept', header: 'Dept / Yr', value: (r) => `${labelOf(db, 'departments', r.departmentId)} · ${r.year}` },
                    { key: 'gross', header: 'Total fee', value: (r) => r.l.gross, render: (r) => fmtMoney(r.l.gross), className: 'text-right' },
                    { key: 'conc', header: 'Disc. + Schol.', value: (r) => r.l.discount + r.l.scholarship, render: (r) => fmtMoney(r.l.discount + r.l.scholarship), className: 'text-right' },
                    { key: 'paid', header: 'Paid', value: (r) => r.l.paid, render: (r) => fmtMoney(r.l.paid), className: 'text-right' },
                    { key: 'balance', header: 'Outstanding', value: (r) => r.l.balance, render: (r) => <b className={r.l.balance ? 'text-red' : 'text-green'}>{fmtMoney(r.l.balance)}</b>, className: 'text-right' },
                    { key: 'next', header: 'Next cut-off', value: (r) => r.l.nextDue ?? '', render: (r) => fmtDate(r.l.nextDue) },
                  ]}
                  actions={(r) =>
                    edit && r.l.balance > 0 ? (
                      <Button size="sm" variant="ghost" icon={HandCoins} onClick={() => setCollect(r)}>
                        Collect
                      </Button>
                    ) : null
                  }
                />
              );
            case 'demands':
              return (
                <EntityPage
                  config={{
                    collection: 'invoices',
                    title: 'Fee demands',
                    singular: 'Fee Demand',
                    module: 'fees',
                    ayFiltered: true,
                    noDeactivate: true,
                    initialSort: { key: 'dueDate', dir: 'asc' },
                    defaults: ({ ayId: a }) => ({ academicYearId: a, paid: 0, discount: 0, scholarship: 0, invoiceNo: 'FD-' + Date.now().toString().slice(-7) }),
                    toolbar: edit ? (
                      <Button size="sm" variant="secondary" icon={FilePlus2} onClick={() => setGen(true)}>
                        Raise from fee structure
                      </Button>
                    ) : undefined,
                    canEditRow: (r) => r.status !== 'Paid' || r.paid === 0,
                    canDeleteRow: (r) => r.paid === 0,
                    beforeSave: (f, prev, d) => {
                      const next = { ...prev, ...f, paid: prev?.paid ?? 0 };
                      return { ...f, description: f.description || `${headOf(d, f.feeHeadId)?.name}`, status: invStatus(next) };
                    },
                    rowActions: (r) =>
                      edit && invBalance(r) > 0 ? (
                        <Button size="sm" variant="ghost" icon={HandCoins} onClick={() => setCollect(stu(r.studentId))} title="Collect fee" />
                      ) : null,
                    fields: [
                      { key: 'invoiceNo', label: 'Demand no', required: true, unique: true },
                      { key: 'studentId', label: 'Student', type: 'ref', ref: 'students', required: true, refFilter: (s) => s.status === 'Active' },
                      { key: 'feeHeadId', label: 'Fee head', type: 'ref', ref: 'feeHeads', required: true, filter: true },
                      {
                        key: 'category',
                        label: 'Category',
                        form: false,
                        value: (r, d) => categoryOf(d, r.feeHeadId),
                        render: (r, d) => <Badge>{categoryOf(d, r.feeHeadId)}</Badge>,
                      },
                      { key: 'description', label: 'Description', table: false },
                      { key: 'amount', label: 'Fee amount', type: 'money', min: 1, required: true },
                      {
                        key: 'discount',
                        label: 'Discount',
                        type: 'money',
                        min: 0,
                        table: false,
                        validate: (v, f) => (Number(v || 0) + Number(f.scholarship || 0) > Number(f.amount) ? 'Discount + scholarship exceed the fee' : undefined),
                      },
                      { key: 'scholarship', label: 'Scholarship', type: 'money', min: 0, table: false },
                      { key: 'concessionNote', label: 'Concession details', table: false, hint: 'Scheme / reason for the discount or scholarship' },
                      { key: 'net', label: 'Net payable', form: false, value: (r) => invNet(r), render: (r) => fmtMoney(invNet(r)) },
                      { key: 'paid', label: 'Paid', type: 'money', form: false },
                      { key: 'balance', label: 'Balance', form: false, value: (r) => invBalance(r), render: (r) => <b>{fmtMoney(invBalance(r))}</b> },
                      { key: 'dueDate', label: 'Payment cut-off date', type: 'date', required: true },
                      {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled'],
                        filter: true,
                        hint: 'Computed from receipts; choose Cancelled to void the demand',
                      },
                    ],
                  }}
                />
              );
            case 'receipts':
              return (
                <DataTable
                  title="Fee receipts"
                  exportName="fee-receipts"
                  rows={db.payments}
                  initialSort={{ key: 'date', dir: 'desc' }}
                  filters={[
                    { key: 'mode', label: 'Mode', options: PAYMENT_MODES.map((v) => ({ value: v, label: v })), match: (r, v) => r.mode === v },
                    {
                      key: 'cat',
                      label: 'Category',
                      options: ['Internal', 'External'].map((v) => ({ value: v, label: v })),
                      match: (r, v) => categoryOf(db, r.feeHeadId) === v,
                    },
                    { key: 'head', label: 'Fee head', options: options(db, 'feeHeads'), match: (r, v) => r.feeHeadId === v },
                    deptFilter((r) => stu(r.studentId)),
                  ]}
                  columns={[
                    { key: 'receiptNo', header: 'Receipt' },
                    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
                    { key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
                    { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
                    { key: 'cat', header: 'Category', value: (r) => categoryOf(db, r.feeHeadId), render: (r) => <Badge>{categoryOf(db, r.feeHeadId)}</Badge> },
                    { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => fmtMoney(r.amount), className: 'text-right' },
                    { key: 'mode', header: 'Mode' },
                    { key: 'reference', header: 'Reference' },
                    { key: 'recordedBy', header: 'Recorded by' },
                  ]}
                  actions={(r) => (
                    <>
                      {edit && r.channel !== 'Online' && (
                        <Button size="sm" variant="ghost" icon={Undo2} className="danger" title="Reverse receipt" onClick={() => reverse(r)} />
                      )}
                      <Button size="sm" variant="ghost" icon={Printer} title="Print receipt" onClick={() => printReceipt(db, [r], settings)} />
                    </>
                  )}
                />
              );
            case 'concessions':
              return (
                <DataTable
                  title="Discounts & scholarships register"
                  exportName="concession-register"
                  rows={db.invoices.filter((i) => i.academicYearId === ayId && ((i.discount ?? 0) > 0 || (i.scholarship ?? 0) > 0))}
                  filters={[
                    deptFilter((r) => stu(r.studentId)),
                    {
                      key: 'type',
                      label: 'Type',
                      options: [
                        { value: 'sch', label: 'Scholarship' },
                        { value: 'dis', label: 'Discount' },
                      ],
                      match: (r, v) => (v === 'sch' ? r.scholarship > 0 : r.discount > 0),
                    },
                  ]}
                  columns={[
                    { key: 'roll', header: 'Roll no', value: (r) => stu(r.studentId)?.rollNo },
                    { key: 'name', header: 'Student', value: (r) => stu(r.studentId)?.name },
                    { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
                    { key: 'concessionNote', header: 'Scheme / reason' },
                    { key: 'amount', header: 'Fee', value: (r) => r.amount, render: (r) => fmtMoney(r.amount), className: 'text-right' },
                    { key: 'discount', header: 'Discount', value: (r) => r.discount ?? 0, render: (r) => fmtMoney(r.discount ?? 0), className: 'text-right' },
                    { key: 'scholarship', header: 'Scholarship', value: (r) => r.scholarship ?? 0, render: (r) => fmtMoney(r.scholarship ?? 0), className: 'text-right' },
                    { key: 'net', header: 'Net payable', value: invNet, render: (r) => fmtMoney(invNet(r)), className: 'text-right' },
                  ]}
                />
              );
          }
        }}
      </UrlTabs>
      {card && (
        <StudentFeeCard
          student={card}
          onClose={() => setCard(null)}
          onCollect={() => {
            setCollect(card);
            setCard(null);
          }}
        />
      )}
      {collect && <CollectPayment student={collect} onClose={() => setCollect(null)} />}
      {gen && <GenerateDemands onClose={() => setGen(false)} />}
    </>
  );
}
