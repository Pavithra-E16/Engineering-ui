/**
 * Secure server-side AI endpoint (Firebase Cloud Functions v2) — integration
 * point for Google Gemini. NOT deployed by default.
 *
 *   cd functions && npm install
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase deploy --only functions:aiAssist
 *   # then set VITE_AI_ENDPOINT in the web app's .env
 *
 * The function verifies the caller's Firebase ID token, loads the caller's
 * role from Firestore, checks the task is permitted for that role, and only
 * then forwards a minimised prompt to Gemini. The API key never leaves the server.
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
admin.initializeApp();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TASK_ROLES = {
  "early-warning-summary": ["management", "principal", "dean", "hod", "program-coordinator", "faculty", "mentor"],
  "hod-summary": ["management", "principal", "dean", "hod"],
  "accreditation-report": ["principal", "dean", "hod", "program-coordinator", "iqac", "accreditation"],
  "question-drafts": ["hod", "course-champion", "faculty"],
  "decision-support": ["management", "principal", "dean", "iqac"]
};
const PROMPTS = {
  "early-warning-summary": (p) => `You are an academic advisor. Using ONLY this aggregated, de-identified data, summarise key risk patterns and suggest supportive interventions. Return JSON {"summary": string, "actions": string[]}.
${JSON.stringify(p)}`,
  "hod-summary": (p) => `Summarise this department's performance for the Head of Department in 5 concise bullet points with evidence. Return JSON {"bullets": string[]}.
${JSON.stringify(p)}`,
  "accreditation-report": (p) => `Draft an accreditation self-assessment section from this evidence mapping. Flag missing evidence. Return JSON {"report": string}.
${JSON.stringify(p)}`,
  "question-drafts": (p) => `Draft exam questions strictly from these course outcomes and topics. Return JSON {"questions": [{"text": string, "type": string, "difficulty": string, "bloom": string, "marks": number}]}.
${JSON.stringify(p)}`,
  "decision-support": (p) => `Analyse these institutional KPIs, identify trends and give evidence-based recommendations. Return JSON {"insights": string[], "recommendations": string[]}.
${JSON.stringify(p)}`
};
const aiAssist = onRequest({ secrets: [GEMINI_API_KEY], cors: true, region: "asia-south1" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  try {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const decoded = await admin.auth().verifyIdToken(token);
    const profile = await admin.firestore().doc(`users/${decoded.uid}`).get();
    const role = profile.get("role");
    const { task, payload } = req.body ?? {};
    if (!profile.exists || profile.get("active") === false || !role || !TASK_ROLES[task]?.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const model = new GoogleGenerativeAI(GEMINI_API_KEY.value()).getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
    const out = await model.generateContent(PROMPTS[task](payload));
    await admin.firestore().collection("auditLogs").add({ userId: decoded.uid, role, action: "AI request", entity: task, createdAt: (/* @__PURE__ */ new Date()).toISOString(), active: true });
    res.json({ data: JSON.parse(out.response.text()), model: "gemini-1.5-flash" });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: "Unauthorized or AI error" });
  }
});
export {
  aiAssist
};
