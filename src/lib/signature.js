/** Certificate signing primitives (kept separate from the QR/printing code so they load cheaply). */
export const canonical = (c) =>
  [c.certificateNo, c.verificationId, c.type, c.studentName, c.rollNo, c.issuedOn, c.signatoryName, c.signatoryDesignation].join('|');

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
