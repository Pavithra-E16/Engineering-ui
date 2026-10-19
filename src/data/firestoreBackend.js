/**
 * PRODUCTION persistence via Cloud Firestore. Each permitted collection is
 * subscribed in real time; students only subscribe to documents
 * that reference their own record (firestore.rules enforces the same).
 */
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { COLLECTIONS } from '../types';
import { META, USER_READERS, canRead } from './meta';
export async function fetchProfile(uid) {
  const snap = await getDoc(doc(firestore, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export function subscribeAll(user, onData, onError) {
  const unsubs = [];
  const personal = user.role === 'student';
  const linked = user.linkedStudentIds ?? (user.studentId ? [user.studentId] : []);
  COLLECTIONS.forEach((col) => {
    if (!canRead(user, col)) {
      onData(col, []);
      return;
    }
    const meta = META[col];
    const ref = collection(firestore, col);
    if (col === 'users' && !USER_READERS.includes(user.role)) {
      unsubs.push(onSnapshot(doc(firestore, 'users', user.id), (s) => onData(col, s.exists() ? [{ id: s.id, ...s.data() }] : []), onError));
      return;
    }
    if (personal && !meta.shared && meta.studentKey) {
      // One listener per linked student, merged.
      const parts = {};
      linked.forEach((sid) => {
        const q =
          meta.studentKey === 'id'
            ? query(ref, where(documentId(), '==', sid))
            : meta.studentKey === 'studentIds'
              ? query(ref, where('studentIds', 'array-contains', sid))
              : query(ref, where(meta.studentKey, '==', sid));
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              parts[sid] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              onData(col, Object.values(parts).flat());
            },
            onError,
          ),
        );
      });
      if (!linked.length) onData(col, []);
      return;
    }
    if (personal && !meta.shared) {
      onData(col, []);
      return;
    }
    unsubs.push(
      onSnapshot(
        ref,
        (snap) =>
          onData(
            col,
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          ),
        onError,
      ),
    );
  });
  return () => unsubs.forEach((u) => u());
}
const clean = (o) => JSON.parse(JSON.stringify(o));
export const fsCreate = (col, rec) => setDoc(doc(firestore, col, rec.id), clean(rec));
export const fsUpdate = (col, id, patch) => updateDoc(doc(firestore, col, id), clean(patch));
export const fsDelete = (col, id) => deleteDoc(doc(firestore, col, id));
/** IT-admin utility: write the synthetic dataset (except users) into an empty Firestore project. */
export async function seedFirestore(db, onProgress) {
  for (const col of COLLECTIONS) {
    if (col === 'users' || col === 'auditLogs') continue;
    const rows = db[col];
    for (let i = 0; i < rows.length; i += 400) {
      const batch = writeBatch(firestore);
      rows.slice(i, i + 400).forEach((r) => batch.set(doc(firestore, col, r.id), clean(r)));
      await batch.commit();
    }
    onProgress?.(`${col}: ${rows.length}`);
  }
}
/** Public certificate lookup by verification id (rules allow a single-document get without sign-in). */
export async function fetchVerification(id) {
  const snap = await getDoc(doc(firestore, 'certificateVerifications', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
