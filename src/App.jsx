import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { useData } from './data/store';
import { AppLayout } from './layout/AppLayout';
import { Spinner } from './components/ui';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import RegisterPage from './pages/Register';
import { ForbiddenPage, NotFoundPage } from './pages/Errors';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Fees = lazy(() => import('./pages/finance/Fees'));
const FeeSetup = lazy(() => import('./pages/finance/FeeSetup'));
const OnlinePayments = lazy(() => import('./pages/finance/OnlinePayments'));
const FeeReminders = lazy(() => import('./pages/finance/FeeReminders'));
const CashBook = lazy(() => import('./pages/finance/CashBook'));
const Expenses = lazy(() => import('./pages/finance/Expenses'));
const FinanceReports = lazy(() => import('./pages/finance/Reports'));
const Admissions = lazy(() => import('./pages/admissions/Admissions'));
const Students = lazy(() => import('./pages/students/Students'));
const StudentProfile = lazy(() => import('./pages/students/StudentProfile'));
const Certificates = lazy(() => import('./pages/certificates/Certificates'));
const VerifyPage = lazy(() => import('./pages/certificates/Verify'));
const Hostel = lazy(() => import('./pages/hostel/Hostel'));
const Leave = lazy(() => import('./pages/hostel/Leave'));
const Sms = lazy(() => import('./pages/Sms'));
const SettingsPage = lazy(() => import('./pages/settings/Settings'));
const Users = lazy(() => import('./pages/settings/Users'));
const AuditLogs = lazy(() => import('./pages/settings/AuditLogs'));
const Profile = lazy(() => import('./pages/Profile'));
function Protected({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Spinner label="Checking your session…" className="full" />;
  if (status !== 'signedIn') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
function PublicOnly({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <Spinner label="Checking your session…" className="full" />;
  if (status === 'signedIn') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
/** Module-level authorization guard (data writes are re-checked in the data layer and Firestore rules). */
function Guard({ m, children }) {
  const { can } = useData();
  return can(m) ? <>{children}</> : <ForbiddenPage />;
}
const g = (m, el) => <Guard m={m}>{el}</Guard>;
const pub = (el) => <PublicOnly>{el}</PublicOnly>;
export default function App() {
  return (
    <Suspense fallback={<Spinner className="page" />}>
      <Routes>
        <Route path="/login" element={pub(<LoginPage />)} />
        <Route path="/register" element={pub(<RegisterPage />)} />
        <Route path="/forgot-password" element={pub(<ForgotPasswordPage />)} />
        {/* Public certificate verification (QR code target) — no sign-in required. */}
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/verify/:id" element={<VerifyPage />} />
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={g('dashboard', <Dashboard />)} />
          <Route path="/finance/fees" element={g('fees', <Fees />)} />
          <Route path="/finance/fee-setup" element={g('fee-setup', <FeeSetup />)} />
          <Route path="/finance/online-payments" element={g('online-payments', <OnlinePayments />)} />
          <Route path="/finance/fee-reminders" element={g('fee-reminders', <FeeReminders />)} />
          <Route path="/finance/cash-book" element={g('cash-book', <CashBook />)} />
          <Route path="/finance/expenses" element={g('expenses', <Expenses />)} />
          <Route path="/finance/reports" element={g('finance-reports', <FinanceReports />)} />
          <Route path="/admissions" element={g('admissions', <Admissions />)} />
          <Route path="/students" element={g('students', <Students />)} />
          {/* Students may open their own profile; the page checks access itself. */}
          <Route path="/students/:id" element={<StudentProfile />} />
          <Route path="/certificates" element={g('certificates', <Certificates />)} />
          <Route path="/hostel" element={g('hostel', <Hostel />)} />
          <Route path="/hostel/leave" element={g('hostel-leave', <Leave />)} />
          <Route path="/sms" element={g('sms', <Sms />)} />
          <Route path="/settings" element={g('settings', <SettingsPage />)} />
          <Route path="/settings/users" element={g('users', <Users />)} />
          <Route path="/settings/audit-logs" element={g('audit-logs', <AuditLogs />)} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
