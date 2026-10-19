/**
 * Cash book = every receipt and payment of the college, built from
 *  - fee receipts (payments collection),
 *  - paid expenditure vouchers (expenses collection), and
 *  - other manual receipts / payments / contra entries (cashBook collection).
 * Cash-mode entries go to the Cash account; all other modes to Bank.
 */
import { accountOf, categoryOf, headOf } from './domain';

export function cashEntries(db) {
  const stu = new Map(db.students.map((s) => [s.id, s]));
  const out = [];
  db.payments.forEach((p) => {
    const st = stu.get(p.studentId);
    out.push({
      id: p.id,
      date: p.date,
      at: p.createdAt,
      voucherNo: p.receiptNo,
      type: 'Receipt',
      account: accountOf(p.mode),
      head: headOf(db, p.feeHeadId)?.name ?? 'Fee',
      group: `${categoryOf(db, p.feeHeadId)} fee`,
      particulars: `Fee from ${st?.name ?? 'student'} (${st?.rollNo ?? ''}) · ${p.mode}`,
      amount: p.amount,
      source: 'Fee receipt',
    });
  });
  db.expenses
    .filter((e) => e.status === 'Paid')
    .forEach((e) =>
      out.push({
        id: e.id,
        date: e.date,
        at: e.createdAt,
        voucherNo: e.voucherNo,
        type: 'Payment',
        account: accountOf(e.mode),
        head: e.category,
        group: e.category,
        particulars: `${e.payee}${e.description ? ' · ' + e.description : ''}`,
        amount: e.amount,
        source: 'Expenditure',
      }),
    );
  db.cashBook.forEach((c) =>
    out.push({ ...c, at: c.createdAt, group: c.head === 'Contra' ? 'Contra' : 'Other ' + c.type.toLowerCase(), source: 'Cash book' }),
  );
  return out.sort((a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at)));
}

const signed = (e) => (e.type === 'Receipt' ? e.amount : -e.amount);
export const opening = (settings, account) =>
  account === 'Cash' ? (settings.openingCash ?? 0) : account === 'Bank' ? (settings.openingBank ?? 0) : (settings.openingCash ?? 0) + (settings.openingBank ?? 0);

/** Balance at the start of `date` for an account ('Cash' | 'Bank' | '' for both). */
export function balanceBefore(entries, settings, date, account) {
  return entries
    .filter((e) => e.date < date && e.date >= (settings.openingDate ?? '') && (!account || e.account === account))
    .reduce((a, e) => a + signed(e), opening(settings, account));
}

/** Entries in [from, to] with a running balance. */
export function withRunning(entries, settings, from, to, account) {
  let bal = balanceBefore(entries, settings, from, account);
  const open = bal;
  const rows = entries
    .filter((e) => e.date >= from && e.date <= to && (!account || e.account === account))
    .map((e) => {
      bal += signed(e);
      return { ...e, balance: bal };
    });
  return { open, close: bal, rows };
}
