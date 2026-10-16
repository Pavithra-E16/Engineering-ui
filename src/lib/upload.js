import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage, STORAGE_ENABLED } from '../config/firebase';
export const MAX_UPLOAD_MB = 15;
const ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/zip',
];
export function validateUpload(f) {
  if (f.size > MAX_UPLOAD_MB * 1024 * 1024) return `File exceeds ${MAX_UPLOAD_MB} MB.`;
  if (f.type && !ALLOWED.includes(f.type)) return 'Unsupported file type. Upload PDF, Office documents, images, text or ZIP.';
  return null;
}
/** Largest file kept inside the browser database in demo mode. */
export const DEMO_MAX_BYTES = 1.5 * 1024 * 1024;
const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });

/**
 * Uploads to Firebase Storage when configured. In demo mode, files up to 1.5 MB are
 * kept in the browser database so they can be opened; larger files record metadata only.
 */
export async function uploadDocument(file, folder) {
  if (!STORAGE_ENABLED) {
    if (file.size <= DEMO_MAX_BYTES) return { fileName: file.name, url: await toDataUrl(file), stored: true };
    return { fileName: file.name, stored: false };
  }
  const path = `${folder}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return { fileName: file.name, url: await getDownloadURL(r), stored: true };
}
export { STORAGE_ENABLED };

/** Opens an uploaded document (Firebase URL or demo data-URL) in a new tab. */
export async function openDocument(url) {
  if (!url) return;
  if (!url.startsWith('data:')) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const blob = await (await fetch(url)).blob();
  const href = URL.createObjectURL(blob);
  window.open(href, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
