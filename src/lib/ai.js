/**
 * AI integration point.
 *
 * Production: set VITE_AI_ENDPOINT to the deployed Cloud Function in
 * functions/src/index.ts. The browser sends ONLY the task name and an
 * already-authorised, minimised payload together with the user's Firebase ID
 * token; the function verifies the token and role, then calls Gemini with a
 * server-held key. No AI key is ever shipped to the browser.
 *
 * Demo / not configured: callers fall back to deterministic, rule-based
 * output that the UI labels as "SIMULATED DEMO RESULT".
 */
import { AI_ENDPOINT, auth } from '../config/firebase';
export const AI_CONNECTED = Boolean(AI_ENDPOINT);
export async function runAi(task, payload, simulate) {
  if (!AI_CONNECTED || !auth?.currentUser) {
    await new Promise((r) => setTimeout(r, 650)); // keep UX consistent with a network call
    return { data: simulate(), simulated: true };
  }
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task, payload }),
  });
  if (!res.ok) throw new Error(`AI service error (${res.status}). Please try again later.`);
  const json = await res.json();
  return { data: json.data, simulated: false, model: json.model };
}
