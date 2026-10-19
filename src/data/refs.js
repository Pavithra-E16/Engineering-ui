/**
 * Referential-integrity map: which records point at a record of each collection.
 * Used to block deleting data that is still in use (deactivate it instead).
 * Format: target collection -> [referencing collection, field, label, isArrayField?]
 */
const REFS = {
  departments: [
    ['students', 'departmentId', 'student'],
    ['programs', 'departmentId', 'program'],
    ['employees', 'departmentId', 'employee'],
  ],
  programs: [
    ['students', 'programId', 'student'],
    ['feeStructures', 'programId', 'fee structure'],
    ['enquiries', 'programId', 'enquiry'],
  ],
  academicYears: [
    ['invoices', 'academicYearId', 'fee demand'],
    ['feeStructures', 'academicYearId', 'fee structure'],
  ],
  students: [
    ['invoices', 'studentId', 'fee demand'],
    ['payments', 'studentId', 'receipt'],
    ['hostelAllocations', 'studentId', 'hostel allocation'],
    ['hostelLeaves', 'studentId', 'hostel leave'],
    ['certificates', 'studentId', 'certificate'],
    ['studentActivities', 'studentId', 'activity'],
    ['users', 'studentId', 'user account'],
  ],
  employees: [
    ['expenses', 'employeeId', 'salary payment'],
    ['users', 'employeeId', 'user account'],
  ],
  feeHeads: [
    ['invoices', 'feeHeadId', 'fee demand'],
    ['payments', 'feeHeadId', 'receipt'],
  ],
  feeStructures: [['invoices', 'feeStructureId', 'fee demand']],
  invoices: [['payments', 'invoiceId', 'receipt']],
  hostels: [
    ['hostelRooms', 'hostelId', 'room'],
    ['expenses', 'hostelId', 'hostel expense'],
  ],
  hostelRooms: [['hostelAllocations', 'roomId', 'allocation']],
};

/** Returns e.g. ["48 students", "4 receipts"]; empty when the record is safe to delete. */
export function findUsage(db, col, id) {
  return (REFS[col] ?? [])
    .map(([c, field, label, isArray]) => {
      const n = (db[c] ?? []).filter((r) => (isArray ? (r[field] ?? []).includes(id) : r[field] === id)).length;
      return n ? `${n} ${label}${n === 1 ? '' : 's'}` : null;
    })
    .filter(Boolean);
}
