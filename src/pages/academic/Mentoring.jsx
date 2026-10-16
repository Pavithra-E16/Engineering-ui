import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, UserCog } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats, studentRisk } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Badge, Button, Field, Modal, PageHeader, Select, useToast } from '../../components/ui';
function Mentees() {
  const { db, ayId, settings, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const [assign, setAssign] = useState(null);
  const att = useMemo(() => attendanceStats(db.attendance.filter((s) => s.academicYearId === ayId)), [db.attendance, ayId]);
  const openFU = new Map();
  db.mentoringMeetings
    .filter((m) => m.followUpStatus !== 'Closed')
    .forEach((m) => openFU.set(m.studentId, (openFU.get(m.studentId) ?? 0) + 1));
  const risk = useMemo(
    () =>
      studentRisk(
        scope.students,
        att,
        db.assessments.filter((a) => a.academicYearId === ayId),
        db.invoices,
        settings,
        { openFollowUps: openFU },
      ),
    [scope.students, att, db, ayId, settings],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const canAssign = can('mentoring', 'edit') && scope.role !== 'mentor';
  const save = async () => {
    if (!assign) return;
    try {
      await update('students', assign.id, { mentorId: assign.mentorId }, { audit: 'Mentor assigned' });
      toast.success('Mentor assigned.');
      setAssign(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const st = assign ? db.students.find((s) => s.id === assign.id) : null;
  return (
    <>
      <DataTable
        title="Mentees"
        rows={risk.map((r) => ({ ...r, id: r.student.id }))}
        initialSort={{ key: 'score', dir: 'desc' }}
        filters={[
          {
            key: 'level',
            label: 'Risk level',
            options: ['High Risk', 'Moderate Risk', 'Low Risk'].map((v) => ({ value: v, label: v })),
            match: (r, v) => r.level === v,
          },
          {
            key: 'mentor',
            label: 'Mentor',
            options: db.employees
              .filter((e) => e.category === 'Teaching' && (!scope.departmentId || e.departmentId === scope.departmentId))
              .map((e) => ({ value: e.id, label: e.name })),
            match: (r, v) => r.student.mentorId === v,
          },
        ]}
        columns={[
          { key: 'roll', header: 'Roll no', value: (r) => r.student.rollNo },
          {
            key: 'name',
            header: 'Student',
            value: (r) => r.student.name,
            render: (r) => <Link to={`/students/${r.student.id}`}>{r.student.name}</Link>,
          },
          { key: 'sem', header: 'Sem', value: (r) => `${labelOf(db, 'departments', r.student.departmentId)} ${r.student.semesterNo}` },
          { key: 'mentor', header: 'Mentor', value: (r) => labelOf(db, 'employees', r.student.mentorId) },
          { key: 'attendance', header: 'Attendance %', value: (r) => r.attendance },
          { key: 'internal', header: 'Internal %', value: (r) => r.internal ?? '' },
          { key: 'fu', header: 'Open follow-ups', value: (r) => openFU.get(r.student.id) ?? 0 },
          { key: 'score', header: 'Risk', value: (r) => r.score, render: (r) => <Badge>{r.level}</Badge> },
        ]}
        actions={
          canAssign
            ? (r) => (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={UserCog}
                  onClick={() => setAssign({ id: r.student.id, mentorId: r.student.mentorId ?? '' })}
                >
                  Assign
                </Button>
              )
            : undefined
        }
      />
      <Modal
        open={!!assign}
        onClose={() => setAssign(null)}
        title={`Assign mentor · ${st?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssign(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <Field label="Mentor">
          <Select value={assign?.mentorId ?? ''} onChange={(e) => setAssign((a) => a && { ...a, mentorId: e.target.value })}>
            <option value="">Select…</option>
            {db.employees
              .filter((e) => e.category === 'Teaching' && e.departmentId === st?.departmentId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({db.students.filter((s) => s.mentorId === e.id).length} mentees)
                </option>
              ))}
          </Select>
        </Field>
      </Modal>
    </>
  );
}
export default function Mentoring() {
  const { user } = useAuth();
  const { db } = useData();
  const scope = useScope();
  // Confidential notes are visible only to the mentor who wrote them, the HOD and the Principal.
  const canSeeConfidential = (r) => ['hod', 'principal'].includes(user.role) || r.mentorId === user.employeeId;
  return (
    <>
      <PageHeader title="Student Mentoring" subtitle="Mentor assignment, meetings, academic progress and follow-up actions" />
      <UrlTabs
        tabs={[
          { id: 'mentees', label: 'Mentees & progress' },
          {
            id: 'meetings',
            label: 'Meetings & follow-ups',
            count: db.mentoringMeetings.filter((m) => scope.studentAllowed(m.studentId)).length,
          },
        ]}
      >
        {(t) =>
          t === 'mentees' ? (
            <Mentees />
          ) : (
            <EntityPage
              config={{
                collection: 'mentoringMeetings',
                title: 'Mentoring meetings',
                singular: 'Meeting',
                module: 'mentoring',
                rowFilter: (r, { scope: s }) => s.studentAllowed(r.studentId) && (!r.confidential || canSeeConfidential(r)),
                initialSort: { key: 'date', dir: 'desc' },
                defaults: () => ({ mentorId: user.employeeId }),
                canEditRow: (r) => r.mentorId === user.employeeId || user.role === 'hod',
                beforeSave: (f, existing, d) => ({
                  ...f,
                  mentorId: existing?.mentorId ?? d.students.find((s) => s.id === f.studentId)?.mentorId ?? user.employeeId,
                }),
                fields: [
                  {
                    key: 'studentId',
                    label: 'Student',
                    type: 'ref',
                    ref: 'students',
                    required: true,
                    refFilter: (r) => scope.studentAllowed(r.id),
                  },
                  { key: 'mentorId', label: 'Mentor', type: 'ref', ref: 'employees', form: false, filter: true },
                  { key: 'date', label: 'Meeting date', type: 'date', required: true },
                  { key: 'mode', label: 'Mode', type: 'select', options: ['In-person', 'Online', 'Phone'], required: true, table: false },
                  {
                    key: 'concerns',
                    label: 'Concerns discussed',
                    type: 'textarea',
                    required: true,
                    render: (r) => (
                      <span className="truncate">
                        {r.confidential && <Lock className="icon-14 text-amber" />}
                        {r.concerns}
                      </span>
                    ),
                  },
                  { key: 'actionItems', label: 'Action items', type: 'textarea', required: true, table: false },
                  { key: 'followUpDate', label: 'Follow-up date', type: 'date' },
                  {
                    key: 'followUpStatus',
                    label: 'Follow-up',
                    type: 'select',
                    options: ['Open', 'In Progress', 'Closed'],
                    required: true,
                    filter: true,
                    default: 'Open',
                    render: (r) => <Badge>{r.followUpStatus}</Badge>,
                  },
                  {
                    key: 'confidential',
                    label: 'Confidential',
                    type: 'checkbox',
                    hint: 'Visible only to the mentor, HOD and Principal',
                    table: false,
                  },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
