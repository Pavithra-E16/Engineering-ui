import { CERT_APPROVERS, canAccess } from '../lib/roles';
export const META = {
  settings: { label: 'Settings', modules: ['settings'], shared: true },
  academicYears: { label: 'Academic Year', modules: ['settings'], shared: true },
  departments: { label: 'Department', modules: ['settings'], shared: true },
  programs: { label: 'Program', modules: ['settings'], shared: true },
  employees: { label: 'Employee', modules: ['expenses', 'users'] },
  students: {
    label: 'Student',
    modules: ['students', 'admissions', 'fees', 'hostel', 'hostel-leave', 'certificates'],
    studentKey: 'id',
  },
  enquiries: { label: 'Enquiry', modules: ['admissions'] },
  studentActivities: { label: 'Student Activity', modules: ['students'], studentKey: 'studentId' },
  feeHeads: { label: 'Fee Head', modules: ['fee-setup', 'fees'], shared: true },
  feeStructures: { label: 'Fee Structure', modules: ['fee-setup'], shared: true },
  invoices: { label: 'Fee Demand', modules: ['fees', 'fee-reminders', 'finance-reports'], studentKey: 'studentId' },
  payments: { label: 'Fee Receipt', modules: ['fees', 'cash-book', 'finance-reports'], studentKey: 'studentId' },
  paymentOrders: { label: 'Online Payment', modules: ['online-payments'], studentKey: 'studentId' },
  cashBook: { label: 'Cash Book Entry', modules: ['cash-book', 'finance-reports'] },
  expenses: { label: 'Expense', modules: ['expenses', 'cash-book', 'finance-reports'] },
  smsLogs: { label: 'SMS', modules: ['sms', 'fee-reminders'] },
  certificates: { label: 'Certificate', modules: ['certificates'], studentKey: 'studentId' },
  certificateDownloads: { label: 'Certificate Download', modules: ['certificates'], studentKey: 'studentId' },
  // Publicly verifiable by document id (see verifyCertificate); listing is limited like certificates.
  certificateVerifications: { label: 'Certificate Verification', modules: ['certificates'], studentKey: 'studentId' },
  hostels: { label: 'Hostel', modules: ['hostel'], shared: true },
  hostelRooms: { label: 'Hostel Room', modules: ['hostel'], shared: true },
  hostelAllocations: { label: 'Hostel Allocation', modules: ['hostel', 'hostel-leave'], studentKey: 'studentId' },
  hostelLeaves: { label: 'Hostel Leave', modules: ['hostel-leave'], studentKey: 'studentId' },
  notifications: { label: 'Notification', modules: [], shared: true },
  auditLogs: { label: 'Audit Log', modules: ['audit-logs'] },
  users: { label: 'User', modules: ['users'] },
  accessRequests: { label: 'Account Request', modules: ['users'] },
};
/** Users who manage accounts can read every profile; everyone else reads only their own. */
export const USER_READERS = ['admin', 'principal'];
export const canRead = (user, col) => {
  if (!user) return false;
  const m = META[col];
  if (m.shared) return true;
  if (col === 'users' && USER_READERS.includes(user.role)) return true;
  return m.modules.some((mod) => canAccess(user.role, mod, 'view'));
};
const STAFF_SMS_MODULES = ['sms', 'fee-reminders', 'fees', 'admissions', 'students', 'hostel-leave', 'certificates'];
/** Server-equivalent write check (also mirrored in firestore.rules). */
export function canWrite(user, col, rec, isCreate = false) {
  if (!user || !user.active) return false;
  const personal = user.role === 'student';
  const linked = user.linkedStudentIds ?? (user.studentId ? [user.studentId] : []);
  const own = !!rec && linked.includes(rec.studentId);
  switch (col) {
    case 'auditLogs':
      return isCreate; // append-only
    case 'notifications':
      return true; // mark-as-read; creation by any user for in-app alerts
    case 'smsLogs':
      // Any staff action that notifies a parent may queue an SMS; only the SMS centre edits status.
      if (personal) return false;
      return isCreate
        ? STAFF_SMS_MODULES.some((m) => canAccess(user.role, m, 'edit'))
        : canAccess(user.role, 'sms', 'edit') || canAccess(user.role, 'fee-reminders', 'edit');
    case 'students':
      return canAccess(user.role, 'students', 'edit') || canAccess(user.role, 'admissions', 'edit');
    case 'studentActivities':
      return canAccess(user.role, 'students', 'edit') || canAccess(user.role, 'admissions', 'edit');
    case 'invoices':
    case 'payments':
      return canAccess(user.role, 'fees', 'edit');
    case 'paymentOrders':
      // Students start their own online payment; the gateway webhook (server) settles it.
      if (personal) return isCreate && own && rec.status === 'Created';
      return canAccess(user.role, 'online-payments', 'edit') || canAccess(user.role, 'fees', 'edit');
    case 'cashBook':
      return canAccess(user.role, 'cash-book', 'edit');
    case 'certificates':
      if (personal) return isCreate && own && rec.status === 'Pending';
      if (rec?.status === 'Approved' || rec?.status === 'Rejected') return CERT_APPROVERS.includes(user.role);
      return canAccess(user.role, 'certificates', 'edit');
    case 'certificateDownloads':
      return isCreate && (personal ? own : canAccess(user.role, 'certificates', 'view'));
    case 'certificateVerifications':
      return CERT_APPROVERS.includes(user.role);
    case 'hostelLeaves':
      // Students raise their own requests and may cancel them while pending.
      if (personal) return own && (isCreate ? rec.status === 'Pending' : rec.status === 'Cancelled' || rec.status === 'Pending');
      return canAccess(user.role, 'hostel-leave', 'edit');
  }
  if (personal) return false;
  return META[col].modules.some((m) => canAccess(user.role, m, 'edit'));
}
