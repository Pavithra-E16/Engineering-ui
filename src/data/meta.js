import { canAccess } from '../lib/roles';
export const META = {
  departments: { label: 'Department', modules: ['academic-structure'], shared: true },
  programs: { label: 'Program', modules: ['academic-structure'], shared: true },
  academicYears: { label: 'Academic Year', modules: ['academic-structure'], shared: true },
  semesters: { label: 'Semester', modules: ['academic-structure'], shared: true },
  sections: { label: 'Section', modules: ['academic-structure'], shared: true },
  rooms: { label: 'Room', modules: ['academic-structure', 'timetable', 'examinations'], shared: true },
  students: {
    label: 'Student',
    modules: [
      'admissions',
      'academic-structure',
      'mentoring',
      'attendance',
      'assessments',
      'results',
      'placements',
      'finance',
      'hostel',
      'transport',
      'library',
    ],
    studentKey: 'id',
  },
  employees: { label: 'Employee', modules: ['hr'], shared: true },
  curricula: { label: 'Curriculum', modules: ['curriculum'], shared: true },
  courses: { label: 'Course', modules: ['courses', 'curriculum'], shared: true },
  allocations: { label: 'Faculty Allocation', modules: ['faculty-allocation'], shared: true },
  timetable: { label: 'Timetable Slot', modules: ['timetable'], shared: true },
  lessonPlans: { label: 'Lesson Plan', modules: ['lesson-plans'] },
  attendance: { label: 'Attendance Session', modules: ['attendance'], studentKey: 'studentIds' },
  assessments: { label: 'Assessment', modules: ['assessments', 'results'], studentKey: 'studentIds' },
  questions: { label: 'Question', modules: ['question-bank', 'ai-question'] },
  exams: { label: 'Examination', modules: ['examinations'], shared: true },
  resultPublications: { label: 'Result Publication', modules: ['results'], shared: true },
  courseFiles: { label: 'Course File', modules: ['course-files'], shared: true },
  mentoringMeetings: { label: 'Mentoring Meeting', modules: ['mentoring'] },
  courseOutcomes: { label: 'Course Outcome', modules: ['obe'], shared: true },
  programOutcomes: { label: 'Program Outcome', modules: ['obe'], shared: true },
  coPoMaps: { label: 'CO-PO Mapping', modules: ['obe'], shared: true },
  applicants: { label: 'Applicant', modules: ['admissions'] },
  feeStructures: { label: 'Fee Structure', modules: ['finance'], shared: true },
  invoices: { label: 'Invoice', modules: ['finance'], studentKey: 'studentId' },
  payments: { label: 'Payment', modules: ['finance'], studentKey: 'studentId' },
  books: { label: 'Book', modules: ['library'], shared: true },
  bookIssues: { label: 'Book Issue', modules: ['library'], studentKey: 'memberId' },
  hostels: { label: 'Hostel', modules: ['hostel'], shared: true },
  hostelRooms: { label: 'Hostel Room', modules: ['hostel'], shared: true },
  hostelAllocations: { label: 'Hostel Allocation', modules: ['hostel'], studentKey: 'studentId' },
  vehicles: { label: 'Vehicle', modules: ['transport'], shared: true },
  routes: { label: 'Route', modules: ['transport'], shared: true },
  transportAllocations: { label: 'Transport Allocation', modules: ['transport'], studentKey: 'studentId' },
  assets: { label: 'Asset', modules: ['assets'] },
  companies: { label: 'Company', modules: ['placements'], shared: true },
  drives: { label: 'Placement Drive', modules: ['placements'], shared: true },
  placementApplications: { label: 'Placement Application', modules: ['placements'], studentKey: 'studentId' },
  alumni: { label: 'Alumni', modules: ['alumni'] },
  announcements: { label: 'Announcement', modules: ['communication'], shared: true },
  feedbackForms: { label: 'Feedback Form', modules: ['feedback'], shared: true },
  feedbackResponses: { label: 'Feedback Response', modules: ['feedback'], studentKey: 'respondentId' },
  tickets: { label: 'Support Ticket', modules: ['support'], studentKey: 'studentId' },
  leaveRequests: { label: 'Leave Request', modules: ['attendance', 'mentoring'], studentKey: 'studentId' },
  events: { label: 'Event', modules: ['communication'], shared: true },
  notifications: { label: 'Notification', modules: [], shared: true },
  auditLogs: { label: 'Audit Log', modules: ['audit-logs'] },
  users: { label: 'User', modules: ['users'] },
  settings: { label: 'Settings', modules: ['settings'], shared: true },
  evidence: { label: 'Accreditation Evidence', modules: ['ai-accreditation', 'course-files'] },
  accessRequests: { label: 'Account Request', modules: ['users'] },
};
export const canRead = (user, col) => {
  if (!user) return false;
  const m = META[col];
  if (m.shared) return true;
  if (col === 'users' && (user.role === 'it-admin' || user.role === 'principal')) return true;
  return m.modules.some((mod) => canAccess(user.role, mod, 'view'));
};
/** Server-equivalent write check (also mirrored in firestore.rules). */
export function canWrite(user, col, rec, isCreate = false) {
  if (!user || !user.active) return false;
  const personal = user.role === 'student' || user.role === 'parent';
  const linked = user.linkedStudentIds ?? (user.studentId ? [user.studentId] : []);
  switch (col) {
    case 'auditLogs':
      return isCreate; // append-only
    case 'notifications':
      return true; // mark-as-read; creation by any staff for in-app alerts
    case 'tickets':
      if (personal) return !!rec && linked.includes(rec.studentId);
      return canAccess(user.role, 'support', 'view');
    case 'feedbackResponses':
      return canAccess(user.role, 'feedback', 'view') && (!personal || rec?.respondentId === user.studentId);
    case 'placementApplications':
      if (user.role === 'student') return isCreate && rec?.studentId === user.studentId;
      break;
    case 'leaveRequests':
      if (personal) return linked.includes(rec?.studentId) && (isCreate || rec?.status === 'Pending'); // own pending requests only
      return canAccess(user.role, 'mentoring', 'edit') || canAccess(user.role, 'attendance', 'edit') || user.role === 'hod';
    case 'evidence':
      return canAccess(user.role, 'ai-accreditation', 'edit');
    case 'questions':
      return canAccess(user.role, 'question-bank', 'edit') || canAccess(user.role, 'ai-question', 'edit');
    case 'students':
      return (
        canAccess(user.role, 'admissions', 'edit') ||
        canAccess(user.role, 'academic-structure', 'edit') ||
        canAccess(user.role, 'mentoring', 'edit')
      );
    case 'invoices':
    case 'payments':
      return canAccess(user.role, 'finance', 'edit');
  }
  if (personal) return false;
  return META[col].modules.some((m) => canAccess(user.role, m, 'edit'));
}
