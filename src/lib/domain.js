/** Shared lookup lists and calculations for the college ERP domain. */
import { sum } from './utils';

export const ADMISSION_SOURCES = [
  'Walk-in',
  'Reference',
  'Social Media – Instagram',
  'Social Media – Facebook',
  'Social Media – YouTube',
  'Website / Google',
  'Newspaper',
  'Hoardings / Flex',
  'Education Fair',
  'Consultant / Agent',
  'Other',
];
/** Social-media sources grouped together for publicity reports. */
export const sourceGroup = (s) => (s?.startsWith('Social Media') ? 'Social Media' : (s ?? 'Other'));
export const REFERENCE_TYPES = ['Staff', 'Current Student', 'Alumni', 'Parent', 'Agent', 'Other'];
export const ENQUIRY_STAGES = ['Enquiry', 'Follow-up', 'Registered', 'Admitted', 'Not Interested'];
export const STUDENT_STATUSES = ['Active', 'Relieved', 'Course Completed', 'Discontinued'];
export const QUOTAS = ['Convener', 'Management', 'NRI', 'Lateral Entry'];
export const CATEGORIES = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'SC', 'ST', 'EWS'];
export const SCHOLARSHIP_SCHEMES = [
  'Vidya Deevena (Govt. RTF)',
  'Post-Matric Scholarship (SC/ST)',
  'Merit Scholarship (College)',
  'Sports Quota',
  'Minority Scholarship',
];
export const DISCOUNT_REASONS = ['Sibling Concession', 'Staff Ward', 'Management Concession', 'Early Payment', 'Alumni Ward'];
export const ACTIVITY_TYPES = ['Achievement', 'Event Participation', 'Sports', 'Counselling', 'Disciplinary', 'Internship', 'Other'];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'DD / Cheque', 'Online Gateway'];
/** Cash-book account a payment mode settles into. */
export const accountOf = (mode) => (mode === 'Cash' ? 'Cash' : 'Bank');
export const EXPENSE_CATEGORIES = [
  'Vendor Invoice',
  'Hostel Expense',
  'Employee Salary',
  'University Fee Remittance',
  'Examination Fee Remittance',
  'Utilities',
  'Maintenance',
  'Other',
];
/** Expense categories that are payments to external parties (university / examination board). */
export const EXTERNAL_EXPENSES = ['University Fee Remittance', 'Examination Fee Remittance'];

export const CERT_TYPES = [
  'Bonafide Certificate',
  'Study & Conduct Certificate',
  'Transfer Certificate',
  'Course Completion Certificate',
  'Fee Paid Certificate',
  'Provisional Certificate',
];

export const PROVISIONS = ['Cot', 'Mattress', 'Pillow', 'Cupboard', 'Table & Chair', 'Room Key', 'Mess Card', 'ID Card'];
export const LEAVE_TYPES = ['Home Visit', 'Outing', 'Medical', 'Emergency', 'Festival Holidays'];
export const PICKUP_RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Guardian', 'Relative', 'Other Authorised Person', 'Self (no pick-up)'];
export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Checked Out', 'Returned', 'Cancelled'];

// ---------- fees ----------
/** Net payable on a fee demand after discount and scholarship. */
export const invNet = (i) => (i.amount ?? 0) - (i.discount ?? 0) - (i.scholarship ?? 0);
export const invBalance = (i) => (i.status === 'Cancelled' ? 0 : Math.max(0, invNet(i) - (i.paid ?? 0)));
export const invStatus = (i) =>
  i.status === 'Cancelled' ? 'Cancelled' : (i.paid ?? 0) >= invNet(i) ? 'Paid' : (i.paid ?? 0) > 0 ? 'Partially Paid' : 'Unpaid';
export const headOf = (db, id) => db.feeHeads.find((h) => h.id === id);
export const categoryOf = (db, feeHeadId) => headOf(db, feeHeadId)?.category ?? 'Internal';

/** Fee summary for one student (optionally one academic year). */
export function ledger(db, studentId, ayId) {
  const inv = db.invoices.filter((i) => i.studentId === studentId && i.status !== 'Cancelled' && (!ayId || i.academicYearId === ayId));
  return {
    invoices: inv,
    gross: sum(inv.map((i) => i.amount)),
    discount: sum(inv.map((i) => i.discount ?? 0)),
    scholarship: sum(inv.map((i) => i.scholarship ?? 0)),
    net: sum(inv.map(invNet)),
    paid: sum(inv.map((i) => i.paid ?? 0)),
    balance: sum(inv.map(invBalance)),
    nextDue: inv
      .filter((i) => invBalance(i) > 0)
      .map((i) => i.dueDate)
      .sort()[0],
  };
}

/** Totals split by fee category (Internal / External) for a set of receipts. */
export function splitByCategory(db, payments) {
  const out = { Internal: 0, External: 0 };
  payments.forEach((p) => (out[categoryOf(db, p.feeHeadId)] += p.amount));
  return out;
}

export const nextNo = (prefix) => `${prefix}-${Date.now().toString().slice(-8)}`;
