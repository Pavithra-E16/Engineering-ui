import { Users, GraduationCap, Award, CalendarDays } from 'lucide-react';
import { EntityPage } from '../../components/EntityPage';
import { PageHeader, StatCard } from '../../components/ui';
import { useData } from '../../data/store';
export default function HR() {
  const { db } = useData();
  const e = db.employees.filter((x) => x.active !== false);
  return (
    <>
      <PageHeader title="Human Resources" subtitle="Employees, faculty profiles, designations, joining dates and employment status" />
      <div className="grid cols-4 stats">
        <StatCard label="Employees" value={e.length} icon={Users} />
        <StatCard label="Teaching" value={e.filter((x) => x.category === 'Teaching').length} icon={GraduationCap} tone="blue" />
        <StatCard label="Ph.D holders" value={e.filter((x) => x.qualification === 'Ph.D').length} icon={Award} tone="violet" />
        <StatCard label="On leave" value={e.filter((x) => x.status === 'On Leave').length} icon={CalendarDays} tone="amber" />
      </div>
      <EntityPage
        config={{
          collection: 'employees',
          title: 'Employees',
          singular: 'Employee',
          module: 'hr',
          initialSort: { key: 'empNo', dir: 'asc' },
          fields: [
            { key: 'empNo', label: 'Emp no', required: true, unique: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true, unique: true, table: false },
            { key: 'phone', label: 'Phone', type: 'tel', required: true, table: false },
            { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true, table: false },
            { key: 'category', label: 'Category', type: 'select', options: ['Teaching', 'Non-Teaching'], required: true, filter: true },
            { key: 'designation', label: 'Designation', required: true, filter: true },
            { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', filter: true },
            { key: 'qualification', label: 'Qualification', required: true, filter: true },
            { key: 'specialization', label: 'Specialization', table: false },
            { key: 'joiningDate', label: 'Joining date', type: 'date', required: true },
            { key: 'experienceYears', label: 'Experience (yrs)', type: 'number', min: 0, max: 50, required: true },
            {
              key: 'employmentType',
              label: 'Employment type',
              type: 'select',
              options: ['Permanent', 'Contract', 'Visiting'],
              required: true,
              filter: true,
              table: false,
            },
            {
              key: 'maxWorkload',
              label: 'Max workload (h/wk)',
              type: 'number',
              min: 0,
              max: 30,
              required: true,
              default: 16,
              table: false,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Active', 'On Leave', 'Resigned', 'Retired'],
              required: true,
              filter: true,
              default: 'Active',
            },
          ],
        }}
      />
    </>
  );
}
