import { useMemo, useState } from 'react';
import { ArrowUpRight, Banknote, CheckCircle2, Landmark, Send, Users } from 'lucide-react';
import { useData } from '../../data/store';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, useConfirm, useToast } from '../../components/ui';
import { EXPENSE_CATEGORIES, EXTERNAL_EXPENSES, PAYMENT_MODES } from '../../lib/domain';
import { fmtDate, fmtMoney, sum, todayISO } from '../../lib/utils';

const MODES = PAYMENT_MODES.filter((m) => m !== 'Online Gateway');
const voucher = () => 'PV-' + Date.now().toString().slice(-7);

/** Collected from students vs remitted to the university / examination board, per external fee head. */
export function externalSummary(db) {
  return db.feeHeads
    .filter((h) => h.category === 'External')
    .map((h) => {
      const collected = sum(db.payments.filter((p) => p.feeHeadId === h.id).map((p) => p.amount));
      const remitted = sum(db.expenses.filter((e) => e.externalHeadId === h.id && e.status === 'Paid').map((e) => e.amount));
      return { id: h.id, head: h, collected, remitted, payable: collected - remitted };
    });
}

function Remit({ row, onClose }) {
  const { create } = useData();
  const toast = useToast();
  const [f, setF] = useState({ amount: String(Math.max(0, row.payable)), date: todayISO(), mode: 'Bank Transfer', reference: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    const amt = Number(f.amount);
    if (!amt || amt <= 0) return setErr('Enter a valid amount.');
    if (amt > row.payable) return setErr(`Amount exceeds the payable balance of ${fmtMoney(row.payable)}.`);
    if (!f.reference.trim()) return setErr('Enter the UTR / transaction reference.');
    try {
      await create('expenses', {
        voucherNo: voucher(),
        date: f.date,
        category: row.head.code === 'EXM' ? 'Examination Fee Remittance' : 'University Fee Remittance',
        payee: row.head.remitTo ?? 'University',
        description: `${row.head.name} remittance`,
        externalHeadId: row.head.id,
        amount: amt,
        mode: f.mode,
        reference: f.reference.trim(),
        status: 'Paid',
      });
      toast.success(`${fmtMoney(amt)} remitted to ${row.head.remitTo ?? 'the university'}.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Remit ${row.head.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Record remittance</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <p className="muted">
          Payee: <b>{row.head.remitTo}</b> · payable {fmtMoney(row.payable)}
        </p>
        <div className="form-grid">
          <Field label="Amount (₹)" required>
            <Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Mode">
            <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" required>
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="UTR / RTGS no" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Payroll() {
  const { db, can, create } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const edit = can('expenses', 'edit');
  const rows = useMemo(
    () =>
      db.employees
        .filter((e) => e.active !== false && e.status !== 'Relieved')
        .map((e) => ({ ...e, voucher: db.expenses.find((x) => x.category === 'Employee Salary' && x.employeeId === e.id && x.salaryMonth === month) })),
    [db, month],
  );
  const unpaid = rows.filter((r) => !r.voucher);
  const run = async () => {
    const total = sum(unpaid.map((r) => r.monthlySalary));
    if (!(await confirm({ title: `Pay salaries for ${month}?`, message: `Create ${unpaid.length} salary vouchers totalling ${fmtMoney(total)} (bank transfer).`, confirmLabel: 'Pay salaries', tone: 'primary' })))
      return;
    setBusy(true);
    try {
      let k = 0;
      for (const e of unpaid)
        await create(
          'expenses',
          {
            voucherNo: voucher() + k++,
            date: todayISO(),
            category: 'Employee Salary',
            employeeId: e.id,
            payee: e.name,
            salaryMonth: month,
            description: `Salary for ${month}`,
            amount: e.monthlySalary,
            mode: 'Bank Transfer',
            reference: 'PAYROLL-' + month,
            status: 'Paid',
          },
          { audit: false },
        );
      toast.success(`${unpaid.length} salaries paid for ${month}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card className="mb-16">
        <div className="row between">
          <Field label="Salary month">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <p className="muted">
            {rows.length - unpaid.length} of {rows.length} paid · {fmtMoney(sum(rows.filter((r) => r.voucher).map((r) => r.voucher.amount)))} disbursed ·{' '}
            {fmtMoney(sum(unpaid.map((r) => r.monthlySalary)))} pending
          </p>
          {edit && (
            <Button icon={Send} onClick={run} loading={busy} disabled={!unpaid.length}>
              Pay {unpaid.length} pending salaries
            </Button>
          )}
        </div>
      </Card>
      <DataTable
        title={`Salary register · ${month}`}
        exportName={`salary-register-${month}`}
        rows={rows}
        filters={[
          { key: 'cat', label: 'Staff type', options: ['Teaching', 'Non-Teaching'].map((v) => ({ value: v, label: v })), match: (r, v) => r.category === v },
          {
            key: 'paid',
            label: 'Status',
            options: [
              { value: 'y', label: 'Paid' },
              { value: 'n', label: 'Pending' },
            ],
            match: (r, v) => (v === 'y') === !!r.voucher,
          },
        ]}
        columns={[
          { key: 'empNo', header: 'Emp no' },
          { key: 'name', header: 'Employee' },
          { key: 'designation', header: 'Designation' },
          { key: 'dept', header: 'Dept', value: (r) => (r.departmentId ? labelOf(db, 'departments', r.departmentId) : 'Admin') },
          { key: 'monthlySalary', header: 'Monthly salary', value: (r) => r.monthlySalary, render: (r) => fmtMoney(r.monthlySalary), className: 'text-right' },
          { key: 'voucherNo', header: 'Voucher', value: (r) => r.voucher?.voucherNo ?? '' },
          { key: 'paidOn', header: 'Paid on', value: (r) => r.voucher?.date ?? '', render: (r) => fmtDate(r.voucher?.date) },
          { key: 'status', header: 'Status', value: (r) => (r.voucher ? 'Paid' : 'Pending'), render: (r) => <Badge>{r.voucher ? 'Paid' : 'Pending'}</Badge> },
        ]}
      />
    </>
  );
}

export default function Expenses() {
  const { db, can, update } = useData();
  const toast = useToast();
  const [remit, setRemit] = useState(null);
  const edit = can('expenses', 'edit');
  const paid = db.expenses.filter((e) => e.status === 'Paid');
  const ext = externalSummary(db);
  const markPaid = async (r) => {
    try {
      await update('expenses', r.id, { status: 'Paid', date: todayISO() }, { audit: 'Expense paid', details: r.voucherNo });
      toast.success('Expense marked as paid.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const expenseConfig = (extra = {}) => ({
    collection: 'expenses',
    title: 'Expenditure',
    singular: 'Expense',
    module: 'expenses',
    noDeactivate: true,
    initialSort: { key: 'date', dir: 'desc' },
    defaults: () => ({ voucherNo: voucher(), date: todayISO(), status: 'Paid', mode: 'Bank Transfer' }),
    rowActions: (r) =>
      edit && r.status === 'Pending' ? (
        <Button size="sm" variant="ghost" icon={CheckCircle2} onClick={() => markPaid(r)}>
          Pay
        </Button>
      ) : null,
    beforeSave: (f, prev, d) => ({
      ...f,
      payee: f.payee || (f.employeeId ? d.employees.find((e) => e.id === f.employeeId)?.name : f.payee),
      externalHeadId: EXTERNAL_EXPENSES.includes(f.category)
        ? d.feeHeads.find((h) => h.code === (f.category.startsWith('Exam') ? 'EXM' : 'UNI'))?.id
        : undefined,
    }),
    fields: [
      { key: 'voucherNo', label: 'Voucher no', required: true, unique: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES, required: true, filter: true },
      { key: 'payee', label: 'Payee / vendor', hint: 'Leave blank for salaries to use the employee name' },
      { key: 'description', label: 'Description', wide: true },
      { key: 'vendorInvoiceNo', label: 'Vendor invoice no', table: false },
      { key: 'hostelId', label: 'Hostel', type: 'ref', ref: 'hostels', table: false, hint: 'For hostel expenses' },
      { key: 'employeeId', label: 'Employee', type: 'ref', ref: 'employees', table: false, hint: 'For salary payments' },
      { key: 'salaryMonth', label: 'Salary month', table: false },
      { key: 'amount', label: 'Amount', type: 'money', min: 1, required: true },
      { key: 'mode', label: 'Mode', type: 'select', options: MODES, required: true, filter: true },
      { key: 'reference', label: 'Reference', table: false },
      { key: 'status', label: 'Status', type: 'select', options: ['Paid', 'Pending'], required: true, filter: true },
    ],
    ...extra,
  });
  return (
    <>
      <PageHeader title="Expenditure" subtitle="Invoices, hostel expenses, employee salaries, university remittances and other payments" />
      <div className="grid cols-4 stats">
        <StatCard label="Total paid out" value={fmtMoney(sum(paid.map((e) => e.amount)))} icon={ArrowUpRight} tone="red" hint={`${paid.length} vouchers`} />
        <StatCard label="Salaries" value={fmtMoney(sum(paid.filter((e) => e.category === 'Employee Salary').map((e) => e.amount)))} icon={Users} tone="violet" />
        <StatCard label="Hostel expenses" value={fmtMoney(sum(paid.filter((e) => e.category === 'Hostel Expense').map((e) => e.amount)))} icon={Banknote} tone="amber" />
        <StatCard label="Paid to external parties" value={fmtMoney(sum(ext.map((x) => x.remitted)))} icon={Landmark} tone="blue" hint={`${fmtMoney(sum(ext.map((x) => x.payable)))} still payable`} />
      </div>
      <UrlTabs
        tabs={[
          { id: 'all', label: 'All expenditure' },
          { id: 'external', label: 'External payments' },
          { id: 'salaries', label: 'Salaries' },
          { id: 'hostel', label: 'Hostel expenses' },
          { id: 'invoices', label: 'Vendor invoices' },
          { id: 'employees', label: 'Employees' },
        ]}
      >
        {(t) => {
          switch (t) {
            case 'external':
              return (
                <>
                  <div className="mb-16">
                    <Alert tone="info" title="External fees">
                      University and examination fees are collected from students on behalf of {db.settings[0]?.universityName ?? 'the university'}. This
                      shows how much was collected, how much has been paid to the external party, and the balance still payable.
                    </Alert>
                  </div>
                  <DataTable
                    title="Collected vs paid to external parties"
                    rows={ext}
                    hideExport
                    columns={[
                      { key: 'head', header: 'Fee head', value: (r) => r.head.name },
                      { key: 'remitTo', header: 'Paid to', value: (r) => r.head.remitTo },
                      { key: 'collected', header: 'Collected from students', value: (r) => r.collected, render: (r) => fmtMoney(r.collected), className: 'text-right' },
                      { key: 'remitted', header: 'Paid to external party', value: (r) => r.remitted, render: (r) => fmtMoney(r.remitted), className: 'text-right' },
                      { key: 'payable', header: 'Balance payable', value: (r) => r.payable, render: (r) => <b>{fmtMoney(r.payable)}</b>, className: 'text-right' },
                    ]}
                    actions={
                      edit
                        ? (r) =>
                            r.payable > 0 ? (
                              <Button size="sm" variant="ghost" icon={Send} onClick={() => setRemit(r)}>
                                Remit
                              </Button>
                            ) : null
                        : undefined
                    }
                  />
                  <div className="mt-16">
                    <EntityPage config={expenseConfig({ title: 'External remittances', rowFilter: (r) => EXTERNAL_EXPENSES.includes(r.category) })} />
                  </div>
                </>
              );
            case 'salaries':
              return <Payroll />;
            case 'hostel':
              return (
                <>
                  <div className="grid cols-2 mb-16">
                    {db.hostels.map((h) => (
                      <StatCard
                        key={h.id}
                        label={h.name}
                        value={fmtMoney(sum(paid.filter((e) => e.hostelId === h.id).map((e) => e.amount)))}
                        icon={Banknote}
                        tone="amber"
                        hint="Provisions, maintenance and services"
                      />
                    ))}
                  </div>
                  <EntityPage
                    config={expenseConfig({
                      title: 'Hostel expenses',
                      rowFilter: (r) => r.category === 'Hostel Expense',
                      defaults: () => ({ voucherNo: voucher(), date: todayISO(), status: 'Paid', mode: 'Bank Transfer', category: 'Hostel Expense' }),
                    })}
                  />
                </>
              );
            case 'invoices':
              return (
                <EntityPage
                  config={expenseConfig({
                    title: 'Vendor invoices',
                    rowFilter: (r) => r.category === 'Vendor Invoice',
                    defaults: () => ({ voucherNo: voucher(), date: todayISO(), status: 'Pending', mode: 'Bank Transfer', category: 'Vendor Invoice' }),
                  })}
                />
              );
            case 'employees':
              return (
                <EntityPage
                  config={{
                    collection: 'employees',
                    title: 'Employees',
                    singular: 'Employee',
                    module: 'expenses',
                    fields: [
                      { key: 'empNo', label: 'Emp no', required: true, unique: true },
                      { key: 'name', label: 'Name', required: true },
                      { key: 'designation', label: 'Designation', required: true },
                      { key: 'category', label: 'Staff type', type: 'select', options: ['Teaching', 'Non-Teaching'], required: true, filter: true },
                      { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', filter: true },
                      { key: 'phone', label: 'Phone', type: 'tel' },
                      { key: 'monthlySalary', label: 'Monthly salary', type: 'money', min: 0, required: true },
                      { key: 'joiningDate', label: 'Joining date', type: 'date', table: false },
                      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On Leave', 'Relieved'], required: true, filter: true },
                    ],
                    defaults: () => ({ status: 'Active' }),
                  }}
                />
              );
            default:
              return <EntityPage config={expenseConfig()} />;
          }
        }}
      </UrlTabs>
      {remit && <Remit row={remit} onClose={() => setRemit(null)} />}
    </>
  );
}
