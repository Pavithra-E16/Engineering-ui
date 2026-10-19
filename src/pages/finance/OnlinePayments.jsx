import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, CreditCard, TimerOff, XCircle } from 'lucide-react';
import { APP_MODE } from '../../config/firebase';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { Alert, Badge, Button, PageHeader, StatCard, useToast } from '../../components/ui';
import { GATEWAY_READY } from '../../lib/payments';
import { fmtDateTime, fmtMoney, sum } from '../../lib/utils';

const STATUSES = ['Created', 'Pending', 'Success', 'Failed', 'Expired'];

export default function OnlinePayments() {
  const { db, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const edit = can('online-payments', 'edit');
  const rows = db.paymentOrders;
  const by = (s) => rows.filter((o) => o.status === s);
  const expire = async (o) => {
    try {
      await update('paymentOrders', o.id, { status: 'Expired', failureReason: 'No confirmation from gateway – marked expired' }, { audit: 'Online payment expired', details: o.orderId });
      toast.success('Order marked as expired.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const receiptNos = (o) =>
    (o.receiptIds ?? (o.receiptId ? [o.receiptId] : []))
      .map((id) => db.payments.find((p) => p.id === id)?.receiptNo)
      .filter(Boolean)
      .join(', ');
  return (
    <>
      <PageHeader
        title={scope.personal ? 'My Online Payments' : 'Online Payments'}
        subtitle="Payment gateway transactions and their status: created, pending, successful, failed or expired"
        actions={
          scope.personal && (
            <Link className="btn btn-secondary" to="/finance/fees">
              <CreditCard />
              Pay fees
            </Link>
          )
        }
      />
      <div className="mb-16">
        <Alert tone={APP_MODE === 'demo' ? 'warning' : GATEWAY_READY ? 'success' : 'info'} title="Payment gateway">
          {APP_MODE === 'demo'
            ? 'Demo mode: Razorpay test checkout is simulated in the browser and no money is collected. In production the order is created and confirmed by Cloud Functions (createPaymentOrder and razorpayWebhook), so a payment is marked successful only after the gateway signature is verified.'
            : GATEWAY_READY
              ? 'Razorpay is connected. Orders are created by the server, and receipts are generated automatically when the gateway webhook confirms payment.'
              : 'Razorpay is not configured. Set VITE_PAYMENTS_ENDPOINT and VITE_RAZORPAY_KEY_ID and deploy the payment Cloud Functions.'}
        </Alert>
      </div>
      <div className="grid cols-4 stats">
        <StatCard label="Successful" value={fmtMoney(sum(by('Success').map((o) => o.amount)))} icon={CheckCircle2} tone="green" hint={`${by('Success').length} transactions`} />
        <StatCard label="Pending / created" value={by('Pending').length + by('Created').length} icon={Clock} tone="amber" />
        <StatCard label="Failed" value={by('Failed').length} icon={XCircle} tone="red" />
        <StatCard label="Expired" value={by('Expired').length} icon={TimerOff} tone="slate" />
      </div>
      <DataTable
        title="Gateway transactions"
        exportName="online-payments"
        rows={rows}
        initialSort={{ key: 'initiatedAt', dir: 'desc' }}
        filters={[
          { key: 'status', label: 'Status', options: STATUSES.map((v) => ({ value: v, label: v })), match: (r, v) => r.status === v },
          { key: 'method', label: 'Method', options: ['UPI', 'Card', 'Netbanking'].map((v) => ({ value: v, label: v })), match: (r, v) => r.method === v },
        ]}
        columns={[
          { key: 'initiatedAt', header: 'Initiated', render: (r) => fmtDateTime(r.initiatedAt) },
          { key: 'orderId', header: 'Order id' },
          ...(scope.personal ? [] : [{ key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) }]),
          { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => fmtMoney(r.amount), className: 'text-right' },
          { key: 'method', header: 'Method' },
          { key: 'gateway', header: 'Gateway' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'gatewayPaymentId', header: 'Gateway payment id' },
          { key: 'receipt', header: 'Receipt', value: receiptNos },
          { key: 'failureReason', header: 'Failure reason' },
          { key: 'settledAt', header: 'Settled', render: (r) => fmtDateTime(r.settledAt) },
        ]}
        actions={
          edit
            ? (r) =>
                r.status === 'Created' || r.status === 'Pending' ? (
                  <Button size="sm" variant="ghost" icon={TimerOff} title="Mark expired" onClick={() => expire(r)}>
                    Expire
                  </Button>
                ) : null
            : undefined
        }
      />
    </>
  );
}
