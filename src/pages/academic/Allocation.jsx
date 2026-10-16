import { EntityPage } from '../../components/EntityPage';
import { PageHeader } from '../../components/ui';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { sum } from '../../lib/utils';
export default function Allocation() {
  const { db, ayId } = useData();
  const scope = useScope();
  return (
    <>
      <PageHeader
        title="Faculty Allocation"
        subtitle={`Assign faculty to courses and sections · AY ${labelOf(db, 'academicYears', ayId)}`}
      />
      <EntityPage
        config={{
          collection: 'allocations',
          title: 'Faculty allocations',
          singular: 'Allocation',
          module: 'faculty-allocation',
          ayFiltered: true,
          rowFilter: (r, { scope: s }) => (s.facultyId ? r.facultyId === s.facultyId : s.courseAllowed(r.courseId)),
          defaults: ({ ayId: a }) => ({ academicYearId: a }),
          fields: [
            {
              key: 'courseId',
              label: 'Course',
              type: 'ref',
              ref: 'courses',
              required: true,
              filter: true,
              refFilter: (r) => r.status === 'Active' && (!scope.departmentId || r.departmentId === scope.departmentId),
            },
            {
              key: 'sectionId',
              label: 'Section',
              type: 'ref',
              ref: 'sections',
              required: true,
              filter: true,
              refFilter: (r, f, d) =>
                r.academicYearId === ayId && (!f.courseId || d.courses.find((c) => c.id === f.courseId)?.departmentId === r.departmentId),
            },
            {
              key: 'facultyId',
              label: 'Faculty',
              type: 'ref',
              ref: 'employees',
              required: true,
              filter: true,
              refFilter: (r) => r.category === 'Teaching' && !!r.departmentId && r.status === 'Active',
              validate: (v, f, d) => {
                const dup = d.allocations.find(
                  (a) =>
                    a.id !== f.id &&
                    a.active !== false &&
                    a.academicYearId === ayId &&
                    a.courseId === f.courseId &&
                    a.sectionId === f.sectionId &&
                    a.role === f.role,
                );
                if (dup) return `Conflict: already allocated to ${labelOf(d, 'employees', dup.facultyId)}`;
                const emp = d.employees.find((e) => e.id === v);
                const hrs =
                  sum(
                    d.allocations
                      .filter((a) => a.id !== f.id && a.active !== false && a.academicYearId === ayId && a.facultyId === v)
                      .map((a) => a.hoursPerWeek),
                  ) + Number(f.hoursPerWeek || 0);
                if (emp && hrs > emp.maxWorkload) return `Workload conflict: ${hrs} h exceeds maximum ${emp.maxWorkload} h`;
                return undefined;
              },
            },
            {
              key: 'role',
              label: 'Role',
              type: 'select',
              options: ['Theory', 'Lab', 'Tutorial'],
              required: true,
              default: 'Theory',
              filter: true,
            },
            { key: 'hoursPerWeek', label: 'Hours / week', type: 'number', min: 1, max: 12, required: true, default: 4 },
          ],
        }}
      />
    </>
  );
}
