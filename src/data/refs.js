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
    ['courses', 'departmentId', 'course'],
    ['sections', 'departmentId', 'section'],
    ['alumni', 'departmentId', 'alumni record'],
    ['assets', 'departmentId', 'asset'],
  ],
  programs: [
    ['students', 'programId', 'student'],
    ['sections', 'programId', 'section'],
    ['courses', 'programId', 'course'],
    ['curricula', 'programId', 'curriculum'],
    ['feeStructures', 'programId', 'fee structure'],
    ['applicants', 'programId', 'applicant'],
  ],
  academicYears: [
    ['semesters', 'academicYearId', 'semester'],
    ['sections', 'academicYearId', 'section'],
    ['allocations', 'academicYearId', 'allocation'],
    ['attendance', 'academicYearId', 'attendance session'],
    ['assessments', 'academicYearId', 'assessment'],
    ['invoices', 'academicYearId', 'invoice'],
  ],
  sections: [
    ['students', 'sectionId', 'student'],
    ['allocations', 'sectionId', 'allocation'],
    ['timetable', 'sectionId', 'timetable slot'],
    ['attendance', 'sectionId', 'attendance session'],
    ['assessments', 'sectionId', 'assessment'],
  ],
  rooms: [
    ['timetable', 'roomId', 'timetable slot'],
    ['exams', 'roomId', 'exam'],
    ['sections', 'room', 'section'],
  ],
  students: [
    ['attendance', 'studentIds', 'attendance session', true],
    ['assessments', 'studentIds', 'assessment', true],
    ['invoices', 'studentId', 'invoice'],
    ['payments', 'studentId', 'payment'],
    ['bookIssues', 'memberId', 'library issue'],
    ['hostelAllocations', 'studentId', 'hostel allocation'],
    ['transportAllocations', 'studentId', 'transport allocation'],
    ['placementApplications', 'studentId', 'placement application'],
    ['mentoringMeetings', 'studentId', 'mentoring record'],
    ['tickets', 'studentId', 'support ticket'],
    ['users', 'studentId', 'user account'],
  ],
  employees: [
    ['allocations', 'facultyId', 'allocation'],
    ['timetable', 'facultyId', 'timetable slot'],
    ['students', 'mentorId', 'mentee'],
    ['users', 'employeeId', 'user account'],
    ['lessonPlans', 'facultyId', 'lesson plan'],
  ],
  curricula: [['courses', 'curriculumId', 'course']],
  courses: [
    ['allocations', 'courseId', 'allocation'],
    ['timetable', 'courseId', 'timetable slot'],
    ['attendance', 'courseId', 'attendance session'],
    ['assessments', 'courseId', 'assessment'],
    ['questions', 'courseId', 'question'],
    ['exams', 'courseId', 'exam'],
    ['courseOutcomes', 'courseId', 'course outcome'],
    ['lessonPlans', 'courseId', 'lesson plan'],
    ['courseFiles', 'courseId', 'course file'],
  ],
  courseOutcomes: [
    ['coPoMaps', 'coId', 'CO-PO mapping'],
    ['assessments', 'coIds', 'assessment', true],
    ['questions', 'coId', 'question'],
  ],
  programOutcomes: [['coPoMaps', 'poId', 'CO-PO mapping']],
  feeStructures: [['invoices', 'feeStructureId', 'invoice']],
  invoices: [['payments', 'invoiceId', 'payment']],
  books: [['bookIssues', 'bookId', 'library issue']],
  hostels: [['hostelRooms', 'hostelId', 'room']],
  hostelRooms: [['hostelAllocations', 'roomId', 'allocation']],
  vehicles: [['routes', 'vehicleId', 'route']],
  routes: [['transportAllocations', 'routeId', 'allocation']],
  companies: [['drives', 'companyId', 'placement drive']],
  drives: [['placementApplications', 'driveId', 'application']],
  feedbackForms: [['feedbackResponses', 'formId', 'response']],
  courseFiles: [['evidence', 'courseFileId', 'accreditation evidence']],
};

/** Returns e.g. ["48 students", "4 courses"]; empty when the record is safe to delete. */
export function findUsage(db, col, id) {
  return (REFS[col] ?? [])
    .map(([c, field, label, isArray]) => {
      const n = (db[c] ?? []).filter((r) => (isArray ? (r[field] ?? []).includes(id) : r[field] === id)).length;
      return n ? `${n} ${label}${n === 1 ? '' : 's'}` : null;
    })
    .filter(Boolean);
}
