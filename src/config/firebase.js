import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
/** Firebase mode is enabled only when the core credentials are present. */
export const FIREBASE_ENABLED = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const STORAGE_ENABLED = FIREBASE_ENABLED && Boolean(config.storageBucket);
export const APP_MODE = FIREBASE_ENABLED ? 'firebase' : 'demo';
/** Cloud Functions base URL for payment orders (createPaymentOrder) — see functions/index.js. */
export const PAYMENTS_ENDPOINT = env.VITE_PAYMENTS_ENDPOINT || '';
/** Razorpay key id (public). The key secret stays in Cloud Functions secrets. */
export const RAZORPAY_KEY_ID = env.VITE_RAZORPAY_KEY_ID || '';
export const SESSION_TIMEOUT_MIN = Number(env.VITE_SESSION_TIMEOUT_MINUTES) || 60;
let app;
let auth;
let firestore;
let storage;
if (FIREBASE_ENABLED) {
  app = initializeApp(config);
  auth = getAuth(app);
  firestore = getFirestore(app);
  if (STORAGE_ENABLED) storage = getStorage(app);
}
export { app, auth, firestore, storage };
