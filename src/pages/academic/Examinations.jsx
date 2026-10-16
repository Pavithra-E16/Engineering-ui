import { useMemo, useState } from 'react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Card, Field, PageHeader, Select, StatCard } from '../../components/ui';
import { fmtDate, todayISO } from '../../lib/utils';
import { CalendarCheck, UserCheck, UserX } from 'lucide-react';
function Eligibility() {
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const sections = db.sections.filter((s) => s.academicYearId === ayId && (!scope.departmentId || s.departmentId === scope.departmentId));
  const [sec, setSec] = useState(scope.linkedStudent?.sectionId ?? sections[0]?.id ?? '');
  const sessions = db.attendance.filter((a) => a.sectionId === sec && a.academicYearId === ayId);
  const stats = attendanceStats(sessions, (s, sid) => `${sid}|${s.courseId}`);
  const courses = [...new Set(sessions.map((s) => s.courseId))];
  const rows = useMemo(
    () =>
      db.students
        .filter((s) => s.sectionId === sec && scope.studentAllowed(s.id))
        .map((s) => {
          const short = courses.filter((c) => (stats.get(`${s.id}|${c}`)?.pct ?? 100) < settings.minAttendance);
          return { ...s, short, eligible: short.length === 0 && s.status === 'Active' };
        }),
    [db.students, sec, stats, courses, settings, scope],
  );
  return (
    <>
      {!scope.personal && (
        <Field label="Section" className="mb-12 w-md">
          <Select value={sec} onChange={(e) => setSec(e.target.value)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {labelOf(db, 'sections', s.id)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid cols-3 stats">
        <StatCard label="Students" value={rows.length} icon={CalendarCheck} />
        <StatCard label="Eligible" value={rows.filter((r) => r.eligible).length} icon={UserCheck} tone="green" />
        <StatCard label="Not eligible (attendance)" value={rows.filter((r) => !r.eligible).length} icon={UserX} tone="red" />
      </div>
      <Alert tone="info">
        Eligibility rule: minimum {settings.minAttendance}% attendance in every course and active student status. Condonation can be
        recorded by the Examination Cell.
      </Alert>
      <div className="mt-12">
        <DataTable
          title="Examination eligibility"
          rows={rows}
          initialSort={{ key: 'rollNo', dir: 'asc' }}
          filters={[
            {
              key: 'el',
              label: 'Eligibility',
              options: [
                { value: 'y', label: 'Eligible' },
                { value: 'n', label: 'Not eligible' },
              ],
              match: (r, v) => (v === 'y') === r.eligible,
            },
          ]}
          columns={[
            { key: 'rollNo', header: 'Roll no' },
            { key: 'name', header: 'Student' },
            {
              key: 'short',
              header: 'Courses below threshold',
              value: (r) => r.short.map((c) => db.courses.find((x) => x.id === c)?.code).join(', ') || '—',
            },
            {
              key: 'eligible',
              header: 'Status',
              value: (r) => (r.eligible ? 'Eligible' : 'Not eligible'),
              render: (r) => <Badge tone={r.eligible ? 'green' : 'red'}>{r.eligible ? 'Eligible' : 'Not eligible'}</Badge>,
            },
          ]}
        />
      </div>
    </>
  );
}
export default function Examinations() {
  const { db, ayId } = useData();
  const scope = useScope();
  const myCourses = scope.linkedStudent
    ? new Set(
        db.courses
          .filter((c) => c.departmentId === scope.linkedStudent.departmentId && c.semesterNo === scope.linkedStudent.semesterNo)
          .map((c) => c.id),
      )
    : null;
  const upcoming = db.exams.filter((e) => e.academicYearId === ayId && e.date >= todayISO() && (!myCourses || myCourses.has(e.courseId)));
  return (
    <>
      <PageHeader title="Examination Management" subtitle="Schedules, sessions, halls, invigilation and eligibility" />
      <UrlTabs
        tabs={[
          { id: 'schedule', label: 'Exam schedule', count: upcoming.length },
          { id: 'eligibility', label: 'Eligibility' },
          { id: 'halls', label: 'Hall utilisation', hidden: scope.personal },
        ]}
      >
        {(t) =>
          t === 'schedule' ? (
            <EntityPage
              config={{
                collection: 'exams',
                title: 'Examination schedule',
                singular: 'Exam',
                module: 'examinations',
                ayFiltered: true,
                rowFilter: (r, { scope: s }) => (myCourses ? myCourses.has(r.courseId) : s.courseAllowed(r.courseId)),
                initialSort: { key: 'date', dir: 'asc' },
                defaults: ({ ayId: a }) => ({ academicYearId: a }),
                fields: [
                  { key: 'name', label: 'Examination', required: true, filter: true },
                  {
                    key: 'type',
                    label: 'Type',
                    type: 'select',
                    options: ['Mid Term', 'End Semester', 'Supplementary', 'Lab'],
                    required: true,
                    filter: true,
                  },
                  { key: 'courseId', label: 'Course', type: 'ref', ref: 'courses', required: true },
                  { key: 'date', label: 'Date', type: 'date', required: true },
                  { key: 'session', label: 'Session', type: 'select', options: ['FN', 'AN'], required: true, filter: true },
                  { key: 'durationMins', label: 'Duration (min)', type: 'number', min: 30, max: 240, required: true, default: 180 },
                  {
                    key: 'roomId',
                    label: 'Hall',
                    type: 'ref',
                    ref: 'rooms',
                    refFilter: (r) => r.type === 'Exam Hall' || r.type === 'Seminar Hall',
                    filter: true,
                  },
                  {
                    key: 'invigilatorId',
                    label: 'Invigilator',
                    type: 'ref',
                    ref: 'employees',
                    refFilter: (r) => r.category === 'Teaching',
                    validate: (v, f, d) => {
                      const c = d.exams.find(
                        (e) =>
                          e.id !== f.id &&
                          e.invigilatorId === v &&
                          e.date === f.date &&
                          e.session === f.session &&
                          e.status !== 'Cancelled',
                      );
                      return c ? `Conflict: already invigilating ${labelOf(d, 'courses', c.courseId)} in this session` : undefined;
                    },
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Scheduled', 'Conducted', 'Cancelled'],
                    required: true,
                    filter: true,
                    default: 'Scheduled',
                  },
                ],
              }}
            />
          ) : t === 'eligibility' ? (
            <Eligibility />
          ) : (
            <HallUtil />
          )
        }
      </UrlTabs>
    </>
  );
}
function HallUtil() {
  const { db, ayId } = useData();
  const ex = db.exams.filter((e) => e.academicYearId === ayId && e.status === 'Scheduled' && e.date >= todayISO());
  const keys = new Map();
  ex.forEach((e) => {
    const k = `${e.date}|${e.session}|${e.roomId}`;
    keys.set(k, [...(keys.get(k) ?? []), e]);
  });
  const rows = [...keys.entries()].map(([k, l]) => {
    const [date, session, roomId] = k.split('|');
    const room = db.rooms.find((r) => r.id === roomId);
    const students = l.reduce((t, e) => {
      const c = db.courses.find((x) => x.id === e.courseId);
      return t + db.students.filter((s) => s.departmentId === c?.departmentId && s.semesterNo === c?.semesterNo).length;
    }, 0);
    return { id: k, date, session, hall: room?.code ?? '—', capacity: room?.capacity ?? 0, papers: l.length, students };
  });
  return (
    <Card title="Hall allocation by session" subtitle="Students seated vs hall capacity" bodyClass="p-0">
      <DataTable
        title="Hall utilisation"
        rows={rows}
        initialSort={{ key: 'date', dir: 'asc' }}
        columns={[
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'session', header: 'Session' },
          { key: 'hall', header: 'Hall' },
          { key: 'papers', header: 'Papers' },
          { key: 'students', header: 'Students' },
          { key: 'capacity', header: 'Capacity' },
          {
            key: 'ok',
            header: 'Status',
            value: (r) => (r.students > r.capacity ? 'Over capacity' : 'OK'),
            render: (r) => (
              <Badge tone={r.students > r.capacity ? 'red' : 'green'}>{r.students > r.capacity ? 'Over capacity' : 'OK'}</Badge>
            ),
          },
        ]}
      />
    </Card>
  );
}
