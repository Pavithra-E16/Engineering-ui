/**
 * Certificate generation, digital signature and verification.
 *
 * Signature = SHA-256 over the certificate's canonical fields. In Firebase
 * mode the `onCertificateApproved` Cloud Function recomputes it as an HMAC
 * with a server-held secret, so only the server can produce a valid
 * signature. In demo mode the browser computes the plain SHA-256 fingerprint
 * (tamper-evident, but not secret — clearly marked as such).
 */
import QRCode from 'qrcode';
import { fmtDate, fmtMoney } from './utils';
import { invNet } from './domain';
export { canonical, sha256 } from './signature';

/** Short, unambiguous verification id (no 0/O/1/I). */
export function newVerificationId(prefix = 'KV') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return prefix + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const verifyUrl = (id) => `${window.location.origin}/verify/${encodeURIComponent(id)}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ward = (st) => (st.gender === 'Female' ? 'D/o' : 'S/o');
const pron = (st) => (st.gender === 'Female' ? ['Ms.', 'She', 'her'] : ['Mr.', 'He', 'his']);
const ordinal = (n) => ['', 'first', 'second', 'third', 'fourth'][n] ?? `${n}th`;

function body(c, st, ctx) {
  const [title, He, his] = pron(st);
  const who = `<b>${title} ${esc(st.name)}</b> (Roll No. <b>${esc(st.rollNo)}</b>), ${ward(st)} ${esc(st.parentName)},`;
  const prog = esc(ctx.program);
  switch (c.type) {
    case 'Bonafide Certificate':
      return `<p>This is to certify that ${who} is a bonafide student of this college, studying the <b>${ordinal(st.year)} year</b> of <b>${prog}</b> during the academic year <b>${esc(ctx.ayName)}</b>.</p><p>This certificate is issued for the purpose of <b>${esc(c.purpose)}</b>.</p>`;
    case 'Study & Conduct Certificate':
      return `<p>This is to certify that ${who} has studied <b>${prog}</b> in this college during the batch <b>${esc(st.batch)}</b>.</p><p>${He} bears a good moral character and ${his} conduct during the period of study was <b>good</b>.</p>`;
    case 'Course Completion Certificate':
      return `<p>This is to certify that ${who} has completed the <b>${prog}</b> course of this college during the batch <b>${esc(st.batch)}</b>, affiliated to ${esc(ctx.university)}.</p>`;
    case 'Provisional Certificate':
      return `<p>This is to certify that ${who} has fulfilled the requirements of the <b>${prog}</b> course (batch <b>${esc(st.batch)}</b>). This provisional certificate is issued pending the award of the degree by ${esc(ctx.university)}.</p>`;
    case 'Transfer Certificate':
      return `<table class="kv">
        <tr><td>Name of the student</td><td>${esc(st.name)}</td></tr>
        <tr><td>Roll number / Admission no</td><td>${esc(st.rollNo)} / ${esc(st.admissionNo)}</td></tr>
        <tr><td>Parent / Guardian</td><td>${esc(st.parentName)}</td></tr>
        <tr><td>Date of birth</td><td>${fmtDate(st.dob)}</td></tr>
        <tr><td>Course</td><td>${prog}</td></tr>
        <tr><td>Date of admission</td><td>${fmtDate(st.admissionDate)}</td></tr>
        <tr><td>Date of leaving</td><td>${fmtDate(st.relievedOn ?? c.issuedOn)}</td></tr>
        <tr><td>Reason for leaving</td><td>${esc(st.relievingReason ?? c.purpose)}</td></tr>
        <tr><td>Conduct</td><td>Good</td></tr>
        <tr><td>Dues to the college</td><td>${ctx.balance > 0 ? fmtMoney(ctx.balance) + ' outstanding' : 'Nil'}</td></tr>
      </table>`;
    case 'Fee Paid Certificate':
      return `<p>This is to certify that ${who} studying <b>${prog}</b> has paid the following fees for the academic year <b>${esc(ctx.ayName)}</b>:</p>
        <table class="kv">${ctx.fees.map((f) => `<tr><td>${esc(f.head)}</td><td>${fmtMoney(f.paid)}</td></tr>`).join('')}
        <tr><td><b>Total paid</b></td><td><b>${fmtMoney(ctx.fees.reduce((a, f) => a + f.paid, 0))}</b></td></tr></table>
        <p>Issued for the purpose of <b>${esc(c.purpose)}</b>.</p>`;
    default:
      return `<p>This is to certify that ${who} is a student of ${prog}.</p>`;
  }
}

/** Context needed to render a certificate for a student. */
export function certificateContext(db, st, ayId) {
  const ay = db.academicYears.find((a) => a.id === ayId);
  const inv = db.invoices.filter((i) => i.studentId === st.id && i.academicYearId === ayId && i.status !== 'Cancelled');
  return {
    program: db.programs.find((p) => p.id === st.programId)?.name ?? '',
    ayName: ay?.name ?? '',
    university: db.settings[0]?.universityName ?? 'the University',
    balance: inv.reduce((a, i) => a + Math.max(0, invNet(i) - i.paid), 0),
    fees: inv.filter((i) => i.paid > 0).map((i) => ({ head: db.feeHeads.find((h) => h.id === i.feeHeadId)?.name ?? i.description, paid: i.paid })),
  };
}

/** Opens the approved certificate (with QR code and digital signature block) in a printable window. */
export async function openCertificate(c, st, ctx, settings) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) throw new Error('Allow pop-ups to download the certificate.');
  const url = verifyUrl(c.verificationId);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 180, errorCorrectionLevel: 'M' });
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.type)} · ${esc(c.certificateNo)}</title><style>
    @page{size:A4;margin:14mm}body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:0;background:#f4f4f4}
    .sheet{background:#fff;max-width:780px;margin:20px auto;padding:44px 52px;border:6px double #1a5fa8;position:relative}
    .head{text-align:center;border-bottom:2px solid #1a5fa8;padding-bottom:14px}.head h1{margin:0;font-size:24px;color:#1a5fa8;letter-spacing:.5px}
    .head p{margin:4px 0;font:12px Arial,sans-serif;color:#444}.title{text-align:center;margin:26px 0 8px;font-size:21px;text-decoration:underline;letter-spacing:1px}
    .meta{display:flex;justify-content:space-between;font:12px Arial,sans-serif;color:#333;margin:16px 0 18px}
    .body p{font-size:16px;line-height:1.85;text-align:justify}table.kv{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
    table.kv td{border:1px solid #bbb;padding:7px 10px}table.kv td:first-child{width:44%;background:#f6f9fd}
    .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;gap:20px}
    .qr{text-align:center;font:10px Arial,sans-serif;color:#444}.qr img{width:120px;height:120px;display:block;margin:0 auto 4px}
    .sign{text-align:right;font:13px Arial,sans-serif}.sign .stamp{display:inline-block;border:2px solid #1a8f4a;color:#1a8f4a;border-radius:6px;padding:6px 10px;font-size:11px;margin-bottom:8px;text-align:left}
    .hash{font:9px monospace;color:#666;word-break:break-all;margin-top:22px;border-top:1px dashed #bbb;padding-top:8px}
    .bar{max-width:780px;margin:12px auto;text-align:right;font:13px Arial}.bar button{padding:8px 16px;font:inherit;cursor:pointer}
    @media print{body{background:#fff}.sheet{margin:0;border-width:5px}.bar{display:none}}
  </style></head><body>
  <div class="bar"><button onclick="window.print()">Download / Print (Save as PDF)</button></div>
  <div class="sheet">
    <div class="head"><h1>${esc(settings.institutionName)}</h1><p>${esc(settings.address)}</p><p>${esc(settings.affiliation)}</p></div>
    <div class="title">${esc(c.type.toUpperCase())}</div>
    <div class="meta"><span>Certificate No: <b>${esc(c.certificateNo)}</b></span><span>Date: <b>${fmtDate(c.issuedOn)}</b></span></div>
    <div class="body">${body(c, st, ctx)}</div>
    <div class="foot">
      <div class="qr"><img src="${qr}" alt="Verification QR code"/>Scan to verify<br/><b>${esc(c.verificationId)}</b></div>
      <div class="sign"><div class="stamp">✔ Digitally signed<br/>by ${esc(c.signatoryName)}<br/>${esc(c.signatoryDesignation)} · ${fmtDate(c.issuedOn)}</div><br/>
      <b>${esc(c.signatoryName)}</b><br/>${esc(c.signatoryDesignation)}</div>
    </div>
    <div class="hash">Digital signature (SHA-256): ${esc(c.signature)}<br/>Verify authenticity at ${esc(url)}</div>
  </div></body></html>`);
  w.document.close();
}
