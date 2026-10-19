// Generates firestore.rules from the same permission matrix the app uses
// (src/lib/roles.js + src/data/meta.js) so client and server never drift.
//   npm run rules
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, 'node_modules', '.rules-gen.mjs');
await build({
  stdin: { contents: "export * from './src/lib/roles.js'; export { META, USER_READERS } from './src/data/meta.js'; export { COLLECTIONS } from './src/types.js';", resolveDir: root, loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', outfile: tmp, logLevel: 'error',
});
const { PERMISSIONS, META, COLLECTIONS, ROLES, USER_READERS, CERT_APPROVERS } = await import(url.pathToFileURL(tmp).href + '?t=' + Date.now());

const staff = (a) => a.filter((r) => r !== 'student');
const rolesWith = (modules, need) => staff(ROLES.map((r) => r.id).filter((r) => modules.some((m) => {
  const a = PERMISSIONS[r][m];
  return need === 'view' ? !!a : a === 'edit';
})));
const list = (a) => `[${a.map((x) => `'${x}'`).join(', ')}]`;
const own = (k = 'studentId', v = 'resource.data') => (k === 'id' ? 'docId in linked()' : `${v}.${k} in linked()`);
const newOwn = own('studentId', 'request.resource.data');
const status = (s) => `request.resource.data.status == '${s}'`;

let body = '';
for (const col of COLLECTIONS) {
  const m = META[col];
  const readers = rolesWith(m.modules, 'view');
  const writers = rolesWith(m.modules, 'edit');
  let read = m.shared ? 'isActive()' : `hasRole(${list(readers)})`;
  if (!m.shared && m.studentKey) read += ` || (isStudent() && ${own(m.studentKey)})`;
  let create = `hasRole(${list(writers)})`;
  let update = create;
  let del = `hasRole(${list([...new Set([...writers, 'admin'])])})`;
  const extra = [];
  switch (col) {
    case 'users':
      read = `isActive() && (request.auth.uid == docId || hasRole(${list(USER_READERS)}))`;
      create = `hasRole(['admin'])`;
      del = `hasRole(['admin']) && request.auth.uid != docId`;
      update = `hasRole(['admin']) || (request.auth.uid == docId && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastLogin', 'phone', 'updatedAt', 'updatedBy']))`;
      break;
    case 'auditLogs':
      create = `isActive() && request.resource.data.userId == request.auth.uid`;
      update = del = 'false';
      break;
    case 'notifications':
      create = 'isActive()';
      update = `isActive() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readBy', 'updatedAt', 'updatedBy'])`;
      del = `hasRole(['admin'])`;
      break;
    case 'smsLogs':
      // Staff actions queue SMS; only the server (Cloud Function) changes delivery status.
      create = `hasRole(${list(rolesWith(['sms', 'fee-reminders', 'fees', 'admissions', 'students', 'hostel-leave', 'certificates'], 'edit'))}) && ${status('Queued')}`;
      update = 'false';
      del = `hasRole(['admin'])`;
      break;
    case 'students':
    case 'studentActivities':
      create = update = `hasRole(${list(rolesWith(['students', 'admissions'], 'edit'))})`;
      break;
    case 'invoices':
    case 'payments':
      create = update = `hasRole(${list(rolesWith(['fees'], 'edit'))})`;
      break;
    case 'paymentOrders':
      // Orders are created and settled by the payment Cloud Functions; staff may only expire stale ones.
      create = 'false';
      update = `hasRole(${list(rolesWith(['online-payments', 'fees'], 'edit'))}) && ${status('Expired')} && resource.data.status in ['Created', 'Pending']`;
      del = 'false';
      break;
    case 'certificates':
      // Students may request only their own certificate, and the roll number must match their student record.
      create = `(hasRole(${list(writers)}) || (isStudent() && ${newOwn})) && ${status('Pending')} && request.resource.data.rollNo == get(/databases/$(database)/documents/students/$(request.resource.data.studentId)).data.rollNo`;
      update = `hasRole(${list(CERT_APPROVERS)})`;
      del = `hasRole(['admin'])`;
      break;
    case 'certificateDownloads':
      create = `(hasRole(${list(readers)}) || (isStudent() && ${newOwn})) && request.resource.data.userId == request.auth.uid`;
      update = del = 'false';
      break;
    case 'certificateVerifications':
      // Public authenticity check: anyone may fetch ONE document by its verification id; listing needs a role.
      extra.push(`allow get: if true;`);
      read = `hasRole(${list(readers)}) || (isStudent() && ${own()})`;
      create = update = `hasRole(${list(CERT_APPROVERS)})`;
      del = 'false';
      break;
    case 'hostelLeaves':
      create += ` || (isStudent() && ${newOwn} && ${status('Pending')})`;
      update += ` || (isStudent() && ${own()} && resource.data.status == 'Pending' && ${status('Cancelled')})`;
      del = `hasRole(['admin'])`;
      break;
    case 'accessRequests':
      // Signed-out visitors may only create a pending request with the expected fields; only admins read/decide.
      read = `hasRole(['admin'])`;
      create = `request.resource.data.status == 'Pending' && request.resource.data.keys().hasOnly(['id', 'name', 'email', 'phone', 'requestedRole', 'departmentId', 'reference', 'message', 'status', 'active', 'createdAt', 'updatedAt']) && request.resource.data.email is string && request.resource.data.message.size() <= 1000`;
      update = del = `hasRole(['admin'])`;
      break;
  }
  body += `
    match /${col}/{docId} {
      ${extra.join('\n      ')}${extra.length ? '\n      ' : ''}allow read: if ${read};
      allow create: if ${create};
      allow update: if ${update};
      allow delete: if ${del};
    }
`;
}

const rules = `rules_version = '2';
// GENERATED by scripts/generate-rules.mjs from src/lib/roles.js and src/data/meta.js — do not edit by hand.
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function me() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function role() { return me().role; }
    function isActive() { return signedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) && me().active != false; }
    function hasRole(roles) { return isActive() && role() in roles; }
    function isStudent() { return isActive() && role() == 'student'; }
    function linked() { return me().get('linkedStudentIds', []); }
${body}
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;
fs.writeFileSync(path.join(root, 'firestore.rules'), rules);
fs.unlinkSync(tmp);
console.log(`firestore.rules written (${COLLECTIONS.length} collections)`);
