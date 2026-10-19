import { useMemo, useState } from 'react';
import { CreditCard, IndianRupee, MessageSquareText, Printer, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { APP_MODE } from '../config/firebase';
import { useData } from '../data/store';
import { labelOf } from '../data/labels';
import { PAYMENT_MODES, categoryOf, headOf, invBalance, invNet, invStatus, ledger } from '../lib/domain';
import { GATEWAY_READY, createDemoOrder, payWithGateway, settleDemoOrder } from '../lib/payments';
import { SMS_TEMPLATES, toParent, useSms } from '../lib/sms';
import { fmtDate, fmtMoney, todayISO } from '../lib/utils';
import { Alert, Badge, Button, Field, Input, Modal, Select, StatCard, useToast } from './ui';

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Printable fee receipt covering one or more receipts paid together. */
export function printReceipt(db, receipts, settings) {
  if (!receipts.length) return;
  const st = db.students.find((s) => s.id === receipts[0].studentId);
  const w = window.open('', '_blank', 'width=760,height=860');
  if (!w) return;
  const total = receipts.reduce((a, p) => a + p.amount, 0);
  const rows = receipts
    .map((p) => {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      const h = headOf(db, p.feeHeadId ?? inv?.feeHeadId);
      return `<tr><td>${esc(p.receiptNo)}</td><td>${esc(h?.name ?? inv?.description)}</td><td>${esc(h?.category ?? '')}</td><td class="r">${fmtMoney(p.amount)}</td></tr>`;
    })
    .join('');
  const p0 = receipts[0];
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fee receipt ${esc(p0.receiptNo)}</title><style>
    body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:36px;color:#111}h1{font-size:19px;margin:0}.muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}td,th{padding:7px 8px;border-bottom:1px solid #e5e5e5;text-align:left}
    th{background:#f1f6fc}.r{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-top:14px}
    .tot td{font-weight:700;border-top:2px solid #111}</style></head><body>
    <h1>${esc(settings.institutionName)}</h1><p class="muted">${esc(settings.address)}</p><h3 style="margin:18px 0 0">FEE RECEIPT</h3>
    <div class="grid"><span>Student: <b>${esc(st?.name)}</b></span><span>Roll no: <b>${esc(st?.rollNo)}</b></span>
    <span>Program: ${esc(labelOf(db, 'programs', st?.programId))} · Year ${esc(st?.year)}</span><span>Date: <b>${fmtDate(p0.date)}</b></span>
    <span>Mode: ${esc(p0.mode)}</span><span>Reference: ${esc(p0.reference)}</span></div>
    <table><thead><tr><th>Receipt no</th><th>Fee head</th><th>Category</th><th class="r">Amount</th></tr></thead><tbody>${rows}
    <tr class="tot"><td colspan="3">Total received</td><td class="r">${fmtMoney(total)}</td></tr></tbody></table>
    <p class="muted" style="margin-top:12px">Balance outstanding after this payment: <b>${fmtMoney(ledger(db, st?.id).balance)}</b></p>
    <p class="muted" style="margin-top:36px">Computer-generated receipt. Recorded by ${esc(p0.recordedBy)}.</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

/** Counter collection: allocate one payment across a student's outstanding fee demands. */
export function CollectPayment({ student, onClose }) {
  const { user } = useAuth();
  const { db, create, update, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const due = useMemo(
    () => db.invoices.filter((i) => i.studentId === student.id && invBalance(i) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [db.invoices, student.id],
  );
  const [alloc, setAlloc] = useState(() => Object.fromEntries(due.map((i) => [i.id, String(invBalance(i))])));
  const [f, setF] = useState({ date: todayISO(), mode: 'Cash', reference: '', notify: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const total = due.reduce((a, i) => a + (Number(alloc[i.id]) || 0), 0);
  const save = async () => {
    setErr('');
    for (const i of due) {
      const v = Number(alloc[i.id]) || 0;
      if (v < 0 || v > invBalance(i)) return setErr(`${i.invoiceNo}: amount must be between 0 and ${fmtMoney(invBalance(i))}.`);
    }
    if (total <= 0) return setErr('Enter the amount received against at least one fee demand.');
    if (f.mode !== 'Cash' && !f.reference.trim()) return setErr('Transaction / instrument reference is required for non-cash payments.');
    if (f.date > todayISO()) return setErr('Payment date cannot be in the future.');
    setBusy(true);
    try {
      const out = [];
      let k = 0;
      for (const i of due) {
        const amt = Number(alloc[i.id]) || 0;
        if (!amt) continue;
        const p = await create(
          'payments',
          {
            receiptNo: 'RC-' + Date.now().toString().slice(-8) + k++,
            invoiceId: i.id,
            studentId: student.id,
            feeHeadId: i.feeHeadId,
            amount: amt,
            date: f.date,
            mode: f.mode,
            channel: 'Counter',
            reference: f.reference.trim() || 'CASH',
            recordedBy: user.name,
          },
          { audit: 'Recorded payment', details: `${i.invoiceNo} ${fmtMoney(amt)}` },
        );
        const paid = i.paid + amt;
        await update('invoices', i.id, { paid, status: invStatus({ ...i, paid }) }, { audit: false });
        out.push(p);
      }
      if (f.notify)
        await sms([
          toParent(student, 'Fee Receipt', SMS_TEMPLATES.receipt({ st: student, amount: total, receiptNo: out.map((p) => p.receiptNo).join(', ') }, settings)),
        ]);
      toast.success(`${fmtMoney(total)} received${f.notify ? '; receipt SMS sent to parent' : ''}.`);
      printReceipt({ ...db, invoices: db.invoices.map((i) => ({ ...i, paid: i.paid + (Number(alloc[i.id]) || 0) })) }, out, settings);
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
      title={`Collect fee · ${student.name} (${student.rollNo})`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Printer} onClick={save} loading={busy} disabled={!due.length}>
            Receive {fmtMoney(total)} & print
          </Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        {!due.length ? (
          <Alert tone="success">No outstanding fee for this student.</Alert>
        ) : (
          <div className="bordered">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Fee head</th>
                  <th>Category</th>
                  <th>Cut-off</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Receiving now</th>
                </tr>
              </thead>
              <tbody>
                {due.map((i) => (
                  <tr key={i.id}>
                    <td className="strong">{headOf(db, i.feeHeadId)?.name ?? i.description}</td>
                    <td>
                      <Badge>{categoryOf(db, i.feeHeadId)}</Badge>
                    </td>
                    <td className={i.dueDate < todayISO() ? 'text-red' : ''}>{fmtDate(i.dueDate)}</td>
                    <td className="text-right">{fmtMoney(invBalance(i))}</td>
                    <td className="text-right" style={{ width: 150 }}>
                      <Input
                        type="number"
                        min={0}
                        max={invBalance(i)}
                        value={alloc[i.id]}
                        onChange={(e) => setAlloc({ ...alloc, [i.id]: e.target.value })}
                        aria-label={`Amount for ${i.invoiceNo}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="form-grid">
          <Field label="Date" required>
            <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Mode" required>
            <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              {PAYMENT_MODES.filter((m) => m !== 'Online Gateway').map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" hint="UTR / card slip / DD or cheque no">
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </Field>
          <Field label="Notify parent">
            <label className="check-row">
              <input type="checkbox" className="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} />
              Send receipt SMS to {student.parentName}
            </label>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** Online payment checkout (Razorpay in production; simulated test checkout in demo mode). */
export function GatewayCheckout({ student, invoices, onClose }) {
  const data = useData();
  const { user } = useAuth();
  const sms = useSms();
  const toast = useToast();
  const [method, setMethod] = useState('UPI');
  const [busy, setBusy] = useState('');
  const amount = invoices.reduce((a, i) => a + invBalance(i), 0);
  const run = async (outcome) => {
    setBusy(outcome);
    try {
      if (APP_MODE === 'demo') {
        const order = await createDemoOrder(data, student, invoices, method);
        const failure = outcome === 'Failed' ? 'Payment declined by bank (simulated)' : undefined;
        const rc = await settleDemoOrder(data, sms, order, outcome, failure);
        if (outcome === 'Success') {
          toast.success(`Payment of ${fmtMoney(amount)} successful. ${rc.length} receipt(s) generated.`);
          printReceipt({ ...data.db, invoices: data.db.invoices.map((i) => (invoices.some((x) => x.id === i.id) ? { ...i, paid: invNet(i) } : i)) }, rc, data.settings);
        } else toast.error('Payment failed. No amount was charged. You can try again.');
      } else {
        await payWithGateway(
          invoices.map((i) => i.id),
          { name: student.name, email: user.email, phone: student.phone, institution: data.settings.institutionName },
        );
        toast.success('Payment submitted. The receipt appears here once the gateway confirms it (usually within a minute).');
      }
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Pay fees online"
      size="sm"
      footer={
        APP_MODE === 'demo' ? (
          <>
            <Button variant="secondary" onClick={() => run('Failed')} loading={busy === 'Failed'} disabled={!!busy}>
              Simulate failure
            </Button>
            <Button icon={CreditCard} onClick={() => run('Success')} loading={busy === 'Success'} disabled={!!busy}>
              Pay {fmtMoney(amount)}
            </Button>
          </>
        ) : (
          <Button icon={CreditCard} onClick={() => run('Success')} loading={!!busy} disabled={!GATEWAY_READY}>
            Continue to payment
          </Button>
        )
      }
    >
      <div className="stack">
        <div className="bordered">
          <table className="simple-table">
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{headOf(data.db, i.feeHeadId)?.name ?? i.description}</td>
                  <td className="text-right strong">{fmtMoney(invBalance(i))}</td>
                </tr>
              ))}
              <tr>
                <td className="strong">Total</td>
                <td className="text-right strong">{fmtMoney(amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {APP_MODE === 'demo' ? (
          <>
            <Field label="Payment method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {['UPI', 'Card', 'Netbanking'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Alert tone="warning">Demo mode: this is a simulated test checkout. No money is collected.</Alert>
          </>
        ) : GATEWAY_READY ? (
          <p className="row xs muted">
            <ShieldCheck className="icon-14" />
            Secured by Razorpay. The amount is verified by the college server.
          </p>
        ) : (
          <Alert tone="info">Online payment is not configured yet. Please pay at the accounts office.</Alert>
        )}
      </div>
    </Modal>
  );
}

/** Fee summary cards for a ledger. */
export function LedgerStats({ l }) {
  return (
    <div className="grid cols-4 stats">
      <StatCard label="Total fees" value={fmtMoney(l.gross)} icon={IndianRupee} hint={`Net payable ${fmtMoney(l.net)}`} />
      <StatCard label="Discount + scholarship" value={fmtMoney(l.discount + l.scholarship)} icon={ShieldCheck} tone="violet" hint={`Scholarship ${fmtMoney(l.scholarship)}`} />
      <StatCard label="Amount paid" value={fmtMoney(l.paid)} icon={CreditCard} tone="green" />
      <StatCard
        label="Outstanding"
        value={fmtMoney(l.balance)}
        icon={MessageSquareText}
        tone={l.balance ? 'red' : 'green'}
        hint={l.nextDue ? `Next cut-off ${fmtDate(l.nextDue)}` : 'All dues cleared'}
      />
    </div>
  );
}
