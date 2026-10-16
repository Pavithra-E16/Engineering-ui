import { EntityPage } from '../../components/EntityPage';
import { Alert, PageHeader } from '../../components/ui';
export const courseConfig = {
  collection: 'courses',
  title: 'Courses',
  singular: 'Course',
  module: 'courses',
  rowFilter: (r, { scope }) => !scope.departmentId || r.departmentId === scope.departmentId,
  initialSort: { key: 'code', dir: 'asc' },
  defaults: ({ scope }) => (scope.departmentId ? { departmentId: scope.departmentId } : {}),
  fields: [
    { key: 'code', label: 'Code', required: true, unique: true },
    { key: 'name', label: 'Course name', required: true },
    { key: 'credits', label: 'Credits', type: 'number', min: 0, max: 12, required: true, hint: 'Usually L + T + P÷2 (e.g. 3-1-2 → 5)' },
    {
      key: 'L',
      label: 'L – Lecture hours / week',
      type: 'number',
      min: 0,
      max: 6,
      required: true,
      table: false,
      default: 3,
      hint: 'Classroom teaching hours per week',
    },
    {
      key: 'T',
      label: 'T – Tutorial hours / week',
      type: 'number',
      min: 0,
      max: 4,
      required: true,
      table: false,
      default: 0,
      hint: 'Problem-solving / doubt-clearing hours per week',
    },
    {
      key: 'P',
      label: 'P – Practical (lab) hours / week',
      type: 'number',
      min: 0,
      max: 8,
      required: true,
      table: false,
      default: 0,
      hint: 'Laboratory hours per week',
    },
    { key: 'ltp', label: 'L-T-P (hrs/week)', form: false, value: (r) => `${r.L}-${r.T}-${r.P}` },
    { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
    {
      key: 'programId',
      label: 'Program',
      type: 'ref',
      ref: 'programs',
      required: true,
      refFilter: (r, f) => !f.departmentId || r.departmentId === f.departmentId,
      filter: true,
    },
    { key: 'semesterNo', label: 'Semester', type: 'number', min: 1, max: 8, required: true, filter: true },
    { key: 'type', label: 'Type', type: 'select', options: ['Core', 'Elective', 'Lab', 'Project'], required: true, filter: true },
    {
      key: 'curriculumId',
      label: 'Curriculum',
      type: 'ref',
      ref: 'curricula',
      refFilter: (r, f) => !f.programId || r.programId === f.programId,
      table: false,
    },
    { key: 'prerequisites', label: 'Prerequisites', hint: 'Course codes, comma separated', table: false },
    {
      key: 'championId',
      label: 'Course champion',
      type: 'ref',
      ref: 'employees',
      refFilter: (r, f) => r.category === 'Teaching' && (!f.departmentId || r.departmentId === f.departmentId),
      table: false,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['Active', 'Inactive', 'Proposed'],
      required: true,
      filter: true,
      default: 'Active',
    },
  ],
};
export default function Courses() {
  return (
    <>
      <PageHeader title="Course Management" subtitle="Course codes, credits, L-T-P structure, programs, semesters and status" />
      {/* <div className="mb-16">
        <Alert tone="info" title="What is L-T-P?">
          <b>L-T-P</b> shows the weekly teaching hours of a course: <b>L</b> = Lecture (classroom) hours, <b>T</b> = Tutorial
          (problem-solving / doubt-clearing) hours and <b>P</b> = Practical (laboratory) hours. Example: <b>3-1-2</b> means 3 lecture + 1
          tutorial + 2 lab hours every week (6 contact hours). Credits normally follow{' '}
          <b>1 credit per lecture or tutorial hour and 1 credit per 2 practical hours</b>, so 3-1-2 = 3 + 1 + 1 = <b>5 credits</b>. L-T-P
          also drives faculty workload (hours per week) and timetable periods.
        </Alert>
      </div> */}
      <EntityPage config={courseConfig} />
    </>
  );
}
