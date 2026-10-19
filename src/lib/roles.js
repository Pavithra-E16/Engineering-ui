export const ROLES = [
  { id: 'principal', label: 'Principal', description: 'Separate login with full oversight, approvals and reports' },
  { id: 'admin', label: 'Administrator', description: 'Users, access, settings, certificate authorisation and audit logs' },
  { id: 'finance', label: 'Accounts & Finance', description: 'Fees, cash book, expenditure, payment gateway and financial reports' },
  { id: 'admission', label: 'Admissions & Publicity', description: 'Enquiries, registrations, admissions and admission sources' },
  { id: 'staff', label: 'Staff', description: 'Student lookup, enquiries and day-to-day functions (mobile friendly)' },
  { id: 'warden', label: 'Hostel Warden', description: 'Hostel residents, provisions, leave and out-pass approvals' },
  { id: 'student', label: 'Student', description: 'Own profile, fee details, hostel leave and certificates' },
];
export const roleLabel = (r) => ROLES.find((x) => x.id === r)?.label ?? r;
export const MODULES = [
  { id: 'dashboard', label: 'Dashboard', group: 'Main', path: '/dashboard', icon: 'LayoutDashboard' },
  { id: 'fees', label: 'Student Fees', group: 'Accounts & Finance', path: '/finance/fees', icon: 'Wallet' },
  { id: 'fee-setup', label: 'Fee Heads & Structures', group: 'Accounts & Finance', path: '/finance/fee-setup', icon: 'Layers' },
  { id: 'online-payments', label: 'Online Payments', group: 'Accounts & Finance', path: '/finance/online-payments', icon: 'CreditCard' },
  { id: 'fee-reminders', label: 'Fee Due Alerts', group: 'Accounts & Finance', path: '/finance/fee-reminders', icon: 'BellRing' },
  { id: 'cash-book', label: 'Cash Book', group: 'Accounts & Finance', path: '/finance/cash-book', icon: 'BookOpen' },
  { id: 'expenses', label: 'Expenditure', group: 'Accounts & Finance', path: '/finance/expenses', icon: 'Receipt' },
  { id: 'finance-reports', label: 'Financial Reports', group: 'Accounts & Finance', path: '/finance/reports', icon: 'FileBarChart' },
  { id: 'admissions', label: 'Enquiries & Admissions', group: 'Admissions & Students', path: '/admissions', icon: 'UserPlus' },
  { id: 'students', label: 'Students', group: 'Admissions & Students', path: '/students', icon: 'Users' },
  { id: 'certificates', label: 'Certificates', group: 'Certificates', path: '/certificates', icon: 'Award' },
  { id: 'hostel', label: 'Hostel Residents', group: 'Hostel', path: '/hostel', icon: 'BedDouble' },
  { id: 'hostel-leave', label: 'Leave & Out-pass', group: 'Hostel', path: '/hostel/leave', icon: 'DoorOpen' },
  { id: 'sms', label: 'SMS Centre', group: 'Communication', path: '/sms', icon: 'MessageSquareText' },
  { id: 'settings', label: 'Institution Settings', group: 'Settings', path: '/settings', icon: 'Settings' },
  { id: 'users', label: 'Users & Access', group: 'Settings', path: '/settings/users', icon: 'UserCheck' },
  { id: 'audit-logs', label: 'Audit Logs', group: 'Settings', path: '/settings/audit-logs', icon: 'ScrollText' },
];
export const moduleById = (id) => MODULES.find((m) => m.id === id);
const FINANCE = ['fees', 'fee-setup', 'online-payments', 'fee-reminders', 'cash-book', 'expenses', 'finance-reports'];
const all = (ids, a) => Object.fromEntries(ids.map((m) => [m, a]));
/** Role → module access matrix. Mirrored in firestore.rules (npm run rules). */
export const PERMISSIONS = {
  // The Principal sees and manages everything except system administration.
  principal: {
    dashboard: 'view',
    ...all(FINANCE, 'edit'),
    admissions: 'edit',
    students: 'edit',
    certificates: 'edit',
    hostel: 'edit',
    'hostel-leave': 'edit',
    sms: 'edit',
    settings: 'view',
    users: 'view',
    'audit-logs': 'view',
  },
  admin: {
    dashboard: 'view',
    ...all(FINANCE, 'view'),
    admissions: 'edit',
    students: 'edit',
    certificates: 'edit',
    hostel: 'edit',
    'hostel-leave': 'view',
    sms: 'edit',
    settings: 'edit',
    users: 'edit',
    'audit-logs': 'view',
  },
  finance: {
    dashboard: 'view',
    ...all(FINANCE, 'edit'),
    admissions: 'view',
    students: 'view',
    hostel: 'view',
    sms: 'edit',
  },
  admission: {
    dashboard: 'view',
    admissions: 'edit',
    students: 'edit',
    fees: 'view',
    sms: 'edit',
  },
  staff: {
    dashboard: 'view',
    admissions: 'edit',
    students: 'view',
    certificates: 'view',
    hostel: 'view',
    'hostel-leave': 'view',
  },
  warden: {
    dashboard: 'view',
    students: 'view',
    hostel: 'edit',
    'hostel-leave': 'edit',
    sms: 'view',
  },
  student: {
    dashboard: 'view',
    fees: 'view',
    'online-payments': 'view',
    certificates: 'view',
    hostel: 'view',
    'hostel-leave': 'view',
  },
};
export const canAccess = (role, m, need = 'view') => {
  if (!role) return false;
  const a = PERMISSIONS[role]?.[m];
  if (!a) return false;
  return need === 'view' ? true : a === 'edit';
};
/** Roles whose data must be limited to their own student record. */
export const isPersonalRole = (r) => r === 'student';
/** Roles that may authorise (approve and digitally sign) certificates. */
export const CERT_APPROVERS = ['principal', 'admin'];
