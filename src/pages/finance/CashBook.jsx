import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react';
import { useData } from '../../data/store';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Badge, Card, Field, Input, PageHeader, Select, StatCard } from '../../components/ui';
import { cashEntries, withRunning } from '../../lib/cashbook';
import { fmtDate, fmtMoney, sum, todayISO } from '../../lib/utils';

function Ledger() {
  const { db, settings } = useData();
  const today = todayISO();
  const [f, setF] = useState({ from: today.slice(0, 8) + '01', to: today, account: '' });
  const entries = useMemo(() => cashEntries(db), [db]);
  const { open, close, rows } = useMemo(() => withRunning(entries, settings, f.from, f.to, f.account), [entries, settings, f]);
  const rec = sum(rows.filter((r) => r.type === 'Receipt').map((r) => r.amount));
  const pay = sum(rows.filter((r) => r.type === 'Payment').map((r) => r.amount));
  const acct = f.account || 'Cash + Bank';
  return (
    <>
      <Card className="mb-16">
        <div className="form-grid">
          <Field label="From">
            <Input type="date" value={f.from} max={f.to} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <Field label="Account">
            <Select value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
              <option value="">Cash + Bank</option>
              <option>Cash</option>
              <option>Bank</option>
            </Select>
          </Field>
        </div>
      </Card>
      <div className="grid cols-4 stats">
        <StatCard label={`Opening balance (${acct})`} value={fmtMoney(open)} icon={Landmark} hint={fmtDate(f.from)} />
        <StatCard label="Receipts" value={fmtMoney(rec)} icon={ArrowDownLeft} tone="green" hint={`${rows.filter((r) => r.type === 'Receipt').length} entries`} />
        <StatCard label="Payments" value={fmtMoney(pay)} icon={ArrowUpRight} tone="red" hint={`${rows.filter((r) => r.type === 'Payment').length} entries`} />
        <StatCard label={`Closing balance (${acct})`} value={fmtMoney(close)} icon={Wallet} tone="blue" hint={fmtDate(f.to)} />
      </div>
      <DataTable
        title={`Cash book · ${fmtDate(f.from)} – ${fmtDate(f.to)} · ${acct}`}
        exportName={`cash-book-${f.from}-to-${f.to}`}
        rows={rows}
        pageSize={25}
        initialSort={{ key: 'date', dir: 'asc' }}
        filters={[
          { key: 'type', label: 'Type', options: ['Receipt', 'Payment'].map((v) => ({ value: v, label: v })), match: (r, v) => r.type === v },
          {
            key: 'source',
            label: 'Source',
            options: ['Fee receipt', 'Expenditure', 'Cash book'].map((v) => ({ value: v, label: v })),
            match: (r, v) => r.source === v,
          },
        ]}
        columns={[
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'voucherNo', header: 'Voucher / receipt' },
          { key: 'particulars', header: 'Particulars' },
          { key: 'head', header: 'Head' },
          { key: 'account', header: 'A/c', render: (r) => <Badge tone={r.account === 'Cash' ? 'amber' : 'blue'}>{r.account}</Badge> },
          { key: 'dr', header: 'Receipt (Dr)', value: (r) => (r.type === 'Receipt' ? r.amount : ''), render: (r) => (r.type === 'Receipt' ? fmtMoney(r.amount) : ''), className: 'text-right' },
          { key: 'cr', header: 'Payment (Cr)', value: (r) => (r.type === 'Payment' ? r.amount : ''), render: (r) => (r.type === 'Payment' ? fmtMoney(r.amount) : ''), className: 'text-right' },
          { key: 'balance', header: 'Balance', value: (r) => r.balance, render: (r) => <b>{fmtMoney(r.balance)}</b>, className: 'text-right', sortable: false },
        ]}
      />
    </>
  );
}

export default function CashBook() {
  return (
    <>
      <PageHeader title="Cash Book" subtitle="All receipts and payments with running cash and bank balances" />
      <UrlTabs
        tabs={[
          { id: 'book', label: 'Cash book' },
          { id: 'other', label: 'Other receipts & payments' },
        ]}
      >
        {(t) =>
          t === 'book' ? (
            <Ledger />
          ) : (
            <EntityPage
              config={{
                collection: 'cashBook',
                title: 'Other receipts, payments & contra entries',
                singular: 'Cash Book Entry',
                module: 'cash-book',
                noDeactivate: true,
                initialSort: { key: 'date', dir: 'desc' },
                emptyMessage: 'Fee receipts and expenditure vouchers post to the cash book automatically. Record other receipts (donations, interest, form sales) and contra entries here.',
                defaults: () => ({ date: todayISO(), voucherNo: 'RV-' + Date.now().toString().slice(-6) }),
                fields: [
                  { key: 'voucherNo', label: 'Voucher no', required: true, unique: true },
                  { key: 'date', label: 'Date', type: 'date', required: true, validate: (v) => (v > todayISO() ? 'Date cannot be in the future' : undefined) },
                  { key: 'type', label: 'Type', type: 'select', options: ['Receipt', 'Payment'], required: true, filter: true, render: (r) => <Badge>{r.type}</Badge> },
                  { key: 'account', label: 'Account', type: 'select', options: ['Cash', 'Bank'], required: true, filter: true },
                  {
                    key: 'head',
                    label: 'Head',
                    type: 'select',
                    options: ['Donation', 'Bank interest', 'Application forms', 'Scrap sale', 'Contra', 'Petty cash', 'Refund', 'Other'],
                    required: true,
                    filter: true,
                    hint: 'Contra = transfer between cash and bank (record both sides)',
                  },
                  { key: 'particulars', label: 'Particulars', required: true, wide: true },
                  { key: 'amount', label: 'Amount', type: 'money', min: 1, required: true },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
