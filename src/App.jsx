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
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Structure = lazy(() => import('./pages/academic/Structure'));
const Curriculum = lazy(() => import('./pages/academic/Curriculum'));
const Courses = lazy(() => import('./pages/academic/Courses'));
const Allocation = lazy(() => import('./pages/academic/Allocation'));
const Timetable = lazy(() => import('./pages/academic/Timetable'));
const LessonPlans = lazy(() => import('./pages/academic/LessonPlans'));
const Attendance = lazy(() => import('./pages/academic/Attendance'));
const Assessments = lazy(() => import('./pages/academic/Assessments'));
const QuestionBank = lazy(() => import('./pages/academic/QuestionBank'));
const Examinations = lazy(() => import('./pages/academic/Examinations'));
const Results = lazy(() => import('./pages/academic/Results'));
const CourseFiles = lazy(() => import('./pages/academic/CourseFiles'));
const Mentoring = lazy(() => import('./pages/academic/Mentoring'));
const Obe = lazy(() => import('./pages/academic/Obe'));
const Admissions = lazy(() => import('./pages/admin/Admissions'));
const HR = lazy(() => import('./pages/admin/HR'));
const Finance = lazy(() => import('./pages/admin/Finance'));
const Library = lazy(() => import('./pages/admin/Library'));
const Hostel = lazy(() => import('./pages/admin/Hostel'));
const Transport = lazy(() => import('./pages/admin/Transport'));
const Assets = lazy(() => import('./pages/admin/Assets'));
const Placements = lazy(() => import('./pages/services/Placements'));
const Alumni = lazy(() => import('./pages/services/Alumni'));
const Communication = lazy(() => import('./pages/services/Communication'));
const Feedback = lazy(() => import('./pages/services/Feedback'));
const Support = lazy(() => import('./pages/services/Support'));
const EarlyWarning = lazy(() => import('./pages/ai/EarlyWarning'));
const HodAI = lazy(() => import('./pages/ai/HodDashboard'));
const Accreditation = lazy(() => import('./pages/ai/Accreditation'));
const QuestionAI = lazy(() => import('./pages/ai/QuestionAssistant'));
const Decision = lazy(() => import('./pages/ai/DecisionSupport'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/settings/Settings'));
const Users = lazy(() => import('./pages/settings/Users'));
const AuditLogs = lazy(() => import('./pages/settings/AuditLogs'));
const Profile = lazy(() => import('./pages/Profile'));
const Student360 = lazy(() => import('./pages/Student360'));
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
export default function App() {
  return (
    <Suspense fallback={<Spinner className="page" />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={g('dashboard', <Dashboard />)} />
          <Route path="/academic/structure" element={g('academic-structure', <Structure />)} />
          <Route path="/academic/curriculum" element={g('curriculum', <Curriculum />)} />
          <Route path="/academic/courses" element={g('courses', <Courses />)} />
          <Route path="/academic/allocation" element={g('faculty-allocation', <Allocation />)} />
          <Route path="/academic/timetable" element={g('timetable', <Timetable />)} />
          <Route path="/academic/lesson-plans" element={g('lesson-plans', <LessonPlans />)} />
          <Route path="/academic/attendance" element={g('attendance', <Attendance />)} />
          <Route path="/academic/assessments" element={g('assessments', <Assessments />)} />
          <Route path="/academic/question-bank" element={g('question-bank', <QuestionBank />)} />
          <Route path="/academic/examinations" element={g('examinations', <Examinations />)} />
          <Route path="/academic/results" element={g('results', <Results />)} />
          <Route path="/academic/course-files" element={g('course-files', <CourseFiles />)} />
          <Route path="/academic/mentoring" element={g('mentoring', <Mentoring />)} />
          <Route path="/academic/obe" element={g('obe', <Obe />)} />
          <Route path="/admin/admissions" element={g('admissions', <Admissions />)} />
          <Route path="/admin/hr" element={g('hr', <HR />)} />
          <Route path="/admin/finance" element={g('finance', <Finance />)} />
          <Route path="/admin/library" element={g('library', <Library />)} />
          <Route path="/admin/hostel" element={g('hostel', <Hostel />)} />
          <Route path="/admin/transport" element={g('transport', <Transport />)} />
          <Route path="/admin/assets" element={g('assets', <Assets />)} />
          <Route path="/services/placements" element={g('placements', <Placements />)} />
          <Route path="/services/alumni" element={g('alumni', <Alumni />)} />
          <Route path="/services/communication" element={g('communication', <Communication />)} />
          <Route path="/services/feedback" element={g('feedback', <Feedback />)} />
          <Route path="/services/support" element={g('support', <Support />)} />
          <Route path="/ai/early-warning" element={g('ai-early-warning', <EarlyWarning />)} />
          <Route path="/ai/hod-dashboard" element={g('ai-hod', <HodAI />)} />
          <Route path="/ai/accreditation" element={g('ai-accreditation', <Accreditation />)} />
          <Route path="/ai/question-assistant" element={g('ai-question', <QuestionAI />)} />
          <Route path="/ai/decision-support" element={g('ai-decision', <Decision />)} />
          <Route path="/reports" element={g('reports', <Reports />)} />
          <Route path="/settings" element={g('settings', <SettingsPage />)} />
          <Route path="/settings/users" element={g('users', <Users />)} />
          <Route path="/settings/audit-logs" element={g('audit-logs', <AuditLogs />)} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/students/:id" element={<Student360 />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
