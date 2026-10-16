import { useMemo, useState } from 'react';
import { CreditCard, Printer, Undo2, IndianRupee, Wallet, AlertTriangle, FileText, FilePlus2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, StatCard, useConfirm, useToast } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtMoney, pct, sum, todayISO } from '../../lib/utils';
export function printReceipt(p, inv, studentLabel, institution) {
  const w = window.open('', '_blank', 'width=720,height=800');
  if (!w) return;
  w.document
    .write(`<!doctype html><html><head><title>Receipt ${p.receiptNo}</title><style>body{font-family:Inter,Segoe UI,sans-serif;margin:40px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}.muted{color:#666;font-size:12px}</style></head><body>
  <h1>${institution}</h1><p class="muted">Fee Payment Receipt</p>
  <table><tr><td>Receipt no</td><td class="r"><b>${p.receiptNo}</b></td></tr><tr><td>Date</td><td class="r">${fmtDate(p.date)}</td></tr>
  <tr><td>Student</td><td class="r">${studentLabel}</td></tr><tr><td>Invoice</td><td class="r">${inv?.invoiceNo ?? ''} – ${inv?.description ?? ''}</td></tr>
  <tr><td>Payment mode</td><td class="r">${p.mode} (${p.reference})</td></tr><tr><td><b>Amount received</b></td><td class="r"><b>${fmtMoney(p.amount)}</b></td></tr>
  <tr><td>Balance after payment</td><td class="r">${inv ? fmtMoney(inv.amount - inv.paid) : ''}</td></tr></table>
  <p class="muted" style="margin-top:40px">Computer-generated receipt. Recorded by ${p.recordedBy ?? ''}.</p><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
function RecordPayment({ inv, onClose }) {
  const { user } = useAuth();
  const { db, create, update, settings } = useData();
  const toast = useToast();
  const balance = inv.amount - inv.paid;
  const [f, setF] = useState({ amount: String(balance), date: todayISO(), mode: 'UPI', reference: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const amt = Number(f.amount);
    if (!amt || amt <= 0) return setErr('Enter a valid amount.');
    if (amt > balance) return setErr(`Amount exceeds the outstanding balance of ${fmtMoney(balance)}.`);
    if (f.mode !== 'Cash' && !f.reference.trim()) return setErr('Transaction / instrument reference is required for non-cash payments.');
    if (f.date > todayISO()) return setErr('Payment date cannot be in the future.');
    setBusy(true);
    try {
      const p = await create(
        'payments',
        {
          receiptNo: 'RCPT-' + Date.now().toString().slice(-8),
          invoiceId: inv.id,
          studentId: inv.studentId,
          amount: amt,
          date: f.date,
          mode: f.mode,
          reference: f.reference || 'CASH',
          recordedBy: user.name,
        },
        { audit: 'Recorded payment', details: `${inv.invoiceNo} ${fmtMoney(amt)}` },
      );
      const paid = inv.paid + amt;
      const newInv = { ...inv, paid, status: paid >= inv.amount ? 'Paid' : 'Partially Paid' };
      await update('invoices', inv.id, { paid, status: newInv.status }, { audit: false });
      toast.success(`Payment of ${fmtMoney(amt)} recorded.`);
      printReceipt(p, newInv, labelOf(db, 'students', inv.studentId), settings.institutionName);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record payment · ${inv.invoiceNo}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Record & print receipt
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          {labelOf(db, 'students', inv.studentId)}
          <br />
          Outstanding: <b>{fmtMoney(balance)}</b>
        </p>
        <Alert tone="info">
          Records an offline/verified payment. No online payment gateway is configured, so no money is collected by this application.
        </Alert>
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Amount (₹)" required>
            <Input type="number" min={1} max={balance} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Mode" required>
            <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'DD'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference">
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Txn / DD no." />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
function GenerateInvoices({ onClose }) {
  const { db, ayId, create } = useData();
  const toast = useToast();
  const [fsId, setFsId] = useState('');
  const [due, setDue] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const fs = db.feeStructures.find((f) => f.id === fsId);
  const targets = fs
    ? db.students.filter(
        (s) =>
          s.programId === fs.programId &&
          s.status === 'Active' &&
          s.active !== false &&
          !db.invoices.some((i) => i.studentId === s.id && i.feeStructureId === fs.id),
      )
    : [];
  const go = async () => {
    if (!fs) return;
    setBusy(true);
    try {
      const amount = fs.tuition + fs.exam + fs.development + fs.other;
      for (const s of targets)
        await create(
          'invoices',
          {
            invoiceNo: `INV-${Date.now().toString().slice(-6)}-${s.rollNo.slice(-3)}`,
            studentId: s.id,
            academicYearId: ayId,
            feeStructureId: fs.id,
            description: fs.name,
            amount,
            dueDate: due,
            paid: 0,
            status: 'Unpaid',
          },
          { audit: false },
        );
      toast.success(`${targets.length} invoice(s) generated.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Generate invoices from fee structure"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={!targets.length}>
            Generate {targets.length || ''} invoices
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
        <Field label="Due date" required>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {fs && (
          <p className="muted">
            {targets.length} active students in {labelOf(db, 'programs', fs.programId)} without this invoice ·{' '}
            {fmtMoney(fs.tuition + fs.exam + fs.development + fs.other)} each.
          </p>
        )}
      </div>
    </Modal>
  );
}
function StudentFinance() {
  const { db, settings } = useData();
  const scope = useScope();
  const inv = db.invoices.filter((i) => scope.linked.includes(i.studentId));
  const pays = db.payments.filter((p) => scope.linked.includes(p.studentId));
  const due = sum(inv.filter((i) => i.status !== 'Cancelled').map((i) => i.amount - i.paid));
  return (
    <>
      <div className="grid cols-3 stats">
        <StatCard label="Total billed" value={fmtMoney(sum(inv.map((i) => i.amount)))} icon={FileText} />
        <StatCard label="Paid" value={fmtMoney(sum(inv.map((i) => i.paid)))} icon={Wallet} tone="green" />
        <StatCard label="Outstanding" value={fmtMoney(due)} icon={AlertTriangle} tone={due ? 'red' : 'green'} />
      </div>
      {due > 0 && (
        <div className="mb-16">
          <Alert tone="info">
            Online payment is not enabled for this institution. Please pay at the accounts office or by bank transfer; your payment will be
            recorded by the Finance office.
          </Alert>
        </div>
      )}
      <DataTable
        title="My invoices"
        rows={inv}
        columns={[
          { key: 'invoiceNo', header: 'Invoice' },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', render: (r) => fmtMoney(r.amount) },
          { key: 'paid', header: 'Paid', render: (r) => fmtMoney(r.paid) },
          { key: 'bal', header: 'Balance', value: (r) => r.amount - r.paid, render: (r) => fmtMoney(r.amount - r.paid) },
          { key: 'dueDate', header: 'Due', render: (r) => fmtDate(r.dueDate) },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
      />
      <div className="mt-16">
        <DataTable
          title="My payments"
          rows={pays}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'receiptNo', header: 'Receipt' },
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'amount', header: 'Amount', render: (r) => fmtMoney(r.amount) },
            { key: 'mode', header: 'Mode' },
            { key: 'reference', header: 'Reference' },
          ]}
          actions={(r) => (
            <Button
              size="sm"
              variant="ghost"
              icon={Printer}
              onClick={() =>
                printReceipt(
                  r,
                  db.invoices.find((i) => i.id === r.invoiceId),
                  labelOf(db, 'students', r.studentId),
                  settings.institutionName,
                )
              }
              title="Print receipt"
            />
          )}
        />
      </div>
    </>
  );
}
export default function Finance() {
  const { db, ayId, can, settings, remove, update } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  /** Reverse a payment: remove it and restore the invoice balance (both recorded in the audit log). */
  const reverse = async (p) => {
    const inv = db.invoices.find((i) => i.id === p.invoiceId);
    const ok = await confirm({
      title: 'Reverse payment?',
      message: `Reverse receipt ${p.receiptNo} for ${fmtMoney(p.amount)}? The amount will be added back to invoice ${inv?.invoiceNo ?? ''}. Use this only for bounced or wrongly recorded payments.`,
      confirmLabel: 'Reverse payment',
    });
    if (!ok) return;
    try {
      await remove('payments', p.id, { audit: 'Reversed payment', details: `${p.receiptNo} ${fmtMoney(p.amount)}` });
      if (inv) {
        const paid = Math.max(0, inv.paid - p.amount);
        await update(
          'invoices',
          inv.id,
          { paid, status: paid >= inv.amount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid' },
          { audit: false },
        );
      }
      toast.success('Payment reversed and invoice balance restored.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const scope = useScope();
  const [pay, setPay] = useState(null);
  const [gen, setGen] = useState(false);
  const edit = can('finance', 'edit');
  const inv = useMemo(() => db.invoices.filter((i) => i.academicYearId === ayId && i.status !== 'Cancelled'), [db.invoices, ayId]);
  if (scope.personal)
    return (
      <>
        <PageHeader title="Fees & Payments" subtitle="Invoices, receipts and outstanding balance" />
        <StudentFinance />
      </>
    );
  const billed = sum(inv.map((i) => i.amount)),
    collected = sum(inv.map((i) => i.paid));
  const outstanding = inv.filter((i) => i.amount > i.paid);
  const stu = (id) => db.students.find((s) => s.id === id);
  return (
    <>
      <PageHeader title="Finance" subtitle="Fee structures, invoices, payments, receipts and outstanding balances" />
      <div className="grid cols-4 stats">
        <StatCard label="Billed" value={fmtMoney(billed)} icon={IndianRupee} />
        <StatCard label="Collected" value={fmtMoney(collected)} icon={Wallet} tone="green" hint={`${pct(collected, billed)}% collection`} />
        <StatCard
          label="Outstanding"
          value={fmtMoney(billed - collected)}
          icon={AlertTriangle}
          tone="red"
          hint={`${outstanding.length} students`}
        />
        <StatCard label="Overdue invoices" value={outstanding.filter((i) => i.dueDate < todayISO()).length} icon={FileText} tone="amber" />
      </div>
      <UrlTabs
        tabs={[
          { id: 'invoices', label: 'Invoices' },
          { id: 'payments', label: 'Payments' },
          { id: 'outstanding', label: 'Outstanding report' },
          { id: 'structures', label: 'Fee structures' },
          { id: 'history', label: 'Transaction history' },
        ]}
      >
        {(t) => {
          switch (t) {
            case 'invoices':
              return (
                <EntityPage
                  config={{
                    collection: 'invoices',
                    title: 'Invoices',
                    singular: 'Invoice',
                    module: 'finance',
                    ayFiltered: true,
                    noDeactivate: true,
                    defaults: ({ ayId: a }) => ({
                      academicYearId: a,
                      paid: 0,
                      status: 'Unpaid',
                      invoiceNo: 'INV-' + Date.now().toString().slice(-7),
                    }),
                    toolbar: edit ? (
                      <Button size="sm" variant="secondary" icon={FilePlus2} onClick={() => setGen(true)}>
                        Bulk generate
                      </Button>
                    ) : undefined,
                    canEditRow: (r) => r.paid === 0,
                    beforeSave: (f) => ({
                      ...f,
                      status:
                        f.status === 'Cancelled'
                          ? 'Cancelled'
                          : (f.paid ?? 0) >= f.amount
                            ? 'Paid'
                            : (f.paid ?? 0) > 0
                              ? 'Partially Paid'
                              : 'Unpaid',
                    }),
                    rowActions: (r) =>
                      edit && r.status !== 'Paid' && r.status !== 'Cancelled' ? (
                        <Button size="sm" variant="ghost" icon={CreditCard} onClick={() => setPay(r)}>
                          Pay
                        </Button>
                      ) : null,
                    fields: [
                      { key: 'invoiceNo', label: 'Invoice no', required: true, unique: true },
                      { key: 'studentId', label: 'Student', type: 'ref', ref: 'students', required: true },
                      {
                        key: 'program',
                        label: 'Program',
                        form: false,
                        value: (r, d) => labelOf(d, 'programs', d.students.find((s) => s.id === r.studentId)?.programId),
                      },
                      { key: 'description', label: 'Description', required: true, table: false },
                      { key: 'amount', label: 'Amount', type: 'money', min: 1, required: true },
                      { key: 'paid', label: 'Paid', type: 'money', form: false },
                      {
                        key: 'balance',
                        label: 'Balance',
                        form: false,
                        value: (r) => r.amount - r.paid,
                        render: (r) => fmtMoney(r.amount - r.paid),
                      },
                      { key: 'dueDate', label: 'Due date', type: 'date', required: true },
                      {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled'],
                        filter: true,
                        hint: 'Computed from payments; choose Cancelled to void',
                      },
                    ],
                  }}
                />
              );
            case 'payments':
              return (
                <>
                  <div className="mb-16">
                    <Alert tone="info" title="How this list is built">
                      Every row is a <b>receipt</b>. A receipt is created when Finance clicks <b>Pay</b> on an invoice (Invoices tab) and
                      records the amount, date, mode and transaction reference. Saving it adds the amount to that invoice's <b>Paid</b>{' '}
                      total and recalculates its status (Unpaid → Partially Paid → Paid). <b>Reverse</b> removes a wrong or bounced receipt
                      and puts the amount back on the invoice.
                    </Alert>
                  </div>
                  <DataTable
                    title="Payments"
                    rows={db.payments}
                    initialSort={{ key: 'date', dir: 'desc' }}
                    filters={[
                      {
                        key: 'mode',
                        label: 'Mode',
                        options: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'DD'].map((v) => ({ value: v, label: v })),
                        match: (r, v) => r.mode === v,
                      },
                    ]}
                    columns={[
                      { key: 'receiptNo', header: 'Receipt' },
                      { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
                      { key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
                      { key: 'invoice', header: 'Invoice', value: (r) => db.invoices.find((i) => i.id === r.invoiceId)?.invoiceNo },
                      { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => fmtMoney(r.amount) },
                      { key: 'mode', header: 'Mode' },
                      { key: 'reference', header: 'Reference' },
                      { key: 'recordedBy', header: 'Recorded by' },
                    ]}
                    actions={(r) => (
                      <>
                        {edit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Undo2}
                            className="danger"
                            title="Reverse payment"
                            onClick={() => reverse(r)}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Printer}
                          title="Print receipt"
                          onClick={() =>
                            printReceipt(
                              r,
                              db.invoices.find((i) => i.id === r.invoiceId),
                              labelOf(db, 'students', r.studentId),
                              settings.institutionName,
                            )
                          }
                        />
                      </>
                    )}
                  />
                </>
              );
            case 'outstanding':
              return (
                <>
                  <div className="mb-16">
                    <Alert tone="info" title="How this report is calculated">
                      It lists every invoice of the selected academic year whose <b>Balance = Billed − Paid</b> is more than zero (status
                      Unpaid or Partially Paid). <b>Billed</b> comes from the invoice (generated from the fee structure) and <b>Paid</b> is
                      the sum of all receipts recorded against it in the Payments tab, so the report updates instantly whenever a payment is
                      recorded or reversed. Red due dates are overdue. Use Filters for department or semester, and CSV or Print to share it.
                    </Alert>
                  </div>
                  <DataTable
                    title="Outstanding balances"
                    exportName="outstanding-report"
                    rows={outstanding}
                    initialSort={{ key: 'bal', dir: 'desc' }}
                    filters={[
                      {
                        key: 'dept',
                        label: 'Department',
                        options: db.departments.map((d) => ({ value: d.id, label: d.code })),
                        match: (r, v) => stu(r.studentId)?.departmentId === v,
                      },
                      {
                        key: 'sem',
                        label: 'Semester',
                        options: [1, 3, 5, 7].map((s) => ({ value: String(s), label: `Sem ${s}` })),
                        match: (r, v) => String(stu(r.studentId)?.semesterNo) === v,
                      },
                    ]}
                    columns={[
                      { key: 'roll', header: 'Roll no', value: (r) => stu(r.studentId)?.rollNo },
                      { key: 'name', header: 'Student', value: (r) => stu(r.studentId)?.name },
                      { key: 'dept', header: 'Dept', value: (r) => labelOf(db, 'departments', stu(r.studentId)?.departmentId) },
                      { key: 'phone', header: 'Parent phone', value: (r) => stu(r.studentId)?.parentPhone },
                      { key: 'amount', header: 'Billed', value: (r) => r.amount },
                      { key: 'paid', header: 'Paid', value: (r) => r.paid },
                      {
                        key: 'bal',
                        header: 'Balance',
                        value: (r) => r.amount - r.paid,
                        render: (r) => <b>{fmtMoney(r.amount - r.paid)}</b>,
                      },
                      {
                        key: 'dueDate',
                        header: 'Due',
                        render: (r) => <span className={r.dueDate < todayISO() ? 'text-red' : ''}>{fmtDate(r.dueDate)}</span>,
                      },
                    ]}
                  />
                </>
              );
            case 'structures':
              return (
                <EntityPage
                  config={{
                    collection: 'feeStructures',
                    title: 'Fee structures',
                    singular: 'Fee Structure',
                    module: 'finance',
                    ayFiltered: true,
                    defaults: ({ ayId: a }) => ({ academicYearId: a }),
                    fields: [
                      { key: 'name', label: 'Name', required: true },
                      { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, filter: true },
                      { key: 'tuition', label: 'Tuition', type: 'money', min: 0, required: true },
                      { key: 'exam', label: 'Exam fee', type: 'money', min: 0, required: true },
                      { key: 'development', label: 'Development', type: 'money', min: 0, required: true },
                      { key: 'other', label: 'Other', type: 'money', min: 0, required: true },
                      {
                        key: 'total',
                        label: 'Total',
                        form: false,
                        value: (r) => r.tuition + r.exam + r.development + r.other,
                        render: (r) => <b>{fmtMoney(r.tuition + r.exam + r.development + r.other)}</b>,
                      },
                    ],
                  }}
                />
              );
            case 'history':
              return (
                <DataTable
                  title="Finance transaction history"
                  rows={db.auditLogs.filter((l) => ['Invoice', 'Payment', 'Fee Structure'].includes(l.entity))}
                  initialSort={{ key: 'createdAt', dir: 'desc' }}
                  emptyMessage="Every invoice, payment and fee-structure change made in this application is recorded here."
                  columns={[
                    { key: 'createdAt', header: 'When', render: (r) => fmtDateTime(r.createdAt) },
                    { key: 'userName', header: 'User' },
                    { key: 'action', header: 'Action' },
                    { key: 'entity', header: 'Entity' },
                    { key: 'details', header: 'Details' },
                  ]}
                />
              );
          }
        }}
      </UrlTabs>
      {pay && <RecordPayment inv={pay} onClose={() => setPay(null)} />}
      {gen && <GenerateInvoices onClose={() => setGen(false)} />}
    </>
  );
}
