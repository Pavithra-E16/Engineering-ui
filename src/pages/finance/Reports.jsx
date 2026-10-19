import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, Download, Landmark, Printer, Scale } from 'lucide-react';
import { useData } from '../../data/store';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Button, Card, Field, Input, PageHeader, Select, StatCard } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { cashEntries, withRunning } from '../../lib/cashbook';
import { PAYMENT_MODES, categoryOf, headOf, invBalance, invNet } from '../../lib/domain';
import { exportCSV, fmtDate, fmtDateTime, fmtMoney, sum, todayISO } from '../../lib/utils';
import { externalSummary } from './Expenses';

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
/** Printable multi-section report (A4). sections: [{ title, headers, rows, foot? }] */
function printSections(title, subtitle, sections, institution) {
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return;
  const table = (s) => `<h2>${esc(s.title)}</h2><table><thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${s.headers.length}">No entries</td></tr>`}
    ${s.foot ? `<tr class="f">${s.foot.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>` : ''}</tbody></table>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:20px 0 6px}
    p{color:#555;font-size:12px;margin:4px 0 8px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
    th{background:#eef3fb}tr.f td{font-weight:700;background:#f6f6f6}.sig{display:flex;justify-content:space-between;margin-top:48px;font-size:12px}
    </style></head><body><h1>${esc(institution)}</h1><p><b>${esc(title)}</b> · ${esc(subtitle)} · Generated ${new Date().toLocaleString('en-IN')}</p>
    ${sections.map(table).join('')}<div class="sig"><span>Prepared by</span><span>Accounts Officer</span><span>Principal</span></div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
const money = (n) => Math.round(n).toLocaleString('en-IN');

function DailyReport() {
  const { db, settings } = useData();
  const [date, setDate] = useState(todayISO());
  const r = useMemo(() => {
    const rc = db.payments.filter((p) => p.date === date);
    const ex = db.expenses.filter((e) => e.date === date && e.status === 'Paid');
    const other = db.cashBook.filter((c) => c.date === date);
    const modes = PAYMENT_MODES.filter((m) => rc.some((p) => p.mode === m));
    const heads = db.feeHeads
      .map((h) => {
        const list = rc.filter((p) => p.feeHeadId === h.id);
        return { h, by: Object.fromEntries(modes.map((m) => [m, sum(list.filter((p) => p.mode === m).map((p) => p.amount))])), total: sum(list.map((p) => p.amount)), n: list.length };
      })
      .filter((x) => x.n);
    const entries = cashEntries(db);
    const acct = ['Cash', 'Bank'].map((a) => ({ a, ...withRunning(entries, settings, date, date, a) }));
    const cats = [...new Set(ex.map((e) => e.category))].map((c) => ({ c, n: ex.filter((e) => e.category === c).length, total: sum(ex.filter((e) => e.category === c).map((e) => e.amount)) }));
    const internal = sum(rc.filter((p) => categoryOf(db, p.feeHeadId) === 'Internal').map((p) => p.amount));
    return { rc, ex, other, modes, heads, acct, cats, internal, external: sum(rc.map((p) => p.amount)) - internal };
  }, [db, settings, date]);
  const collected = sum(r.rc.map((p) => p.amount));
  const otherRec = sum(r.other.filter((c) => c.type === 'Receipt' && c.head !== 'Contra').map((c) => c.amount));
  const paidOut = sum(r.ex.map((e) => e.amount)) + sum(r.other.filter((c) => c.type === 'Payment' && c.head !== 'Contra').map((c) => c.amount));
  const sections = () => [
    {
      title: 'Fee collection by fee head and mode',
      headers: ['Fee head', 'Category', ...r.modes, 'Receipts', 'Total'],
      rows: r.heads.map((x) => [x.h.name, x.h.category, ...r.modes.map((m) => money(x.by[m])), x.n, money(x.total)]),
      foot: ['Total', '', ...r.modes.map((m) => money(sum(r.heads.map((x) => x.by[m])))), r.rc.length, money(collected)],
    },
    { title: 'Internal vs external fees', headers: ['Category', 'Amount'], rows: [['Internal (college)', money(r.internal)], ['External (university / exam)', money(r.external)]] },
    {
      title: 'Payments made',
      headers: ['Voucher', 'Category', 'Payee', 'Mode', 'Amount'],
      rows: [...r.ex.map((e) => [e.voucherNo, e.category, e.payee, e.mode, money(e.amount)]), ...r.other.filter((c) => c.type === 'Payment').map((c) => [c.voucherNo, c.head, c.particulars, c.account, money(c.amount)])],
      foot: ['Total', '', '', '', money(sum(r.ex.map((e) => e.amount)) + sum(r.other.filter((c) => c.type === 'Payment').map((c) => c.amount)))],
    },
    {
      title: 'Other receipts',
      headers: ['Voucher', 'Head', 'Particulars', 'Account', 'Amount'],
      rows: r.other.filter((c) => c.type === 'Receipt').map((c) => [c.voucherNo, c.head, c.particulars, c.account, money(c.amount)]),
    },
    {
      title: 'Cash & bank position',
      headers: ['Account', 'Opening', 'Receipts', 'Payments', 'Closing'],
      rows: r.acct.map((x) => [
        x.a,
        money(x.open),
        money(sum(x.rows.filter((e) => e.type === 'Receipt').map((e) => e.amount))),
        money(sum(x.rows.filter((e) => e.type === 'Payment').map((e) => e.amount))),
        money(x.close),
      ]),
    },
    {
      title: 'Receipt-wise details',
      headers: ['Receipt', 'Student', 'Fee head', 'Mode', 'Reference', 'Amount'],
      rows: r.rc.map((p) => [p.receiptNo, labelOf(db, 'students', p.studentId), headOf(db, p.feeHeadId)?.name, p.mode, p.reference, money(p.amount)]),
    },
  ];
  const csv = () =>
    exportCSV(
      `daily-financial-report-${date}`,
      ['Type', 'Voucher / receipt', 'Date', 'Party', 'Head', 'Category', 'Mode / account', 'Reference', 'Amount'],
      [
        ...r.rc.map((p) => ['Fee receipt', p.receiptNo, p.date, labelOf(db, 'students', p.studentId), headOf(db, p.feeHeadId)?.name, categoryOf(db, p.feeHeadId), p.mode, p.reference, p.amount]),
        ...r.other.map((c) => [`Other ${c.type.toLowerCase()}`, c.voucherNo, c.date, c.particulars, c.head, '', c.account, '', c.type === 'Payment' ? -c.amount : c.amount]),
        ...r.ex.map((e) => ['Expenditure', e.voucherNo, e.date, e.payee, e.category, '', e.mode, e.reference, -e.amount]),
      ],
    );
  return (
    <>
      <Card className="mb-16">
        <div className="row between">
          <Field label="Report date">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="row">
            <Button variant="secondary" icon={Download} onClick={csv}>
              Download CSV
            </Button>
            <Button icon={Printer} onClick={() => printSections('Daily Financial Report', fmtDate(date), sections(), settings.institutionName)}>
              Print / PDF
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid cols-4 stats">
        <StatCard label="Fees collected" value={fmtMoney(collected)} icon={ArrowDownLeft} tone="green" hint={`${r.rc.length} receipts · other receipts ${fmtMoney(otherRec)}`} />
        <StatCard label="Internal fees" value={fmtMoney(r.internal)} icon={Building2} tone="blue" />
        <StatCard label="External fees" value={fmtMoney(r.external)} icon={Landmark} tone="violet" />
        <StatCard label="Payments made" value={fmtMoney(paidOut)} icon={ArrowUpRight} tone="red" hint={`${r.ex.length} vouchers`} />
      </div>
      {sections()
        .slice(0, 5)
        .map((s) => (
          <Card key={s.title} title={s.title} className="mb-16">
            <div className="bordered table-scroll">
              <table className="simple-table">
                <thead>
                  <tr>
                    {s.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                  {!s.rows.length && (
                    <tr>
                      <td colSpan={s.headers.length} className="muted text-center">
                        No entries on {fmtDate(date)}.
                      </td>
                    </tr>
                  )}
                  {s.foot && s.rows.length > 0 && (
                    <tr>
                      {s.foot.map((c, j) => (
                        <td key={j} className="strong">
                          {c}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
    </>
  );
}

function CollectionSummary() {
  const { db, ayId } = useData();
  const rows = db.feeHeads.map((h) => {
    const inv = db.invoices.filter((i) => i.feeHeadId === h.id && i.academicYearId === ayId && i.status !== 'Cancelled');
    return {
      id: h.id,
      h,
      billed: sum(inv.map((i) => i.amount)),
      concession: sum(inv.map((i) => (i.discount ?? 0) + (i.scholarship ?? 0))),
      net: sum(inv.map(invNet)),
      collected: sum(inv.map((i) => i.paid)),
      outstanding: sum(inv.map(invBalance)),
    };
  });
  const ext = externalSummary(db);
  const cat = (c, k) => sum(rows.filter((r) => r.h.category === c).map((r) => r[k]));
  return (
    <>
      <div className="grid cols-4 stats">
        <StatCard label="College collects (internal)" value={fmtMoney(cat('Internal', 'collected'))} icon={Building2} tone="blue" hint={`${fmtMoney(cat('Internal', 'outstanding'))} outstanding`} />
        <StatCard label="Collected for external parties" value={fmtMoney(cat('External', 'collected'))} icon={Landmark} tone="violet" hint={`${fmtMoney(cat('External', 'outstanding'))} outstanding`} />
        <StatCard label="Paid to external parties" value={fmtMoney(sum(ext.map((x) => x.remitted)))} icon={ArrowUpRight} tone="red" />
        <StatCard label="External balance payable" value={fmtMoney(sum(ext.map((x) => x.payable)))} icon={Scale} tone="amber" />
      </div>
      <Card title="Collected vs outstanding by fee head" className="mb-16">
        <SimpleBar
          data={rows.map((r) => ({ head: r.h.code, Collected: Math.round(r.collected / 1e4) / 10, Outstanding: Math.round(r.outstanding / 1e4) / 10 }))}
          unit=" L"
          x="head"
          stacked
          bars={[
            { key: 'Collected', label: 'Collected' },
            { key: 'Outstanding', label: 'Outstanding' },
          ]}
          height={240}
        />
      </Card>
      <DataTable
        title="Head-wise fee summary"
        exportName="head-wise-fee-summary"
        rows={rows}
        filters={[{ key: 'cat', label: 'Category', options: ['Internal', 'External'].map((v) => ({ value: v, label: v })), match: (r, v) => r.h.category === v }]}
        columns={[
          { key: 'head', header: 'Fee head', value: (r) => r.h.name },
          { key: 'cat', header: 'Category', value: (r) => r.h.category },
          { key: 'billed', header: 'Billed', value: (r) => r.billed, render: (r) => fmtMoney(r.billed), className: 'text-right' },
          { key: 'concession', header: 'Discount + scholarship', value: (r) => r.concession, render: (r) => fmtMoney(r.concession), className: 'text-right' },
          { key: 'net', header: 'Net payable', value: (r) => r.net, render: (r) => fmtMoney(r.net), className: 'text-right' },
          { key: 'collected', header: 'Collected', value: (r) => r.collected, render: (r) => fmtMoney(r.collected), className: 'text-right' },
          { key: 'outstanding', header: 'Outstanding', value: (r) => r.outstanding, render: (r) => <b>{fmtMoney(r.outstanding)}</b>, className: 'text-right' },
        ]}
      />
    </>
  );
}

const AUDIT_REPORTS = [
  ['collection', 'Fee collection register'],
  ['outstanding', 'Outstanding dues register'],
  ['concession', 'Discount & scholarship register'],
  ['expenditure', 'Expenditure register'],
  ['external', 'External fee statement'],
  ['online', 'Online payment reconciliation'],
  ['daybook', 'Day book summary'],
];
function AuditorReports() {
  const { db, ayId } = useData();
  const today = todayISO();
  const ay = db.academicYears.find((a) => a.id === ayId);
  const [f, setF] = useState({ report: 'collection', from: ay?.startDate ?? today.slice(0, 8) + '01', to: today });
  const inRange = (d) => d >= f.from && d <= f.to;
  const stu = (id) => db.students.find((s) => s.id === id);
  const title = AUDIT_REPORTS.find(([k]) => k === f.report)[1];
  const spec = useMemo(() => {
    switch (f.report) {
      case 'collection':
        return {
          rows: db.payments.filter((p) => inRange(p.date)),
          columns: [
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'receiptNo', header: 'Receipt' },
            { key: 'roll', header: 'Roll no', value: (r) => stu(r.studentId)?.rollNo },
            { key: 'name', header: 'Student', value: (r) => stu(r.studentId)?.name },
            { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
            { key: 'cat', header: 'Category', value: (r) => categoryOf(db, r.feeHeadId) },
            { key: 'mode', header: 'Mode' },
            { key: 'reference', header: 'Reference' },
            { key: 'amount', header: 'Amount', value: (r) => r.amount, className: 'text-right' },
          ],
        };
      case 'outstanding':
        return {
          rows: db.invoices.filter((i) => i.academicYearId === ayId && invBalance(i) > 0),
          columns: [
            { key: 'roll', header: 'Roll no', value: (r) => stu(r.studentId)?.rollNo },
            { key: 'name', header: 'Student', value: (r) => stu(r.studentId)?.name },
            { key: 'dept', header: 'Dept', value: (r) => labelOf(db, 'departments', stu(r.studentId)?.departmentId) },
            { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
            { key: 'net', header: 'Net payable', value: invNet, className: 'text-right' },
            { key: 'paid', header: 'Paid', value: (r) => r.paid, className: 'text-right' },
            { key: 'bal', header: 'Balance', value: invBalance, className: 'text-right' },
            { key: 'dueDate', header: 'Cut-off', render: (r) => fmtDate(r.dueDate) },
          ],
        };
      case 'concession':
        return {
          rows: db.invoices.filter((i) => i.academicYearId === ayId && ((i.discount ?? 0) > 0 || (i.scholarship ?? 0) > 0)),
          columns: [
            { key: 'roll', header: 'Roll no', value: (r) => stu(r.studentId)?.rollNo },
            { key: 'name', header: 'Student', value: (r) => stu(r.studentId)?.name },
            { key: 'category', header: 'Caste category', value: (r) => stu(r.studentId)?.category },
            { key: 'concessionNote', header: 'Scheme / reason' },
            { key: 'amount', header: 'Fee', value: (r) => r.amount, className: 'text-right' },
            { key: 'discount', header: 'Discount', value: (r) => r.discount ?? 0, className: 'text-right' },
            { key: 'scholarship', header: 'Scholarship', value: (r) => r.scholarship ?? 0, className: 'text-right' },
          ],
        };
      case 'expenditure':
        return {
          rows: db.expenses.filter((e) => inRange(e.date)),
          columns: [
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'voucherNo', header: 'Voucher' },
            { key: 'category', header: 'Category' },
            { key: 'payee', header: 'Payee' },
            { key: 'description', header: 'Description' },
            { key: 'vendorInvoiceNo', header: 'Invoice no' },
            { key: 'mode', header: 'Mode' },
            { key: 'status', header: 'Status' },
            { key: 'amount', header: 'Amount', value: (r) => r.amount, className: 'text-right' },
          ],
        };
      case 'external':
        return {
          rows: [
            ...db.payments.filter((p) => inRange(p.date) && categoryOf(db, p.feeHeadId) === 'External').map((p) => ({ ...p, kind: 'Collected', party: stu(p.studentId)?.name, no: p.receiptNo })),
            ...db.expenses.filter((e) => inRange(e.date) && e.externalHeadId && e.status === 'Paid').map((e) => ({ ...e, kind: 'Remitted', party: e.payee, no: e.voucherNo, feeHeadId: e.externalHeadId })),
          ],
          columns: [
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'kind', header: 'Type' },
            { key: 'no', header: 'Receipt / voucher' },
            { key: 'head', header: 'Fee head', value: (r) => headOf(db, r.feeHeadId)?.name },
            { key: 'party', header: 'Student / payee' },
            { key: 'in', header: 'Collected', value: (r) => (r.kind === 'Collected' ? r.amount : ''), className: 'text-right' },
            { key: 'out', header: 'Remitted', value: (r) => (r.kind === 'Remitted' ? r.amount : ''), className: 'text-right' },
          ],
        };
      case 'online':
        return {
          rows: db.paymentOrders.filter((o) => inRange((o.initiatedAt ?? '').slice(0, 10))),
          columns: [
            { key: 'initiatedAt', header: 'Initiated', render: (r) => fmtDateTime(r.initiatedAt) },
            { key: 'orderId', header: 'Order id' },
            { key: 'gatewayPaymentId', header: 'Gateway payment id' },
            { key: 'name', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
            { key: 'status', header: 'Status' },
            { key: 'receipt', header: 'Receipt', value: (r) => db.payments.find((p) => p.id === r.receiptId)?.receiptNo ?? '' },
            { key: 'amount', header: 'Amount', value: (r) => r.amount, className: 'text-right' },
          ],
        };
      default: {
        const entries = cashEntries(db).filter((e) => inRange(e.date));
        const days = [...new Set(entries.map((e) => e.date))];
        return {
          rows: days.map((d) => {
            const list = entries.filter((e) => e.date === d);
            const t = (type, acc) => sum(list.filter((e) => e.type === type && (!acc || e.account === acc)).map((e) => e.amount));
            return { id: d, date: d, rc: t('Receipt', 'Cash'), rb: t('Receipt', 'Bank'), pc: t('Payment', 'Cash'), pb: t('Payment', 'Bank'), n: list.length };
          }),
          columns: [
            { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'n', header: 'Entries' },
            { key: 'rc', header: 'Cash receipts', value: (r) => r.rc, className: 'text-right' },
            { key: 'rb', header: 'Bank receipts', value: (r) => r.rb, className: 'text-right' },
            { key: 'pc', header: 'Cash payments', value: (r) => r.pc, className: 'text-right' },
            { key: 'pb', header: 'Bank payments', value: (r) => r.pb, className: 'text-right' },
          ],
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ayId, f]);
  const money2 = spec.columns.map((c) => (c.className === 'text-right' ? { ...c, render: (r) => { const v = c.value(r); return v === '' ? '' : fmtMoney(v); } } : c));
  return (
    <>
      <Card className="mb-16">
        <div className="form-grid">
          <Field label="Report">
            <Select value={f.report} onChange={(e) => setF({ ...f, report: e.target.value })}>
              {AUDIT_REPORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          {!['outstanding', 'concession'].includes(f.report) && (
            <>
              <Field label="From">
                <Input type="date" value={f.from} max={f.to} onChange={(e) => setF({ ...f, from: e.target.value })} />
              </Field>
              <Field label="To">
                <Input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} />
              </Field>
            </>
          )}
        </div>
        <p className="xs muted mt-8">Every register can be downloaded as CSV (opens in Excel) or printed / saved as PDF from the table toolbar.</p>
      </Card>
      <DataTable key={f.report} title={title} exportName={`${f.report}-${f.from}-to-${f.to}`} rows={spec.rows} columns={money2} pageSize={25} />
    </>
  );
}

export default function FinanceReports() {
  return (
    <>
      <PageHeader title="Financial Reports" subtitle="Daily reports and auditor registers — view, download and print instantly" />
      <UrlTabs
        tabs={[
          { id: 'daily', label: 'Daily report' },
          { id: 'summary', label: 'Collection summary' },
          { id: 'audit', label: 'Auditor reports' },
        ]}
      >
        {(t) => (t === 'daily' ? <DailyReport /> : t === 'summary' ? <CollectionSummary /> : <AuditorReports />)}
      </UrlTabs>
    </>
  );
}
