export const uid = (prefix = '') =>
  prefix +
  (crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    : Math.random().toString(36).slice(2, 14) + Date.now().toString(36));
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const cn = (...c) => c.filter(Boolean).join(' ');
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(+x)) return d;
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(+x)) return d;
  return x.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export const fmtMoney = (n) => (n === undefined || n === null || isNaN(n) ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'));
export const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
export const round1 = (n) => Math.round(n * 10) / 10;
export const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
export const avg = (a) => (a.length ? sum(a) / a.length : 0);
export const groupBy = (arr, key) => arr.reduce((acc, x) => ((acc[key(x)] ||= []).push(x), acc), {});
export const daysBetween = (a, b) => Math.round((+new Date(b) - +new Date(a)) / 86400000);
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
/** CSV export of rows → download. */
export function exportCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** Opens a print-friendly window containing a table. */
export function printTable(title, headers, rows, subtitle = '') {
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) return;
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>
    body{font-family:Inter,Segoe UI,sans-serif;color:#111;margin:24px}
    h1{font-size:18px;margin:0}p{color:#555;font-size:12px;margin:4px 0 16px}
    table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
    th{background:#eef3fb}tr:nth-child(even) td{background:#fafafa}
    </style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)} · Generated ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    </tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
/** PBKDF2-SHA256 password hashing (demo mode only — production uses Firebase Auth). */
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
/** Deterministic PRNG for synthetic data. */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    normal: (mean, sd) => {
      const u = 1 - next(),
        v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
