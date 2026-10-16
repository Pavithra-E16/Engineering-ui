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
  stdin: { contents: "export * from './src/lib/roles.js'; export { META } from './src/data/meta.js'; export { COLLECTIONS } from './src/types.js';", resolveDir: root, loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', outfile: tmp, logLevel: 'error',
});
const { PERMISSIONS, META, COLLECTIONS, ROLES } = await import(url.pathToFileURL(tmp).href + '?t=' + Date.now());

const rolesWith = (modules, need) => ROLES.map((r) => r.id).filter((r) => modules.some((m) => {
  const a = PERMISSIONS[r][m];
  return need === 'view' ? !!a : a === 'edit';
}));
const list = (a) => `[${a.map((x) => `'${x}'`).join(', ')}]`;
const keyExpr = (k, docVar = 'resource.data') => ({
  id: 'docId in linked()',
  studentIds: `${docVar}.studentIds.hasAny(linked())`,
  studentId: `${docVar}.studentId in linked()`,
  memberId: `${docVar}.memberId in linked()`,
  respondentId: `${docVar}.respondentId in linked()`,
})[k];

let body = '';
for (const col of COLLECTIONS) {
  const m = META[col];
  const readers = rolesWith(m.modules, 'view').filter((r) => r !== 'student' && r !== 'parent');
  const writers = rolesWith(m.modules, 'edit').filter((r) => r !== 'student' && r !== 'parent');
  let read = m.shared ? 'isActive()' : `hasRole(${list(readers)})`;
  if (!m.shared && m.studentKey) read += ` || (isPersonal() && ${keyExpr(m.studentKey)})`;
  let create = `hasRole(${list(writers)})`;
  let update = create;
  // Delete: staff who can edit the collection (plus IT admin). Special cases below.
  let del = `hasRole(${list([...new Set([...writers, 'it-admin'])])})`;
  switch (col) {
    case 'users':
      read = `isActive() && (request.auth.uid == docId || hasRole(['it-admin', 'principal']))`;
      create = `hasRole(['it-admin'])`;
      del = `hasRole(['it-admin']) && request.auth.uid != docId`;
      update = `hasRole(['it-admin']) || (request.auth.uid == docId && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastLogin', 'phone', 'updatedAt', 'updatedBy']))`;
      break;
    case 'auditLogs':
      read = `hasRole(${list(readers)})`;
      create = `isActive() && request.resource.data.userId == request.auth.uid`;
      update = 'false';
      del = 'false';
      break;
    case 'notifications':
      create = 'isActive()';
      update = `isActive() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readBy', 'updatedAt', 'updatedBy'])`;
      del = `hasRole(['it-admin'])`;
      break;
    case 'tickets':
      create = `hasRole(${list(rolesWith(['support'], 'view').filter((r) => r !== 'student' && r !== 'parent'))}) || (isPersonal() && ${keyExpr('studentId', 'request.resource.data')})`;
      update = `hasRole(${list(rolesWith(['support'], 'view').filter((r) => r !== 'student' && r !== 'parent'))}) || (isPersonal() && ${keyExpr('studentId')} && ${keyExpr('studentId', 'request.resource.data')})`;
      del = `hasRole(${list(rolesWith(['support'], 'edit').filter((r) => r !== 'student' && r !== 'parent'))}) || (isPersonal() && ${keyExpr('studentId')} && resource.data.status == 'Open')`;
      break;
    case 'feedbackResponses':
      create = `hasRole(${list(rolesWith(['feedback'], 'view').filter((r) => r !== 'student' && r !== 'parent'))}) || (role() == 'student' && request.resource.data.respondentId == me().studentId)`;
      update = 'false';
      del = `hasRole(${list(rolesWith(['feedback'], 'edit').filter((r) => r !== 'student' && r !== 'parent'))})`;
      break;
    case 'placementApplications':
      create += ` || (role() == 'student' && request.resource.data.studentId == me().studentId && request.resource.data.status == 'Applied')`;
      break;
    case 'leaveRequests':
      create += ` || (isPersonal() && ${keyExpr('studentId', 'request.resource.data')} && request.resource.data.status == 'Pending')`;
      update = `hasRole(['hod', 'mentor', 'faculty', 'principal']) || (isPersonal() && ${keyExpr('studentId')} && resource.data.status == 'Pending' && request.resource.data.status == 'Pending')`;
      del = `hasRole(['hod', 'mentor', 'faculty', 'principal', 'it-admin']) || (isPersonal() && ${keyExpr('studentId')} && resource.data.status == 'Pending')`;
      break;
    case 'students':
      create = update = `hasRole(${list(rolesWith(['admissions', 'academic-structure', 'mentoring'], 'edit'))})`;
      break;
    case 'questions':
      create = update = `hasRole(${list(rolesWith(['question-bank', 'ai-question'], 'edit'))})`;
      break;
    case 'accessRequests':
      // Signed-out visitors may only create a pending request with the expected fields; only IT admins read/decide.
      read = `hasRole(['it-admin'])`;
      create = `request.resource.data.status == 'Pending' && request.resource.data.keys().hasOnly(['id', 'name', 'email', 'phone', 'requestedRole', 'departmentId', 'reference', 'message', 'status', 'active', 'createdAt', 'updatedAt']) && request.resource.data.email is string && request.resource.data.message.size() <= 1000`;
      update = `hasRole(['it-admin'])`;
      del = `hasRole(['it-admin'])`;
      break;
    case 'evidence':
      create = update = `hasRole(${list(rolesWith(['ai-accreditation'], 'edit'))})`;
      break;
  }
  body += `
    match /${col}/{docId} {
      allow read: if ${read};
      allow create: if ${create};
      allow update: if ${update};
      allow delete: if ${del};
    }
`;
}

const rules = `rules_version = '2';
// GENERATED by scripts/generate-rules.mjs from src/lib/roles.ts and src/data/meta.ts — do not edit by hand.
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function me() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function role() { return me().role; }
    function isActive() { return signedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) && me().active != false; }
    function hasRole(roles) { return isActive() && role() in roles; }
    function isPersonal() { return isActive() && role() in ['student', 'parent']; }
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
