/**
 * Online fee payment through a payment gateway (Razorpay).
 *
 * Production flow (Firebase mode, VITE_PAYMENTS_ENDPOINT set):
 *   1. createPaymentOrder (Cloud Function) verifies the caller, computes the
 *      amount from the outstanding fee demands server-side and creates a
 *      Razorpay order + a `paymentOrders` document (status Created).
 *   2. The browser opens Razorpay Checkout for that order.
 *   3. razorpayWebhook (Cloud Function) verifies the gateway signature and
 *      settles the order: receipts, fee-demand balances, order status, SMS.
 *   The client never marks a payment as successful.
 *
 * Demo mode: a simulated checkout settles the order locally with the same
 * steps, emulating the webhook (store writes flagged `server`).
 */
import { auth, PAYMENTS_ENDPOINT, RAZORPAY_KEY_ID } from '../config/firebase';
import { invBalance, invStatus } from './domain';
import { SMS_TEMPLATES, toParent } from './sms';
import { nowISO, todayISO, uid } from './utils';

export const GATEWAY_READY = Boolean(PAYMENTS_ENDPOINT && RAZORPAY_KEY_ID);

/** Demo: creates the order record exactly as the server would. */
export async function createDemoOrder({ create }, student, invoices, method) {
  return create('paymentOrders', {
    orderId: 'order_' + uid().slice(0, 14).toUpperCase(),
    gateway: 'Razorpay (test)',
    studentId: student.id,
    invoiceIds: invoices.map((i) => i.id),
    amount: invoices.reduce((a, i) => a + invBalance(i), 0),
    status: 'Created',
    method,
    initiatedAt: nowISO(),
  });
}

/** Demo: emulates the verified gateway webhook. */
export async function settleDemoOrder({ db, create, update, settings }, sms, order, outcome, failureReason) {
  const S = { server: true };
  if (outcome !== 'Success') {
    await update('paymentOrders', order.id, { status: outcome, failureReason, settledAt: nowISO() }, { ...S, audit: `Online payment ${outcome.toLowerCase()}` });
    return [];
  }
  const st = db.students.find((s) => s.id === order.studentId);
  const receipts = [];
  for (const id of order.invoiceIds) {
    const inv = db.invoices.find((i) => i.id === id);
    const amount = invBalance(inv);
    if (amount <= 0) continue;
    const p = await create(
      'payments',
      {
        receiptNo: 'RC-' + Date.now().toString().slice(-8) + receipts.length,
        invoiceId: inv.id,
        studentId: inv.studentId,
        feeHeadId: inv.feeHeadId,
        amount,
        date: todayISO(),
        mode: 'Online Gateway',
        channel: 'Online',
        reference: order.orderId,
        gatewayOrderId: order.orderId,
        recordedBy: 'Payment gateway',
      },
      { ...S, audit: 'Online payment received', details: `${order.orderId} ${amount}` },
    );
    const paid = inv.paid + amount;
    await update('invoices', inv.id, { paid, status: invStatus({ ...inv, paid }) }, { ...S, audit: false });
    receipts.push(p);
  }
  const gatewayPaymentId = 'pay_' + uid().slice(0, 14).toUpperCase();
  await update(
    'paymentOrders',
    order.id,
    { status: 'Success', gatewayPaymentId, settledAt: nowISO(), receiptId: receipts[0]?.id, receiptIds: receipts.map((r) => r.id) },
    { ...S, audit: false },
  );
  if (st && receipts.length)
    await sms(
      [toParent(st, 'Fee Receipt', SMS_TEMPLATES.receipt({ st, amount: order.amount, receiptNo: receipts.map((r) => r.receiptNo).join(', ') }, settings))],
      S,
    );
  return receipts;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your connection.'));
    document.head.appendChild(s);
  });
}

/** Production: server creates the order, then Razorpay Checkout collects the payment. */
export async function payWithGateway(invoiceIds, { name, email, phone, institution }) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${PAYMENTS_ENDPOINT}/createPaymentOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ invoiceIds }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not start the payment.');
  const order = await res.json();
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: 'INR',
      name: institution,
      description: 'College fee payment',
      prefill: { name, email, contact: phone },
      handler: () => resolve('submitted'), // settlement is confirmed by the webhook
      modal: { ondismiss: () => reject(new Error('Payment window closed.')) },
    });
    rz.on('payment.failed', (r) => reject(new Error(r.error?.description ?? 'Payment failed.')));
    rz.open();
  });
}
