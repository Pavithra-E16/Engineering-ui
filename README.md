# College ERP — Accounts, Admissions, Certificates & Hostel

A role-based web application for an engineering college covering five areas:

1. **Accounts & Finance** — student fee records (total, paid, outstanding, discounts, scholarships), internal vs external fee heads, counter and online (payment gateway) collection with status tracking, fee-due SMS alerts with the payment cut-off date, cash book, expenditure (vendor invoices, hostel expenses, salaries, university remittances), and daily/auditor reports you can view, download (CSV) and print (PDF).
2. **Admissions & Students** — enquiry → follow-up → registration → admission → relieving, admission sources (reference, social media, walk-in, …) for the publicity team, complete student records with scholarships, discounts, fees, receipts and activities, and SMS updates.
3. **Certificates** — students request certificates from their own login; requests are validated by roll number and authorised by the Principal/Administrator; approved certificates carry a digital signature and a QR code; every download is logged (date, time, count); anyone can verify authenticity at `/verify/<id>`.
4. **Hostel** — resident records and provisions issued, leave/out-pass with the approving warden's details and who picked the student up (parent, sibling or other authorised person), check-out/return with parent SMS.
5. **Users, access & security** — separate logins for Principal, Accounts & Finance, Admissions, Staff, Hostel Warden, Administrator and Students; role-based menus, data-layer checks and generated Firestore rules; installable on phones (PWA) for staff.

**Stack:** React 18 (JSX), Vite, plain CSS, React Router, Lucide icons, Recharts, `qrcode`, Firebase Auth / Firestore / Cloud Functions.

## Quick start (demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Firebase credentials in `.env`, the app runs in **demo mode** with a synthetic dataset stored in the browser (IndexedDB): 252 students, fee demands and ~1,000 receipts, expenditure and salaries, enquiries, certificates and hostel leave records.

Demo accounts (password `Demo@123`):

| Role | Email |
| --- | --- |
| Principal | `principal@kvce.demo` |
| Administrator | `admin@kvce.demo` |
| Accounts & Finance | `finance@kvce.demo` |
| Admissions & Publicity | `admission@kvce.demo` |
| Staff | `staff@kvce.demo` |
| Hostel Warden (boys / girls) | `warden@kvce.demo` / `warden.girls@kvce.demo` |
| Student | `student@kvce.demo` |

In demo mode **no SMS is sent and no money is collected**: SMS are logged as delivered, and the online checkout is a simulated Razorpay test flow. **Settings → Reset demo data** regenerates the dataset.

## Who can do what

| Module | Principal | Admin | Accounts | Admissions | Staff | Warden | Student |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fees, cash book, expenditure, reports | manage | view | manage | fees view | — | — | own fees, pay online |
| Enquiries & admissions | manage | manage | view | manage | add enquiries | — | — |
| Students | manage | manage | view | manage | view | view | own profile |
| Certificates | authorise | authorise | — | — | view | — | request / download own |
| Hostel residents | manage | manage | view | — | view | manage (own hostel) | own room |
| Leave & out-pass | manage | view | — | — | view | approve / check-out | request own |
| SMS centre | manage | manage | manage | manage | — | view | — |
| Users, settings, audit logs | view | manage | — | — | — | — | — |

The matrix lives in `src/lib/roles.js`; write rules in `src/data/meta.js`.

## Production (Firebase)

1. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values.
2. Enable Email/Password sign-in in Firebase Authentication.
3. `npm run rules` (regenerates `firestore.rules` from the role matrix), then `firebase deploy --only firestore,storage`.
4. Create the first administrator in Firebase Auth and a `users/{uid}` document `{ email, name, role: "admin", active: true }`. Add other users in **Settings → Users & Access**. A student account must be linked to its student record.
5. `npm run build && firebase deploy --only hosting`.

### Production services (Cloud Functions, `functions/index.js`)

| Function | Purpose | Needs |
| --- | --- | --- |
| `createPaymentOrder` | Creates a Razorpay order; the amount is computed on the server from the student's outstanding fees | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` secrets; `VITE_PAYMENTS_ENDPOINT`, `VITE_RAZORPAY_KEY_ID` in `.env` |
| `razorpayWebhook` | Verifies the gateway signature, then writes receipts, updates balances and order status, and queues the receipt SMS | `RAZORPAY_WEBHOOK_SECRET`; webhook URL configured in the Razorpay dashboard |
| `sendQueuedSms` | Sends every queued SMS and records Sent / Failed | `SMS_API_KEY` secret and `SMS_GATEWAY_URL` param; **adapt `sendSms()` to your provider's API and DLT templates** |
| `onCertificateApproved` | Replaces the certificate signature with an HMAC made from a server-only secret | `CERT_SIGNING_SECRET` |

Deploy with `cd functions && npm install && firebase deploy --only functions`. **These functions have not been deployed or tested against live Razorpay or SMS accounts**; test them in Razorpay test mode and with your SMS provider's sandbox before going live.

## Security & privacy

- Individual logins; sessions expire after `VITE_SESSION_TIMEOUT_MINUTES` of inactivity; sign-out clears cached data.
- Authorisation at three layers: route guards and menus, a permission check on every write in the data layer, and Firestore rules generated from the same matrix.
- Students can read only their own records. Salaries are visible only to Accounts, Admin and the Principal. Parent mobile numbers are masked for roles that do not contact parents.
- Payments are marked successful only by the server after the gateway signature is verified. Student-created payment orders, SMS status changes and certificate signatures are server-only.
- Certificate verification exposes one document by its id (`allow get`), never a list.
- Append-only audit log of sign-ins, creates, updates, approvals, payments and certificate actions.
- The service worker caches only static build assets, never pages or data.

> The generated Firestore rules have not yet been run against the Firebase emulator. Test them before going live.

## Project layout

```
src/
  auth/          AuthProvider (Firebase + demo), session expiry, sign-out
  data/          store, demo (IndexedDB) and Firestore backends, permission metadata, seed
  lib/           roles, domain lists & fee maths, cash book, SMS, payments, certificates
  components/    UI kit, DataTable (search/filter/CSV/print), EntityPage (config CRUD), fee components
  pages/         Dashboard, finance/*, admissions/*, students/*, certificates/*, hostel/*, Sms, settings/*
functions/       Payment, SMS and certificate-signing Cloud Functions
scripts/         firestore.rules generator
public/          manifest.webmanifest + sw.js (installable mobile app)
```
