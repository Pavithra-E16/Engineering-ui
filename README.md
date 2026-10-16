# Engineering College ERP

A role-based ERP web application for engineering colleges. It covers academics, administration, student services, five AI-assisted features, and reporting, for 18 stakeholder roles.

**Stack:** React 18 (JavaScript / JSX), Vite, plain CSS (`src/styles/app.css`), React Router, Lucide icons, Recharts, Firebase Auth, Cloud Firestore and Firebase Storage. No TypeScript and no CSS framework.

## Quick start (demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Firebase credentials in `.env`, the app runs in **demo mode**:

- A deterministic synthetic dataset is generated and stored in the browser (IndexedDB). It includes 6 departments, 8 programs, 288 students, 62 staff, 162 courses, about 1,300 attendance sessions, assessments, results, finance, library, hostel, transport, placements and more.
- Demo accounts exist for every role, `<role>@kvce.demo`, all with the password `Demo@123`. Examples: `principal@kvce.demo`, `hod@kvce.demo`, `faculty@kvce.demo`, `student@kvce.demo`, `parent@kvce.demo`, `it-admin@kvce.demo`.
- Passwords are stored only as PBKDF2-SHA256 hashes. Demo auth is a separate code path from Firebase Auth.
- The Sign In page has a **development-only** account picker. It only fills in the credentials; a user's role always comes from their account record.
- **Settings → Reset demo data** regenerates the dataset.

A banner on every page marks demo mode.

## Production (Firebase)

1. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values. The app switches to Firebase mode automatically.
2. Enable **Email/Password** sign-in in Firebase Authentication.
3. Deploy the rules and indexes: `firebase deploy --only firestore,storage`.
4. Bootstrap the first administrator:
   - Create the user in Firebase Authentication.
   - In Firestore, create `users/{uid}` with `{ email, name, role: "it-admin", active: true, createdAt, updatedAt }`.
5. Sign in as that administrator. Optionally seed an empty dev project from **Settings → Seed Firestore**. Then add other users in **User Management**: create each login in Firebase Auth first, then add the ERP profile using its UID.
6. Build and host: `npm run build && firebase deploy --only hosting`.

## Security model

- **Authentication.** Firebase Auth handles email/password sign-in (plus optional Google, Microsoft and Apple sign-in, once enabled in Firebase; the account must already have an ERP profile), password reset, and session persistence ("Remember me" uses local persistence; otherwise the session lasts for the tab). Sessions expire after `VITE_SESSION_TIMEOUT_MINUTES` of inactivity.
- **Sign-out.** The user confirms, the action is audited, Firebase/demo session state and user-specific browser caches are cleared, and the user is redirected to Sign In. Private routes are guarded, so browser Back cannot reveal a private page.
- **Authorization at three layers:**
  1. Route guards and role-based menus (`src/lib/roles.js`).
  2. A permission check inside the data service on every write (`src/data/meta.js`, `canWrite`). Student and parent reads are limited to linked students.
  3. **Firestore security rules**, generated from the same matrix by `npm run rules`, so the client and server cannot drift. Roles are read from `users/{uid}` on the server, so users cannot change their own role. Audit logs are append-only.
- **Audit logging.** Sign-ins, creates, updates, approvals, publications and payments are recorded (**Settings → Audit Logs**).

> The Firestore rules have not yet been exercised against the Firebase emulator. Test them before going live, especially the student/parent scoped queries.

## AI features

These five pages compute their indicators transparently from authorised ERP data:

- Early-Warning System
- AI HOD Dashboard
- Accreditation & Audit Assistant
- Question Assistant
- Decision Support

With no AI endpoint configured, narrative output comes from templates. It is labelled **"SIMULATED DEMO RESULT — no AI model connected"**.

To enable Gemini, deploy `functions/index.js`. That function verifies the caller's ID token and role and keeps the API key server-side. Then set `VITE_AI_ENDPOINT`. AI-drafted questions always enter the Question Bank as *Pending Review* and need faculty approval.

## Payments

Finance records offline or verified payments and prints receipts. **No payment gateway is integrated**, and the app does not collect money.

## Project layout

```
src/
  auth/           AuthProvider (Firebase + demo), session expiry, sign-out
  config/         Firebase initialisation and mode detection
  data/           types-driven store, demo (IndexedDB) and Firestore backends,
                  permission metadata, analytics (attendance, grading, OBE, risk), seed
  styles/app.css  The whole design system: brand blue (#1a8fe0) sidebar/top bar, cards, tables, forms, login page
  components/     UI kit, DataTable (search/sort/filter/paginate/CSV/print), EntityPage (config-driven CRUD)
  layout/         Sidebar, top bar (breadcrumbs, global search, AY selector, notifications, profile)
  pages/          dashboard, academic/*, admin/*, services/*, ai/*, settings/*, reports, profile, student 360
functions/        Secure Gemini integration point (Cloud Function)
scripts/          firestore.rules generator
```

Configurable rules live in **Settings**: current academic year, minimum attendance, assessment weights, grade bands, pass mark, CO target, attainment levels, and library loan/fine. Results, attendance eligibility and OBE attainment are recalculated everywhere from these values.
