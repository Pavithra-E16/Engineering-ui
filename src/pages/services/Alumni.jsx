import { GraduationCap, Handshake, Globe2, Building } from 'lucide-react';
import { useData } from '../../data/store';
import { EntityPage } from '../../components/EntityPage';
import { PageHeader, StatCard } from '../../components/ui';
export default function Alumni() {
  const { db } = useData();
  const a = db.alumni.filter((x) => x.active !== false);
  return (
    <>
      <PageHeader title="Alumni Management" subtitle="Alumni profiles, graduation details, employment and engagement" />
      <div className="grid cols-4 stats">
        <StatCard label="Alumni" value={a.length} icon={GraduationCap} />
        <StatCard label="Engaged" value={a.filter((x) => x.engagement && x.engagement !== 'None').length} icon={Handshake} tone="green" />
        <StatCard
          label="Abroad"
          value={a.filter((x) => ['USA', 'Germany', 'UK', 'Canada'].includes(x.location)).length}
          icon={Globe2}
          tone="blue"
        />
        <StatCard label="Companies" value={new Set(a.map((x) => x.company)).size} icon={Building} tone="violet" />
      </div>
      <EntityPage
        config={{
          collection: 'alumni',
          title: 'Alumni',
          singular: 'Alumnus',
          module: 'alumni',
          initialSort: { key: 'graduationYear', dir: 'desc' },
          fields: [
            { key: 'name', label: 'Name', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true, table: false },
            { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
            { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, table: false },
            { key: 'graduationYear', label: 'Graduation year', type: 'number', min: 1980, max: 2100, required: true, filter: true },
            { key: 'company', label: 'Company', required: true },
            { key: 'designation', label: 'Designation', required: true },
            { key: 'location', label: 'Location', required: true, filter: true },
            {
              key: 'engagement',
              label: 'Engagement',
              type: 'select',
              options: ['None', 'Guest Lecture', 'Mentor', 'Recruiter', 'Donor'],
              filter: true,
            },
          ],
        }}
      />
    </>
  );
}
