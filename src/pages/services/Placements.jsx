import { useState } from 'react';
import { Briefcase, UserCheck, TrendingUp, CalendarCheck, Users, Send } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, Modal, PageHeader, StatCard, useConfirm, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { avg, fmtDate, pct, round1, todayISO } from '../../lib/utils';
export const isEligible = (s, d) =>
  d.eligibleDepartmentIds.includes(s.departmentId) && (s.cgpa ?? 0) >= d.minCgpa && s.status === 'Active' && s.semesterNo >= 7;
function EligibleModal({ d, onClose }) {
  const { db, create, update, can } = useData();
  const toast = useToast();
  const apps = db.placementApplications.filter((a) => a.driveId === d.id);
  const list = db.students.filter((s) => s.active !== false && isEligible(s, d));
  const setStatus = async (sid, status) => {
    const a = apps.find((x) => x.studentId === sid);
    try {
      if (a) await update('placementApplications', a.id, { status }, { audit: status });
      else await create('placementApplications', { driveId: d.id, studentId: sid, status, appliedOn: todayISO() }, { audit: status });
      toast.success(`Marked ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Eligible students · ${labelOf(db, 'drives', d.id)}`} size="lg">
      <p className="mb-12 muted">
        Criteria: CGPA ≥ {d.minCgpa}, departments {d.eligibleDepartmentIds.map((x) => labelOf(db, 'departments', x)).join(', ')}, final
        year, active. {list.length} eligible.
      </p>
      <DataTable
        title="Eligible students"
        rows={list}
        compact
        columns={[
          { key: 'rollNo', header: 'Roll no' },
          { key: 'name', header: 'Name' },
          { key: 'dept', header: 'Dept', value: (r) => labelOf(db, 'departments', r.departmentId) },
          { key: 'cgpa', header: 'CGPA' },
          {
            key: 'st',
            header: 'Application',
            value: (r) => apps.find((a) => a.studentId === r.id)?.status ?? 'Not applied',
            render: (r) => <Badge>{apps.find((a) => a.studentId === r.id)?.status ?? 'Not applied'}</Badge>,
          },
        ]}
        actions={
          can('placements', 'edit')
            ? (r) => (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'Shortlisted')}>
                    Shortlist
                  </Button>
                  <Button size="sm" variant="ghost" className="text-green" onClick={() => setStatus(r.id, 'Selected')}>
                    Select
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red" onClick={() => setStatus(r.id, 'Rejected')}>
                    Reject
                  </Button>
                </>
              )
            : undefined
        }
      />
    </Modal>
  );
}
function StudentPlacements() {
  const { db, create } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const s = scope.linkedStudent;
  const mine = db.placementApplications.filter((a) => a.studentId === s.id);
  const apply = async (d) => {
    if (
      !(await confirm({
        title: 'Apply for this drive?',
        message: `Apply to ${labelOf(db, 'drives', d.id)} (${d.ctcLpa} LPA) on ${fmtDate(d.date)}?`,
        confirmLabel: 'Apply',
        tone: 'primary',
      }))
    )
      return;
    try {
      await create(
        'placementApplications',
        { driveId: d.id, studentId: s.id, status: 'Applied', appliedOn: todayISO() },
        { audit: 'Applied' },
      );
      toast.success('Application submitted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      {s.semesterNo < 7 && (
        <div className="mb-12">
          <Alert tone="info">Placement drives are open to final-year students. You can view upcoming drives.</Alert>
        </div>
      )}
      <DataTable
        title="Placement drives"
        rows={db.drives.filter((d) => d.status !== 'Completed')}
        initialSort={{ key: 'date', dir: 'asc' }}
        columns={[
          { key: 'company', header: 'Company', value: (r) => labelOf(db, 'companies', r.companyId) },
          { key: 'role', header: 'Role' },
          { key: 'ctcLpa', header: 'CTC (LPA)' },
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'minCgpa', header: 'Min CGPA' },
          {
            key: 'el',
            header: 'Eligibility',
            value: (r) => (isEligible(s, r) ? 'Eligible' : 'Not eligible'),
            render: (r) => <Badge tone={isEligible(s, r) ? 'green' : 'slate'}>{isEligible(s, r) ? 'Eligible' : 'Not eligible'}</Badge>,
          },
        ]}
        actions={(r) => {
          const a = mine.find((x) => x.driveId === r.id);
          if (a) return <Badge>{a.status}</Badge>;
          return isEligible(s, r) ? (
            <Button size="sm" icon={Send} onClick={() => apply(r)}>
              Apply
            </Button>
          ) : null;
        }}
      />
      <div className="mt-16">
        <DataTable
          title="My applications"
          rows={mine}
          columns={[
            { key: 'drive', header: 'Drive', value: (r) => labelOf(db, 'drives', r.driveId) },
            { key: 'appliedOn', header: 'Applied', render: (r) => fmtDate(r.appliedOn) },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </div>
    </>
  );
}
export default function Placements() {
  const { db } = useData();
  const scope = useScope();
  const [elig, setElig] = useState(null);
  if (scope.personal)
    return (
      <>
        <PageHeader title="Placements" subtitle="Campus drives, eligibility and your applications" />
        <StudentPlacements />
      </>
    );
  const fy = db.students.filter((s) => s.semesterNo === 7 && s.active !== false);
  const sel = db.placementApplications.filter((a) => a.status === 'Selected');
  const placed = new Set(sel.map((a) => a.studentId));
  const ctc = sel.map((a) => db.drives.find((d) => d.id === a.driveId)?.ctcLpa ?? 0);
  const byCompany = db.companies
    .map((c) => ({ company: c.name, Offers: sel.filter((a) => db.drives.find((d) => d.id === a.driveId)?.companyId === c.id).length }))
    .filter((x) => x.Offers > 0)
    .sort((a, b) => b.Offers - a.Offers);
  const byDept = db.departments.map((d) => {
    const l = fy.filter((s) => s.departmentId === d.id);
    return { dept: d.code, 'Placed %': pct(l.filter((s) => placed.has(s.id)).length, l.length) };
  });
  return (
    <>
      <PageHeader title="Placement Management" subtitle="Companies, drives, eligibility, applications, selections and reports" />
      <div className="grid cols-5 stats">
        <StatCard label="Final-year students" value={fy.length} icon={Users} />
        <StatCard label="Placed" value={placed.size} icon={UserCheck} tone="green" hint={`${pct(placed.size, fy.length)}%`} />
        <StatCard label="Offers" value={sel.length} icon={Briefcase} tone="violet" />
        <StatCard label="Avg CTC" value={`${round1(avg(ctc))} LPA`} icon={TrendingUp} tone="blue" />
        <StatCard
          label="Upcoming drives"
          value={db.drives.filter((d) => d.status === 'Upcoming').length}
          icon={CalendarCheck}
          tone="amber"
        />
      </div>
      <UrlTabs
        tabs={[
          { id: 'drives', label: 'Drives' },
          { id: 'apps', label: 'Applications' },
          { id: 'companies', label: 'Companies' },
          { id: 'reports', label: 'Reports' },
        ]}
      >
        {(t) =>
          t === 'drives' ? (
            <EntityPage
              config={{
                collection: 'drives',
                title: 'Placement drives',
                singular: 'Drive',
                module: 'placements',
                initialSort: { key: 'date', dir: 'desc' },
                defaults: ({ ayId }) => ({ academicYearId: ayId, status: 'Upcoming', maxBacklogs: 0 }),
                rowActions: (r) => (
                  <Button size="sm" variant="ghost" icon={Users} onClick={() => setElig(r)}>
                    Eligible
                  </Button>
                ),
                fields: [
                  { key: 'companyId', label: 'Company', type: 'ref', ref: 'companies', required: true, filter: true },
                  { key: 'role', label: 'Role', required: true },
                  { key: 'ctcLpa', label: 'CTC (LPA)', type: 'number', min: 0, required: true },
                  { key: 'date', label: 'Date', type: 'date', required: true },
                  { key: 'minCgpa', label: 'Min CGPA', type: 'number', min: 0, max: 10, required: true },
                  { key: 'maxBacklogs', label: 'Max backlogs', type: 'number', min: 0, max: 10, table: false },
                  { key: 'eligibleDepartmentIds', label: 'Eligible departments', type: 'multiref', ref: 'departments', required: true },
                  {
                    key: 'applicants',
                    label: 'Applicants',
                    form: false,
                    value: (r) => db.placementApplications.filter((a) => a.driveId === r.id).length,
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Upcoming', 'Ongoing', 'Completed'],
                    required: true,
                    filter: true,
                  },
                ],
              }}
            />
          ) : t === 'apps' ? (
            <EntityPage
              config={{
                collection: 'placementApplications',
                title: 'Applications',
                singular: 'Application',
                module: 'placements',
                noDeactivate: true,
                defaults: () => ({ appliedOn: todayISO(), status: 'Applied' }),
                fields: [
                  { key: 'driveId', label: 'Drive', type: 'ref', ref: 'drives', required: true, filter: true },
                  {
                    key: 'studentId',
                    label: 'Student',
                    type: 'ref',
                    ref: 'students',
                    required: true,
                    refFilter: (r, f, d) => {
                      const dr = d.drives.find((x) => x.id === f.driveId);
                      return !dr || isEligible(r, dr);
                    },
                    validate: (v, f, d) =>
                      d.placementApplications.some((a) => a.id !== f.id && a.driveId === f.driveId && a.studentId === v)
                        ? 'Student has already applied to this drive'
                        : undefined,
                  },
                  {
                    key: 'dept',
                    label: 'Dept',
                    form: false,
                    value: (r, d) => labelOf(d, 'departments', d.students.find((s) => s.id === r.studentId)?.departmentId),
                  },
                  { key: 'appliedOn', label: 'Applied on', type: 'date', required: true },
                  {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Applied', 'Shortlisted', 'Selected', 'Rejected'],
                    required: true,
                    filter: true,
                  },
                ],
              }}
            />
          ) : t === 'companies' ? (
            <EntityPage
              config={{
                collection: 'companies',
                title: 'Companies',
                singular: 'Company',
                module: 'placements',
                fields: [
                  { key: 'name', label: 'Company', required: true, unique: true },
                  { key: 'sector', label: 'Sector', required: true, filter: true },
                  {
                    key: 'tier',
                    label: 'Tier',
                    type: 'select',
                    options: ['Dream', 'Super Dream', 'Regular'],
                    required: true,
                    filter: true,
                  },
                  { key: 'website', label: 'Website', type: 'url', table: false },
                  { key: 'contactPerson', label: 'Contact person', required: true },
                  { key: 'contactEmail', label: 'Contact email', type: 'email', required: true },
                ],
              }}
            />
          ) : (
            <div className="grid cols-2">
              <Card title="Placement % by department">
                <SimpleBar data={byDept} x="dept" bars={[{ key: 'Placed %', label: 'Placed %' }]} unit="%" yMax={100} />
              </Card>
              <Card title="Offers by company">
                <SimpleBar
                  data={byCompany}
                  x="company"
                  bars={[{ key: 'Offers', label: 'Offers' }]}
                  horizontal
                  height={Math.max(200, byCompany.length * 34)}
                />
              </Card>
            </div>
          )
        }
      </UrlTabs>
      {elig && <EligibleModal d={elig} onClose={() => setElig(null)} />}
    </>
  );
}
