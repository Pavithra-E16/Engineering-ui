import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCheck, Plus, Save, XCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Textarea,
  useConfirm,
  useToast,
} from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { cn, fmtDate, todayISO } from '../../lib/utils';
function useCourseSections() {
  const { db, ayId } = useData();
  const scope = useScope();
  return useMemo(
    () =>
      db.allocations
        .filter((a) => a.academicYearId === ayId && a.active !== false && scope.csAllowed(a.courseId, a.sectionId))
        .map((a) => ({
          value: `${a.courseId}|${a.sectionId}`,
          label: `${labelOf(db, 'courses', a.courseId)} · ${labelOf(db, 'sections', a.sectionId)}`,
          a,
        }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    [db, ayId, scope],
  );
}
function MarkAttendance({ cs, editSession, onDone }) {
  const { db, ayId, create, update, settings } = useData();
  const toast = useToast();
  const [courseId, sectionId] = cs.split('|');
  const alloc = db.allocations.find((a) => a.courseId === courseId && a.sectionId === sectionId && a.academicYearId === ayId);
  const students = db.students
    .filter((s) => s.sectionId === sectionId && s.active !== false && s.status === 'Active')
    .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  const [date, setDate] = useState(editSession?.date ?? todayISO());
  const [period, setPeriod] = useState(editSession?.period ?? 1);
  const [topic, setTopic] = useState(editSession?.topic ?? '');
  const approvedLeave = (sid, d) =>
    db.leaveRequests.some((l) => l.studentId === sid && l.status === 'Approved' && l.fromDate <= d && l.toDate >= d);
  const init = () => Object.fromEntries(students.map((s) => [s.id, editSession?.marks[s.id] ?? (approvedLeave(s.id, date) ? 'L' : 'P')]));
  const [marks, setMarks] = useState(init);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!editSession) setMarks(init());
  }, [cs, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const dup =
    !editSession &&
    db.attendance.some((s) => s.courseId === courseId && s.sectionId === sectionId && s.date === date && s.period === period);
  const counts = { P: 0, A: 0, L: 0 };
  Object.values(marks).forEach((m) => counts[m]++);
  const prior = attendanceStats(db.attendance.filter((s) => s.courseId === courseId && s.sectionId === sectionId));
  const save = async () => {
    setErr('');
    if (!date) return setErr('Select a date.');
    if (date > todayISO()) return setErr('Attendance cannot be recorded for a future date.');
    if (dup)
      return setErr('Attendance for this course, section, date and period has already been recorded. Edit it from the Sessions tab.');
    const bad = Object.entries(marks).find(([sid, m]) => m === 'L' && !approvedLeave(sid, date));
    if (bad) return setErr(`${labelOf(db, 'students', bad[0])} is marked on leave without an approved leave request for ${fmtDate(date)}.`);
    setSaving(true);
    try {
      const data = { date, period, topic, marks, studentIds: students.map((s) => s.id) };
      if (editSession) await update('attendance', editSession.id, data, { details: `${labelOf(db, 'courses', courseId)} ${date}` });
      else
        await create(
          'attendance',
          { ...data, academicYearId: ayId, courseId, sectionId, facultyId: alloc?.facultyId ?? '' },
          { audit: 'Recorded', details: `${labelOf(db, 'courses', courseId)} ${date} P${period}` },
        );
      toast.success(`Attendance saved: ${counts.P} present, ${counts.A} absent, ${counts.L} on leave.`);
      if (!editSession) {
        setTopic('');
        setPeriod((p) => Math.min(6, p + 1));
      }
      onDone?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  if (!students.length) return <EmptyState title="No students in this section" />;
  return (
    <div>
      <div className="form-grid cols-4 mb-12">
        <Field label="Date" required>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Period" required>
          <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((p) => (
              <option key={p} value={p}>
                Period {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Topic covered" className="full">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Unit 3 – Dynamic programming" />
        </Field>
      </div>
      {err && (
        <div className="mb-12">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      {dup && !err && (
        <div className="mb-12">
          <Alert tone="warning">A session already exists for this date and period.</Alert>
        </div>
      )}
      <div className="row mb-8">
        <Button
          size="sm"
          variant="secondary"
          icon={CheckCheck}
          onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, approvedLeave(s.id, date) ? 'L' : 'P'])))}
        >
          All present
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'A'])))}>
          All absent
        </Button>
        <span className="ml-auto small muted">
          <b className="text-green">{counts.P}</b> present · <b className="text-red">{counts.A}</b> absent ·{' '}
          <b className="text-amber">{counts.L}</b> leave
        </span>
      </div>
      <div className="bordered">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Roll no</th>
              <th>Student</th>
              <th>Course att.</th>
              <th className="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const st = prior.get(s.id);
              const leaveOk = approvedLeave(s.id, date);
              return (
                <tr key={s.id} className={cn(marks[s.id] === 'A' && 'absent')}>
                  <td className="mono">{s.rollNo}</td>
                  <td>
                    {s.name}
                    {leaveOk && <Badge tone="amber">Approved leave</Badge>}
                  </td>
                  <td>
                    <span className={cn('xs', (st?.pct ?? 100) < settings.minAttendance ? 'strong text-red' : 'muted')}>
                      {st ? `${st.pct}%` : '—'}
                    </span>
                  </td>
                  <td>
                    <div className="mark-group" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                      {['P', 'A', 'L'].map((m) => (
                        <button
                          key={m}
                          role="radio"
                          aria-checked={marks[s.id] === m}
                          disabled={m === 'L' && !leaveOk}
                          onClick={() => setMarks((x) => ({ ...x, [s.id]: m }))}
                          title={m === 'P' ? 'Present' : m === 'A' ? 'Absent' : leaveOk ? 'Approved leave' : 'No approved leave'}
                          className={cn('mark-btn', m, marks[s.id] === m && 'on')}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row end mt-12">
        <Button icon={Save} onClick={save} loading={saving}>
          {editSession ? 'Update attendance' : 'Save attendance'}
        </Button>
      </div>
    </div>
  );
}
function StaffView() {
  const { db, can, settings, ayId, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const delSession = async (r) => {
    if (
      !(await confirm({
        title: 'Delete attendance session?',
        message: `Delete the ${fmtDate(r.date)} period ${r.period} session for ${labelOf(db, 'courses', r.courseId)}? Attendance percentages will be recalculated.`,
        confirmLabel: 'Delete',
      }))
    )
      return;
    try {
      await remove('attendance', r.id, { details: `${labelOf(db, 'courses', r.courseId)} ${r.date}` });
      toast.success('Attendance session deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const scope = useScope();
  const [params, setParams] = useSearchParams();
  const css = useCourseSections();
  const preset = params.get('course') && params.get('section') ? `${params.get('course')}|${params.get('section')}` : '';
  const [cs, setCs] = useState(preset && css.some((c) => c.value === preset) ? preset : (css[0]?.value ?? ''));
  const [editing, setEditing] = useState(null);
  const editable = can('attendance', 'edit');
  const [courseId, sectionId] = cs.split('|');
  const sessions = db.attendance.filter((s) => s.courseId === courseId && s.sectionId === sectionId && s.academicYearId === ayId);
  const stats = attendanceStats(sessions);
  const students = db.students.filter((s) => s.sectionId === sectionId);
  useEffect(() => {
    if (preset) {
      params.delete('course');
      params.delete('section');
      setParams(params, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const allScoped = useMemo(
    () => db.attendance.filter((s) => s.academicYearId === ayId && scope.csAllowed(s.courseId, s.sectionId)),
    [db.attendance, ayId, scope],
  );
  const lowRows = useMemo(() => {
    const st = attendanceStats(allScoped, (s, sid) => `${sid}|${s.courseId}`);
    return [...st.entries()]
      .filter(([, v]) => v.pct < settings.minAttendance)
      .map(([k, v]) => {
        const [sid, cid] = k.split('|');
        const s = db.students.find((x) => x.id === sid);
        return {
          id: k,
          sid,
          student: s?.name ?? sid,
          rollNo: s?.rollNo ?? '',
          dept: labelOf(db, 'departments', s?.departmentId),
          course: labelOf(db, 'courses', cid),
          ...v,
          shortfall: Math.max(0, Math.ceil(((settings.minAttendance / 100) * v.total - v.present) / (1 - settings.minAttendance / 100))),
        };
      })
      .filter((r) => scope.studentAllowed(r.sid));
  }, [allScoped, db, settings, scope]);
  const picker = (
    <Field label="Course · Section" className="mb-16 w-lg">
      <Select value={cs} onChange={(e) => setCs(e.target.value)}>
        {css.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <UrlTabs
      tabs={[
        { id: 'mark', label: 'Mark attendance', hidden: !editable },
        { id: 'sessions', label: 'Sessions', count: sessions.length },
        { id: 'summary', label: 'Student summary' },
        { id: 'low', label: 'Low-attendance report', count: lowRows.length },
        {
          id: 'leave',
          label: 'Leave requests',
          count: db.leaveRequests.filter((l) => l.status === 'Pending' && scope.studentAllowed(l.studentId)).length,
        },
      ]}
    >
      {(t) => {
        if (!css.length && t !== 'low' && t !== 'leave')
          return <EmptyState title="No course sections assigned" message="Attendance is recorded for allocated course-sections." />;
        switch (t) {
          case 'mark':
            return (
              <Card>
                {picker}
                {cs && <MarkAttendance key={cs} cs={cs} />}
              </Card>
            );
          case 'sessions':
            return (
              <>
                {picker}
                <DataTable
                  title="Attendance sessions"
                  rows={sessions}
                  initialSort={{ key: 'date', dir: 'desc' }}
                  columns={[
                    { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
                    { key: 'period', header: 'Period' },
                    { key: 'topic', header: 'Topic' },
                    { key: 'present', header: 'Present', value: (r) => Object.values(r.marks).filter((m) => m === 'P').length },
                    { key: 'absent', header: 'Absent', value: (r) => Object.values(r.marks).filter((m) => m === 'A').length },
                    { key: 'leave', header: 'Leave', value: (r) => Object.values(r.marks).filter((m) => m === 'L').length },
                    { key: 'faculty', header: 'Recorded by', value: (r) => labelOf(db, 'employees', r.facultyId) },
                  ]}
                  actions={
                    editable
                      ? (r) => (
                          <>
                            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(r)} title="Edit" />
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              className="danger"
                              onClick={() => delSession(r)}
                              title="Delete"
                            />
                          </>
                        )
                      : undefined
                  }
                />
                <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit attendance · ${fmtDate(editing?.date)}`} size="lg">
                  {editing && <MarkAttendance cs={cs} editSession={editing} onDone={() => setEditing(null)} />}
                </Modal>
              </>
            );
          case 'summary':
            return (
              <>
                {picker}
                <DataTable
                  title={`Attendance summary ${labelOf(db, 'courses', courseId)}`}
                  rows={students.map((s) => ({ ...s, st: stats.get(s.id) }))}
                  initialSort={{ key: 'rollNo', dir: 'asc' }}
                  columns={[
                    { key: 'rollNo', header: 'Roll no' },
                    { key: 'name', header: 'Student' },
                    { key: 'present', header: 'Present', value: (r) => r.st?.present ?? 0 },
                    { key: 'absent', header: 'Absent', value: (r) => r.st?.absent ?? 0 },
                    { key: 'leave', header: 'Leave', value: (r) => r.st?.leave ?? 0 },
                    {
                      key: 'pct',
                      header: 'Attendance %',
                      value: (r) => r.st?.pct ?? 0,
                      render: (r) => (
                        <div className="row nowrap">
                          <ProgressBar value={r.st?.pct ?? 0} />
                          <span className="xs">{r.st?.pct ?? 0}%</span>
                        </div>
                      ),
                    },
                  ]}
                />
              </>
            );
          case 'low':
            return (
              <>
                <Alert tone="info">
                  Students below the institutional minimum of {settings.minAttendance}% in at least one course (your scope). "Classes
                  needed" is the number of consecutive classes the student must attend to reach the threshold.
                </Alert>
                <div className="mt-12">
                  <DataTable
                    title="Low attendance report"
                    exportName="low-attendance-report"
                    rows={lowRows}
                    initialSort={{ key: 'pct', dir: 'asc' }}
                    filters={[
                      {
                        key: 'dept',
                        label: 'Department',
                        options: db.departments.map((d) => ({ value: d.code, label: d.code })),
                        match: (r, v) => r.dept === v,
                      },
                    ]}
                    columns={[
                      { key: 'rollNo', header: 'Roll no' },
                      { key: 'student', header: 'Student' },
                      { key: 'dept', header: 'Dept' },
                      { key: 'course', header: 'Course' },
                      { key: 'present', header: 'Attended' },
                      { key: 'total', header: 'Held' },
                      { key: 'pct', header: 'Attendance %', render: (r) => <Badge tone={r.pct < 65 ? 'red' : 'amber'}>{r.pct}%</Badge> },
                      { key: 'shortfall', header: 'Classes needed' },
                    ]}
                  />
                </div>
              </>
            );
          case 'leave':
            return <LeaveRequests />;
        }
      }}
    </UrlTabs>
  );
}
function LeaveRequests() {
  const { user } = useAuth();
  const { db, create, update, remove } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const blank = { fromDate: todayISO(), toDate: todayISO(), reason: '' };
  const [editing, setEditing] = useState(null); // null | {} (new) | record
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const rows = db.leaveRequests.filter((l) => scope.studentAllowed(l.studentId));
  const isStudent = user.role === 'student';
  const canApprove = !scope.personal && ['hod', 'mentor', 'faculty', 'principal'].includes(user.role);
  const ownPending = (r) => isStudent && r.status === 'Pending' && scope.linked.includes(r.studentId);

  const openForm = (r) => {
    setErr('');
    setF(r ? { fromDate: r.fromDate, toDate: r.toDate, reason: r.reason } : blank);
    setEditing(r ?? {});
  };
  const decide = async (id, status) => {
    const ok = await confirm({
      title: `${status === 'Approved' ? 'Approve' : 'Reject'} leave request?`,
      message:
        status === 'Approved'
          ? 'Approved leave is excluded from attendance calculations for those dates.'
          : 'The student will see the request as rejected.',
      confirmLabel: status === 'Approved' ? 'Approve' : 'Reject',
      tone: status === 'Approved' ? 'primary' : 'danger',
    });
    if (!ok) return;
    try {
      await update('leaveRequests', id, { status, approvedBy: user.name }, { audit: status });
      toast.success(`Leave ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const del = async (r) => {
    const own = ownPending(r);
    const ok = await confirm({
      title: own ? 'Withdraw leave request?' : 'Delete leave request?',
      message: `${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}: ${r.reason}`,
      confirmLabel: own ? 'Withdraw' : 'Delete',
    });
    if (!ok) return;
    try {
      await remove('leaveRequests', r.id, { audit: own ? 'Withdrawn' : 'Deleted' });
      toast.success(own ? 'Leave request withdrawn.' : 'Leave request deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const submit = async () => {
    if (!f.reason.trim()) return setErr('Reason is required.');
    if (f.toDate < f.fromDate) return setErr('To date must be on or after from date.');
    try {
      if (editing?.id) await update('leaveRequests', editing.id, f);
      else await create('leaveRequests', { ...f, studentId: scope.linked[0], status: 'Pending' });
      toast.success(editing?.id ? 'Leave request updated.' : 'Leave request submitted.');
      setEditing(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <DataTable
        title="Leave requests"
        rows={rows}
        initialSort={{ key: 'fromDate', dir: 'desc' }}
        toolbar={
          isStudent ? (
            <Button size="sm" icon={Plus} onClick={() => openForm(null)}>
              Request leave
            </Button>
          ) : undefined
        }
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: ['Pending', 'Approved', 'Rejected'].map((v) => ({ value: v, label: v })),
            match: (r, v) => r.status === v,
          },
        ]}
        columns={[
          { key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
          { key: 'fromDate', header: 'From', render: (r) => fmtDate(r.fromDate) },
          { key: 'toDate', header: 'To', render: (r) => fmtDate(r.toDate) },
          { key: 'reason', header: 'Reason' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'approvedBy', header: 'Decided by' },
        ]}
        actions={(r) => (
          <>
            {canApprove && r.status === 'Pending' && (
              <>
                <Button size="sm" variant="ghost" icon={CheckCircle2} className="ok" onClick={() => decide(r.id, 'Approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" icon={XCircle} className="bad" onClick={() => decide(r.id, 'Rejected')}>
                  Reject
                </Button>
              </>
            )}
            {ownPending(r) && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openForm(r)} title="Edit" />}
            {(ownPending(r) || canApprove) && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="danger"
                onClick={() => del(r)}
                title={ownPending(r) ? 'Withdraw' : 'Delete'}
              />
            )}
          </>
        )}
      />
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit leave request' : 'Request leave'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing?.id ? 'Save changes' : 'Submit'}</Button>
          </>
        }
      >
        <div className="stack">
          {err && <Alert tone="error">{err}</Alert>}
          <div className="form-grid">
            <Field label="From" required>
              <Input type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} />
            </Field>
            <Field label="To" required>
              <Input type="date" value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason" required>
            <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
function PersonalView() {
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const s = scope.linkedStudent;
  const sessions = db.attendance.filter((a) => a.academicYearId === ayId);
  if (!s) return <EmptyState title="No linked student" />;
  const byCourse = attendanceStats(sessions, (x) => x.courseId);
  const rows = [...byCourse.entries()].map(([cid, v]) => ({ id: cid, course: labelOf(db, 'courses', cid), ...v }));
  return (
    <UrlTabs
      tabs={[
        { id: 'summary', label: 'Course-wise summary' },
        { id: 'log', label: 'Day-wise log' },
        { id: 'leave', label: 'Leave requests' },
      ]}
    >
      {(t) =>
        t === 'summary' ? (
          <div className="grid cols-5">
            <Card title="Attendance by course" className="span-3">
              <SimpleBar
                data={rows.map((r) => ({ course: db.courses.find((c) => c.id === r.id)?.code ?? '', '%': r.pct }))}
                x="course"
                bars={[{ key: '%', label: 'Attendance %' }]}
                unit="%"
                yMax={100}
                refLine={{ y: settings.minAttendance, label: 'Minimum' }}
              />
            </Card>
            <Card title="Details" className="span-2">
              <ul className="stack">
                {rows.map((r) => (
                  <li key={r.id}>
                    <div className="meter-label">
                      <span className="truncate">{r.course}</span>
                      <span className={r.pct < settings.minAttendance ? 'strong text-red' : 'muted'}>
                        {r.present}/{r.total} · {r.pct}%
                      </span>
                    </div>
                    <ProgressBar value={r.pct} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : t === 'log' ? (
          <DataTable
            title="Attendance log"
            rows={sessions.map((x) => ({ ...x, m: x.marks[s.id] }))}
            initialSort={{ key: 'date', dir: 'desc' }}
            columns={[
              { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'period', header: 'Period' },
              { key: 'course', header: 'Course', value: (r) => labelOf(db, 'courses', r.courseId) },
              { key: 'topic', header: 'Topic' },
              {
                key: 'm',
                header: 'Status',
                value: (r) => (r.m === 'P' ? 'Present' : r.m === 'A' ? 'Absent' : 'Leave'),
                render: (r) => (
                  <Badge tone={r.m === 'P' ? 'green' : r.m === 'A' ? 'red' : 'amber'}>
                    {r.m === 'P' ? 'Present' : r.m === 'A' ? 'Absent' : 'Leave'}
                  </Badge>
                ),
              },
            ]}
          />
        ) : (
          <LeaveRequests />
        )
      }
    </UrlTabs>
  );
}
export default function Attendance() {
  const scope = useScope();
  const { settings } = useData();
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`Present / Absent / approved leave · minimum required ${settings.minAttendance}% (approved leave excluded from the denominator)`}
      />
      {scope.personal ? <PersonalView /> : <StaffView />}
    </>
  );
}
