/**
 * DEMO MODE persistence: the whole synthetic database lives in IndexedDB
 * (one key per collection) so it survives refreshes without the 5 MB
 * localStorage limit. Nothing here is used when Firebase is configured.
 */
import { COLLECTIONS } from '../types';
import { buildSeed } from './seed';
const DB_NAME = 'kvce-erp-demo';
const STORE = 'collections';
const VERSION_KEY = '__seedVersion';
export const SEED_VERSION = 4;
function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const t = idb.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const req = fn(s);
    t.oncomplete = () => {
      resolve(req ? req.result : undefined);
      idb.close();
    };
    t.onerror = () => {
      reject(t.error);
      idb.close();
    };
  });
}
let cache = null;
let loading = null;
async function readAll() {
  const ver = await tx('readonly', (s) => s.get(VERSION_KEY));
  if (ver !== SEED_VERSION) return null;
  const idb = await open();
  const out = {};
  await new Promise((resolve, reject) => {
    const t = idb.transaction(STORE, 'readonly');
    const s = t.objectStore(STORE);
    COLLECTIONS.forEach((c) => {
      const r = s.get(c);
      r.onsuccess = () => (out[c] = r.result ?? []);
    });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  idb.close();
  return out;
}
async function writeAll(db) {
  const idb = await open();
  await new Promise((resolve, reject) => {
    const t = idb.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    COLLECTIONS.forEach((c) => s.put(db[c] ?? [], c));
    s.put(SEED_VERSION, VERSION_KEY);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  idb.close();
}
export async function loadDemo() {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    let db = null;
    try {
      db = await readAll();
    } catch {
      db = null;
    }
    if (!db) {
      db = await buildSeed();
      try {
        await writeAll(db);
      } catch (e) {
        console.warn('IndexedDB unavailable; demo data will not persist', e);
      }
    }
    cache = db;
    return db;
  })();
  return loading;
}
const pending = new Set();
let scheduled = false;
/** Persist changed collections. Writes in the same tick are batched into one transaction. */
export function persist(db, cols) {
  cache = db;
  cols.forEach((c) => pending.add(c));
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(async () => {
    scheduled = false;
    const list = [...pending];
    pending.clear();
    try {
      await tx('readwrite', (s) => {
        list.forEach((c) => s.put(cache[c], c));
      });
    } catch (e) {
      console.error('Persist failed', e);
    }
  });
}
/** Public (signed-out) account request — the only write allowed without a session. */
export async function addAccessRequestDemo(rec) {
  const db = await loadDemo();
  db.accessRequests = [...(db.accessRequests ?? []), rec];
  persist(db, ['accessRequests']);
}

export async function demoUsers() {
  return (await loadDemo()).users;
}
export async function resetDemo() {
  cache = null;
  loading = null;
  await tx('readwrite', (s) => s.clear());
}
/** Public certificate verification lookup (works signed-out, like the production endpoint). */
export async function demoVerification(id) {
  const db = await loadDemo();
  return (db.certificateVerifications ?? []).find((v) => v.id === id) ?? null;
}
