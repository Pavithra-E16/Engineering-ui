/**
 * Server-side functions for the College ERP (Firebase Cloud Functions v2).
 * NOT deployed by default — see README "Production services".
 *
 *   cd functions && npm install
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 *   firebase functions:secrets:set SMS_API_KEY
 *   firebase functions:secrets:set CERT_SIGNING_SECRET
 *   firebase deploy --only functions
 *
 * - createPaymentOrder  (HTTPS)  student starts an online payment; the amount is computed here from Firestore.
 * - razorpayWebhook     (HTTPS)  verifies the gateway signature and settles the order (receipts, balances, SMS).
 * - sendQueuedSms       (trigger) sends every smsLogs document created with status Queued.
 * - onCertificateApproved (trigger) signs approved certificates with an HMAC held only on the server.
 */
import crypto from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();
const REGION = 'asia-south1';
const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const SMS_API_KEY = defineSecret('SMS_API_KEY');
const CERT_SIGNING_SECRET = defineSecret('CERT_SIGNING_SECRET');
/** HTTPS endpoint of your SMS provider. The request format in sendSms() must be adapted to that provider's API. */
const SMS_GATEWAY_URL = defineString('SMS_GATEWAY_URL', { default: '' });
const ALLOWED_ORIGIN = defineString('ALLOWED_ORIGIN', { default: '' });

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const net = (i) => (i.amount ?? 0) - (i.discount ?? 0) - (i.scholarship ?? 0);
const balance = (i) => (i.status === 'Cancelled' ? 0 : Math.max(0, net(i) - (i.paid ?? 0)));
const status = (i, paid) => (paid >= net(i) ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid');
const audit = (userId, action, entity, entityId, details) =>
  db.collection('auditLogs').add({ userId, userName: 'System', role: 'server', action, entity, entityId, details, createdAt: now(), updatedAt: now(), active: true });

function cors(req, res) {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN.value() || '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

/** Student starts an online payment for some of their own outstanding fee demands. */
export const createPaymentOrder = onRequest({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const { uid } = await getAuth().verifyIdToken(token);
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (!user || user.active === false) return res.status(403).json({ error: 'Account not authorised.' });
    const settings = (await db.doc('settings/settings').get()).data() ?? {};
    if (settings.gatewayEnabled === false) return res.status(403).json({ error: 'Online payment is disabled by the college.' });
    const ids = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds.slice(0, 20) : [];
    const linked = user.linkedStudentIds ?? [];
    const invs = (await Promise.all(ids.map((id) => db.doc(`invoices/${id}`).get()))).filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
    const ok = invs.filter((i) => (user.role === 'student' ? linked.includes(i.studentId) : false) && balance(i) > 0);
    if (!ok.length || new Set(ok.map((i) => i.studentId)).size !== 1) return res.status(400).json({ error: 'Select your own outstanding fees.' });
    const amount = ok.reduce((a, i) => a + balance(i), 0);
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID.value()}:${RAZORPAY_KEY_SECRET.value()}`).toString('base64') },
      body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt: `fee_${Date.now()}`, notes: { studentId: ok[0].studentId } }),
    });
    if (!r.ok) throw new Error(`Razorpay order failed: ${r.status}`);
    const order = await r.json();
    await db.doc(`paymentOrders/${order.id}`).set({
      orderId: order.id,
      gateway: 'Razorpay',
      studentId: ok[0].studentId,
      invoiceIds: ok.map((i) => i.id),
      amount,
      status: 'Created',
      initiatedAt: now(),
      createdBy: uid,
      createdAt: now(),
      updatedAt: now(),
      active: true,
    });
    res.json({ orderId: order.id, amountPaise: order.amount });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: 'Could not start the payment.' });
  }
});

/** Razorpay webhook (payment.captured / payment.failed). Configure the endpoint and secret in the Razorpay dashboard. */
export const razorpayWebhook = onRequest({ region: REGION, secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value()).update(req.rawBody).digest('hex');
  if (!sig || !crypto.timingSafeEqual(Buffer.from(String(sig)), Buffer.from(expected))) return res.status(400).send('Invalid signature');
  const ev = req.body;
  const p = ev?.payload?.payment?.entity;
  if (!p?.order_id) return res.status(200).send('ignored');
  const orderRef = db.doc(`paymentOrders/${p.order_id}`);
  try {
    if (ev.event === 'payment.failed') {
      await orderRef.update({ status: 'Failed', failureReason: p.error_description ?? 'Payment failed', method: p.method, updatedAt: now() });
      return res.status(200).send('ok');
    }
    if (ev.event !== 'payment.captured') return res.status(200).send('ignored');
    const receipts = await db.runTransaction(async (tx) => {
      const order = (await tx.get(orderRef)).data();
      if (!order || order.status === 'Success') return []; // idempotent: webhooks may be delivered more than once
      if (Math.round(order.amount * 100) !== p.amount) throw new Error('Amount mismatch');
      const invSnaps = await Promise.all(order.invoiceIds.map((id) => tx.get(db.doc(`invoices/${id}`))));
      const out = [];
      invSnaps.forEach((s, k) => {
        const inv = { id: s.id, ...s.data() };
        const amt = balance(inv);
        if (amt <= 0) return;
        const ref = db.collection('payments').doc();
        const rec = {
          receiptNo: `RC-${Date.now().toString().slice(-8)}${k}`,
          invoiceId: inv.id,
          studentId: inv.studentId,
          feeHeadId: inv.feeHeadId,
          amount: amt,
          date: today(),
          mode: 'Online Gateway',
          channel: 'Online',
          reference: p.id,
          gatewayOrderId: order.orderId,
          recordedBy: 'Payment gateway',
          createdAt: now(),
          updatedAt: now(),
          active: true,
        };
        tx.set(ref, rec);
        tx.update(s.ref, { paid: (inv.paid ?? 0) + amt, status: status(inv, (inv.paid ?? 0) + amt), updatedAt: now() });
        out.push({ id: ref.id, ...rec });
      });
      tx.update(orderRef, { status: 'Success', gatewayPaymentId: p.id, method: p.method, settledAt: now(), receiptIds: out.map((r) => r.id), receiptId: out[0]?.id ?? null, updatedAt: now() });
      return out;
    });
    if (receipts.length) {
      const st = (await db.doc(`students/${receipts[0].studentId}`).get()).data();
      const total = receipts.reduce((a, r) => a + r.amount, 0);
      if (st?.parentPhone)
        await db.collection('smsLogs').add({
          to: st.parentPhone,
          recipientName: st.parentName,
          studentId: receipts[0].studentId,
          type: 'Fee Receipt',
          message: `Dear Parent, Rs.${total} received towards the fees of ${st.name} (${st.rollNo}). Receipt ${receipts.map((r) => r.receiptNo).join(', ')}. Thank you.`,
          status: 'Queued',
          sentAt: now(),
          sentBy: 'Payment gateway',
          createdAt: now(),
          updatedAt: now(),
          active: true,
        });
      await audit('server', 'Online payment received', 'Payment', p.order_id, `${total}`);
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    res.status(500).send('error'); // Razorpay retries failed deliveries
  }
});

/** Adapt the request body to your SMS provider (e.g. MSG91, Textlocal, Twilio). DLT template ids are required in India. */
async function sendSms(to, message, sender) {
  const url = SMS_GATEWAY_URL.value();
  if (!url) throw new Error('SMS_GATEWAY_URL is not configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SMS_API_KEY.value()}` },
    body: JSON.stringify({ sender, to: to.replace(/\D/g, '').slice(-10), message }),
  });
  if (!r.ok) throw new Error(`SMS provider returned ${r.status}`);
  return r.json().catch(() => ({}));
}

export const sendQueuedSms = onDocumentCreated({ document: 'smsLogs/{id}', region: REGION, secrets: [SMS_API_KEY] }, async (event) => {
  const m = event.data?.data();
  if (!m || m.status !== 'Queued') return;
  const settings = (await db.doc('settings/settings').get()).data() ?? {};
  try {
    const out = await sendSms(m.to, m.message, settings.smsSenderId ?? 'COLLEGE');
    await event.data.ref.update({ status: 'Sent', providerId: out?.id ?? out?.request_id ?? null, deliveredAt: now(), updatedAt: now() });
  } catch (e) {
    await event.data.ref.update({ status: 'Failed', error: String(e.message ?? e), updatedAt: now() });
  }
});

const canonical = (c) =>
  [c.certificateNo, c.verificationId, c.type, c.studentName, c.rollNo, c.issuedOn, c.signatoryName, c.signatoryDesignation].join('|');

/** Replaces the client placeholder with an HMAC-SHA256 signature only the server can produce. */
export const onCertificateApproved = onDocumentUpdated({ document: 'certificates/{id}', region: REGION, secrets: [CERT_SIGNING_SECRET] }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || after.status !== 'Approved' || before?.status === 'Approved' || !after.verificationId) return;
  const st = (await db.doc(`students/${after.studentId}`).get()).data();
  const payload = { ...after, studentName: st?.name ?? '' };
  const signature = crypto.createHmac('sha256', CERT_SIGNING_SECRET.value()).update(canonical(payload)).digest('hex');
  await event.data.after.ref.update({ signature, signedBy: 'server', updatedAt: now() });
  await db.doc(`certificateVerifications/${after.verificationId}`).set({ signature, signedAt: FieldValue.serverTimestamp() }, { merge: true });
});
