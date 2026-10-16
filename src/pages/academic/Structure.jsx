import { Link } from 'react-router-dom';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { PageHeader, Button } from '../../components/ui';
import { useData } from '../../data/store';
const GENDERS = ['Male', 'Female'];
export const studentConfig = {
  collection: 'students',
  title: 'Students',
  singular: 'Student',
  module: 'academic-structure',
  rowFilter: (r, { scope }) => scope.studentAllowed(r.id),
  initialSort: { key: 'rollNo', dir: 'asc' },
  rowActions: (r) => (
    <Link to={`/students/${r.id}`}>
      <Button size="sm" variant="ghost">
        360°
      </Button>
    </Link>
  ),
  fields: [
    { key: 'rollNo', label: 'Roll No', required: true, unique: true },
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true, unique: true, table: false },
    { key: 'phone', label: 'Phone', type: 'tel', required: true, table: false },
    { key: 'gender', label: 'Gender', type: 'select', options: GENDERS, required: true, table: false, filter: true },
    { key: 'dob', label: 'Date of birth', type: 'date', required: true, table: false },
    { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
    {
      key: 'programId',
      label: 'Program',
      type: 'ref',
      ref: 'programs',
      required: true,
      refFilter: (r, f) => !f.departmentId || r.departmentId === f.departmentId,
      table: false,
    },
    { key: 'semesterNo', label: 'Semester', type: 'number', min: 1, max: 8, required: true, filter: true },
    {
      key: 'sectionId',
      label: 'Section',
      type: 'ref',
      ref: 'sections',
      required: true,
      refFilter: (r, f, db) =>
        r.academicYearId === db.settings[0]?.currentAcademicYearId &&
        (!f.departmentId || r.departmentId === f.departmentId) &&
        (!f.semesterNo || r.semesterNo === Number(f.semesterNo)),
      table: false,
    },
    { key: 'batch', label: 'Batch', required: true, hint: 'e.g. 2024-2028', filter: true },
    { key: 'admissionYear', label: 'Admission year', type: 'number', min: 2000, max: 2100, required: true, table: false },
    {
      key: 'mentorId',
      label: 'Mentor',
      type: 'ref',
      ref: 'employees',
      refFilter: (r, f) => r.category === 'Teaching' && (!f.departmentId || r.departmentId === f.departmentId),
      table: false,
    },
    { key: 'parentName', label: 'Parent / guardian', required: true, table: false },
    { key: 'parentPhone', label: 'Parent phone', type: 'tel', required: true, table: false },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'],
      table: false,
    },
    { key: 'cgpa', label: 'CGPA', type: 'number', min: 0, max: 10 },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['Active', 'Detained', 'Graduated', 'Discontinued'],
      required: true,
      filter: true,
      default: 'Active',
    },
  ],
};
export default function Structure() {
  const { db } = useData();
  return (
    <>
      <PageHeader title="Academic Structure" subtitle="Departments, programs, academic calendar, sections, rooms and student records" />
      <UrlTabs
        tabs={[
          { id: 'departments', label: 'Departments', count: db.departments.length },
          { id: 'programs', label: 'Programs', count: db.programs.length },
          { id: 'years', label: 'Academic Years', count: db.academicYears.length },
          { id: 'semesters', label: 'Semesters', count: db.semesters.length },
          { id: 'sections', label: 'Sections', count: db.sections.length },
          { id: 'rooms', label: 'Rooms', count: db.rooms.length },
          { id: 'students', label: 'Students', count: db.students.length },
        ]}
      >
        {(t) => {
          switch (t) {
            case 'departments':
              return (
                <EntityPage
                  config={{
                    collection: 'departments',
                    title: 'Departments',
                    singular: 'Department',
                    module: 'academic-structure',
                    fields: [
                      { key: 'code', label: 'Code', required: true, unique: true },
                      { key: 'name', label: 'Name', required: true, unique: true },
                      {
                        key: 'hodId',
                        label: 'Head of Department',
                        type: 'ref',
                        ref: 'employees',
                        refFilter: (r, f) => r.category === 'Teaching' && (!f.id || r.departmentId === f.id),
                      },
                      { key: 'block', label: 'Block' },
                      { key: 'established', label: 'Established', type: 'number', min: 1900, max: 2100 },
                      {
                        key: 'students',
                        label: 'Students',
                        form: false,
                        value: (r, d) => d.students.filter((s) => s.departmentId === r.id && s.active !== false).length,
                      },
                    ],
                  }}
                />
              );
            case 'programs':
              return (
                <EntityPage
                  config={{
                    collection: 'programs',
                    title: 'Programs',
                    singular: 'Program',
                    module: 'academic-structure',
                    fields: [
                      { key: 'code', label: 'Code', required: true, unique: true },
                      { key: 'name', label: 'Name', required: true },
                      { key: 'level', label: 'Level', type: 'select', options: ['UG', 'PG'], required: true, filter: true },
                      { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
                      { key: 'durationYears', label: 'Duration (years)', type: 'number', min: 1, max: 6, required: true },
                      { key: 'intake', label: 'Sanctioned intake', type: 'number', min: 1, required: true },
                    ],
                  }}
                />
              );
            case 'years':
              return (
                <EntityPage
                  config={{
                    collection: 'academicYears',
                    title: 'Academic Years',
                    singular: 'Academic Year',
                    module: 'academic-structure',
                    initialSort: { key: 'name', dir: 'desc' },
                    fields: [
                      { key: 'name', label: 'Name', required: true, unique: true, hint: 'e.g. 2027-28' },
                      { key: 'startDate', label: 'Start date', type: 'date', required: true },
                      {
                        key: 'endDate',
                        label: 'End date',
                        type: 'date',
                        required: true,
                        validate: (v, f) => (f.startDate && v <= f.startDate ? 'End date must be after start date' : undefined),
                      },
                      {
                        key: 'current',
                        label: 'Current year',
                        type: 'checkbox',
                        hint: 'Set the institution-wide current year in Settings',
                      },
                    ],
                  }}
                />
              );
            case 'semesters':
              return (
                <EntityPage
                  config={{
                    collection: 'semesters',
                    title: 'Semesters',
                    singular: 'Semester',
                    module: 'academic-structure',
                    fields: [
                      { key: 'academicYearId', label: 'Academic year', type: 'ref', ref: 'academicYears', required: true, filter: true },
                      { key: 'term', label: 'Term', type: 'select', options: ['Odd', 'Even'], required: true },
                      { key: 'number', label: 'Term no.', type: 'number', min: 1, max: 2, required: true },
                      { key: 'startDate', label: 'Start date', type: 'date', required: true },
                      {
                        key: 'endDate',
                        label: 'End date',
                        type: 'date',
                        required: true,
                        validate: (v, f) => (f.startDate && v <= f.startDate ? 'End date must be after start date' : undefined),
                      },
                      {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: ['Planned', 'Ongoing', 'Completed'],
                        required: true,
                        filter: true,
                      },
                    ],
                  }}
                />
              );
            case 'sections':
              return (
                <EntityPage
                  config={{
                    collection: 'sections',
                    title: 'Sections',
                    singular: 'Section',
                    module: 'academic-structure',
                    ayFiltered: true,
                    rowFilter: (r, { scope }) => !scope.departmentId || r.departmentId === scope.departmentId,
                    defaults: ({ ayId }) => ({ academicYearId: ayId }),
                    fields: [
                      { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
                      {
                        key: 'programId',
                        label: 'Program',
                        type: 'ref',
                        ref: 'programs',
                        required: true,
                        refFilter: (r, f) => !f.departmentId || r.departmentId === f.departmentId,
                      },
                      { key: 'semesterNo', label: 'Semester', type: 'number', min: 1, max: 8, required: true, filter: true },
                      { key: 'name', label: 'Section', required: true },
                      { key: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 120, required: true },
                      { key: 'room', label: 'Home room', type: 'ref', ref: 'rooms' },
                      {
                        key: 'classTeacherId',
                        label: 'Class teacher',
                        type: 'ref',
                        ref: 'employees',
                        refFilter: (r, f) => r.category === 'Teaching' && (!f.departmentId || r.departmentId === f.departmentId),
                      },
                      {
                        key: 'strength',
                        label: 'Students',
                        form: false,
                        value: (r, d) => d.students.filter((s) => s.sectionId === r.id && s.active !== false).length,
                      },
                    ],
                  }}
                />
              );
            case 'rooms':
              return (
                <EntityPage
                  config={{
                    collection: 'rooms',
                    title: 'Rooms',
                    singular: 'Room',
                    module: 'academic-structure',
                    fields: [
                      { key: 'code', label: 'Room code', required: true, unique: true },
                      { key: 'block', label: 'Block', required: true, filter: true },
                      {
                        key: 'type',
                        label: 'Type',
                        type: 'select',
                        options: ['Classroom', 'Lab', 'Seminar Hall', 'Exam Hall'],
                        required: true,
                        filter: true,
                      },
                      { key: 'capacity', label: 'Capacity', type: 'number', min: 1, required: true },
                    ],
                  }}
                />
              );
            case 'students':
              return <EntityPage config={studentConfig} />;
          }
        }}
      </UrlTabs>
    </>
  );
}
