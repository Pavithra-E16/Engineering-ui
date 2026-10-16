import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  BookCopy,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileCheck2,
  GraduationCap,
  IndianRupee,
  Inbox,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  Users,
  UserCheck,
  Wallet,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats, computeResults, internalPercent, overallAttendancePct, studentRisk } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { roleLabel } from '../../lib/roles';
import { avg, fmtDate, fmtDateTime, fmtMoney, groupBy, pct, round1, sum, todayISO } from '../../lib/utils';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from '../../components/ui';
import { ShareBars, SimpleBar, SimpleLine } from '../../components/charts';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
export function useMyAnnouncements() {
  const { user } = useAuth();
  const { db } = useData();
  const scope = useScope();
  return useMemo(
    () =>
      db.announcements
        .filter(
          (a) =>
            a.active !== false &&
            a.audienceRoles.includes(user.role) &&
            (!a.departmentId ||
              a.departmentId === (scope.linkedStudent?.departmentId ?? user?.departmentId) ||
              (!user?.departmentId && !scope.linkedStudent)) &&
            (!a.semesterNo || !scope.linkedStudent || a.semesterNo === scope.linkedStudent.semesterNo) &&
            (!a.expiryDate || a.expiryDate >= todayISO()),
        )
        .sort((a, b) => b.publishDate.localeCompare(a.publishDate)),
    [db.announcements, user, scope],
  );
}
function AnnouncementList({ items }) {
  if (!items.length) return <EmptyState icon={Megaphone} title="No announcements" />;
  return (
    <ul className="list">
      {items.slice(0, 5).map((a) => (
        <li key={a.id}>
          <div className="row between start nowrap">
            <p className="strong">{a.title}</p>
            {a.priority !== 'Normal' && <Badge>{a.priority}</Badge>}
          </div>
          <p className="clamp-2 xs muted">{a.body}</p>
          <p className="xs muted">
            {fmtDate(a.publishDate)} · {a.authorName}
          </p>
        </li>
      ))}
    </ul>
  );
}
function EventsList() {
  const { db } = useData();
  const items = db.events
    .filter((e) => e.active !== false && e.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  if (!items.length) return <EmptyState icon={CalendarDays} title="No upcoming events" />;
  return (
    <ul className="meters">
      {items.map((e) => {
        const d = new Date(e.date);
        return (
          <li key={e.id} className="row">
            <div className="event-date">
              <p className="m">{MONTHS[d.getMonth()]}</p>
              <p className="d">{d.getDate()}</p>
            </div>
            <div className="grow">
              <p className="truncate strong">{e.title}</p>
              <p className="xs muted">
                {e.type} · {DAY[d.getDay()]}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
/* ====================== Institutional / Department dashboard ====================== */
function InstitutionalDashboard() {
  const { user } = useAuth();
  const { db, ayId, settings, can } = useData();
  const scope = useScope();
  const navigate = useNavigate();
  const today = todayISO();
  const dept = scope.departmentId;
  const announcements = useMyAnnouncements();
  const m = useMemo(() => {
    const inDept = (d) => !dept || d === dept;
    const students = db.students.filter((s) => s.active !== false && s.status === 'Active' && inDept(s.departmentId));
    const faculty = db.employees.filter(
      (e) => e.active !== false && e.category === 'Teaching' && e.status !== 'Resigned' && (dept ? e.departmentId === dept : true),
    );
    const courseMap = new Map(db.courses.map((c) => [c.id, c]));
    const courses = db.courses.filter((c) => c.active !== false && c.status === 'Active' && inDept(c.departmentId));
    const sessions = db.attendance.filter((a) => a.academicYearId === ayId && inDept(courseMap.get(a.courseId)?.departmentId));
    const asm = db.assessments.filter((a) => a.academicYearId === ayId && inDept(courseMap.get(a.courseId)?.departmentId));
    const pendingAsm = asm.filter((a) => a.status !== 'Verified');
    const exams = db.exams.filter(
      (e) => e.academicYearId === ayId && e.date >= today && e.status === 'Scheduled' && inDept(courseMap.get(e.courseId)?.departmentId),
    );
    const approvals = [
      {
        label: 'Admission applications under review',
        n: dept ? 0 : db.applicants.filter((a) => a.status === 'Under Review').length,
        to: '/admin/admissions',
        show: can('admissions'),
      },
      {
        label: 'Course files pending review',
        n: db.courseFiles.filter((f) => f.status === 'Pending Review' && inDept(f.departmentId)).length,
        to: '/academic/course-files',
        show: can('course-files'),
      },
      {
        label: 'Questions awaiting approval',
        n: db.questions.filter((q) => q.status === 'Pending Review' && inDept(courseMap.get(q.courseId)?.departmentId)).length,
        to: '/academic/question-bank',
        show: can('question-bank'),
      },
      {
        label: 'Student leave requests',
        n: db.leaveRequests.filter((l) => l.status === 'Pending' && inDept(db.students.find((s) => s.id === l.studentId)?.departmentId))
          .length,
        to: '/academic/attendance',
        show: can('attendance'),
      },
      {
        label: 'Draft curricula awaiting approval',
        n: db.curricula.filter((c) => c.status === 'Draft' && inDept(db.programs.find((p) => p.id === c.programId)?.departmentId)).length,
        to: '/academic/curriculum',
        show: can('curriculum'),
      },
      {
        label: 'Assessments not yet verified',
        n: pendingAsm.filter((a) => a.status === 'Marks Entered').length,
        to: '/academic/assessments',
        show: can('assessments'),
      },
    ].filter((x) => x.show);
    const deptDist = db.departments
      .filter((d) => inDept(d.id))
      .map((d) => ({
        dept: d.code,
        Students: students.filter((s) => s.departmentId === d.id).length,
        Faculty: faculty.filter((f) => f.departmentId === d.id).length,
      }));
    const years = [2023, 2024, 2025, 2026];
    const enrollment = years.map((y) => ({
      year: `${y}-${String(y + 1).slice(2)}`,
      Enrolled: students.filter((s) => s.admissionYear <= y && s.admissionYear > y - 4).length,
      'New admissions': students.filter((s) => s.admissionYear === y).length,
    }));
    const byMonth = groupBy(sessions, (s) => s.date.slice(0, 7));
    const attTrend = Object.keys(byMonth)
      .sort()
      .map((k) => ({ month: MONTHS[Number(k.slice(5, 7)) - 1], Attendance: overallAttendancePct(byMonth[k]) }));
    // exam performance: average internal % by department (current AY) and pass % (previous AY published results)
    const perf = db.departments
      .filter((d) => inDept(d.id))
      .map((d) => {
        const list = asm.filter((a) => courseMap.get(a.courseId)?.departmentId === d.id && a.status !== 'Scheduled');
        const vals = [];
        list.forEach((a) => Object.values(a.marks).forEach((v) => v != null && vals.push((Number(v) / a.maxMarks) * 100)));
        return { dept: d.code, 'Avg. internal %': round1(avg(vals)) };
      });
    return {
      students,
      faculty,
      courses,
      sessions,
      attPct: overallAttendancePct(sessions),
      pendingAsm,
      exams,
      approvals,
      deptDist,
      enrollment,
      attTrend,
      perf,
    };
  }, [db, ayId, dept, today, can]);
  const programs = db.programs.filter((p) => p.active !== false && (!dept || p.departmentId === dept));
  const logs = db.auditLogs
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7);
  const totalApprovals = sum(m.approvals.map((a) => a.n));
  const deptName = dept ? db.departments.find((d) => d.id === dept)?.name : null;
  // HOD extras
  const workload = useMemo(() => {
    if (!dept) return [];
    return m.faculty.map((f) => ({
      name: f.name.replace(/^Dr\. /, '').split(' ')[0],
      full: f.name,
      Hours: sum(db.allocations.filter((a) => a.facultyId === f.id && a.academicYearId === ayId).map((a) => a.hoursPerWeek)),
      max: f.maxWorkload,
    }));
  }, [dept, m.faculty, db.allocations, ayId]);
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ').slice(0, 2).join(' ')}`}
        subtitle={`${roleLabel(user.role)} dashboard · ${deptName ?? settings.institutionName} · AY ${labelOf(db, 'academicYears', ayId)}`}
      />
      <div className="grid cols-4 stats">
        <StatCard
          label="Total students"
          value={m.students.length.toLocaleString('en-IN')}
          icon={GraduationCap}
          hint={`${programs.length} programs`}
          onClick={can('admissions') ? () => navigate('/admin/admissions') : undefined}
        />
        <StatCard
          label="Faculty"
          value={m.faculty.length}
          icon={Users}
          tone="blue"
          hint={`Student–faculty ratio ${m.faculty.length ? round1(m.students.length / m.faculty.length) : 0}:1`}
        />
        <StatCard
          label={dept ? 'Programs' : 'Departments / Programs'}
          value={dept ? programs.length : `${db.departments.filter((d) => d.active !== false).length} / ${programs.length}`}
          icon={Building2}
          tone="violet"
        />
        <StatCard
          label="Active courses"
          value={m.courses.length}
          icon={BookOpen}
          tone="navy"
          onClick={can('courses') ? () => navigate('/academic/courses') : undefined}
        />
        <StatCard
          label="Attendance"
          value={`${m.attPct}%`}
          icon={ClipboardCheck}
          tone={m.attPct >= settings.minAttendance ? 'green' : 'amber'}
          hint={`${m.sessions.length} sessions recorded`}
          onClick={can('attendance') ? () => navigate('/academic/attendance') : undefined}
        />
        <StatCard
          label="Pending assessments"
          value={m.pendingAsm.length}
          icon={FileCheck2}
          tone="amber"
          hint="Scheduled or awaiting verification"
          onClick={can('assessments') ? () => navigate('/academic/assessments') : undefined}
        />
        <StatCard
          label="Upcoming exams"
          value={m.exams.length}
          icon={CalendarCheck}
          tone="blue"
          hint={m.exams[0] ? `Next: ${fmtDate(m.exams.map((e) => e.date).sort()[0])}` : undefined}
          onClick={can('examinations') ? () => navigate('/academic/examinations') : undefined}
        />
        <StatCard label="Pending approvals" value={totalApprovals} icon={Inbox} tone={totalApprovals ? 'red' : 'green'} />
      </div>

      <div className="grid cols-3 mt-16">
        <Card title="Department-wise distribution" subtitle="Active students and faculty" className="span-2">
          <SimpleBar
            data={m.deptDist}
            x="dept"
            bars={[
              { key: 'Students', label: 'Students' },
              { key: 'Faculty', label: 'Faculty' },
            ]}
          />
        </Card>
        <Card title="Pending approvals & tasks">
          {m.approvals.length === 0 ? (
            <EmptyState title="Nothing pending" />
          ) : (
            <ul className="stack tight">
              {m.approvals.map((a) => (
                <li key={a.label}>
                  <Link to={a.to} className="link-row">
                    <span>{a.label}</span>
                    <span className={`count-pill ${a.n ? 'on' : ''}`}>{a.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid cols-3 mt-16">
        <Card title="Attendance trend" subtitle="Monthly average, current academic year">
          {m.attTrend.length ? (
            <SimpleLine
              data={m.attTrend}
              x="month"
              lines={[{ key: 'Attendance', label: 'Attendance %' }]}
              unit="%"
              yDomain={[50, 100]}
              refLine={{ y: settings.minAttendance, label: `Min ${settings.minAttendance}%` }}
            />
          ) : (
            <EmptyState title="No attendance recorded for this year" />
          )}
        </Card>
        <Card title="Student enrollment trend" subtitle="Enrolled vs new admissions">
          <SimpleBar
            data={m.enrollment}
            x="year"
            bars={[
              { key: 'Enrolled', label: 'Enrolled' },
              { key: 'New admissions', label: 'New admissions' },
            ]}
          />
        </Card>
        <Card title="Examination performance" subtitle="Average internal assessment score by department">
          <SimpleBar data={m.perf} x="dept" bars={[{ key: 'Avg. internal %', label: 'Avg. internal %' }]} unit="%" yMax={100} />
        </Card>
      </div>

      {dept && (
        <div className="grid cols-2 mt-16">
          <Card
            title="Faculty workload"
            subtitle="Allocated hours per week vs maximum"
            actions={
              <Link to="/academic/allocation" className="small">
                Manage allocation
              </Link>
            }
          >
            <ul className="meters">
              {workload.map((w) => (
                <li key={w.full}>
                  <div className="meter-label">
                    <span>{w.full}</span>
                    <span className={w.Hours > w.max ? 'strong text-red' : 'muted'}>
                      {w.Hours} / {w.max} h
                    </span>
                  </div>
                  <ProgressBar value={(w.Hours / Math.max(1, w.max)) * 100} tone={w.Hours > w.max ? 'red' : 'navy'} />
                </li>
              ))}
            </ul>
          </Card>
          <CourseProgress dept={dept} />
        </div>
      )}

      <div className="grid cols-3 mt-16">
        <Card
          title="Recent activities"
          actions={
            can('audit-logs') ? (
              <Link to="/settings/audit-logs" className="small">
                View all
              </Link>
            ) : undefined
          }
        >
          {logs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent activity"
              message="Actions such as approvals, updates and sign-ins will appear here."
            />
          ) : (
            <ul className="meters">
              {logs.map((l) => (
                <li key={l.id} className="activity">
                  <span className="dot" />
                  <div className="grow">
                    <p className="truncate">
                      <span className="strong">{l.userName}</span> · {l.action} {l.entity}
                    </p>
                    <p className="xs muted">
                      {fmtDateTime(l.createdAt)}
                      {l.details ? ` · ${l.details}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming academic events">
          <EventsList />
        </Card>
        <Card
          title="Notices & announcements"
          actions={
            <Link to="/services/communication" className="small">
              All
            </Link>
          }
        >
          <AnnouncementList items={announcements} />
        </Card>
      </div>
    </>
  );
}
function CourseProgress({ dept, facultyId }) {
  const { db, ayId } = useData();
  const rows = useMemo(() => {
    const allocs = db.allocations.filter(
      (a) =>
        a.academicYearId === ayId &&
        (facultyId ? a.facultyId === facultyId : db.courses.find((c) => c.id === a.courseId)?.departmentId === dept),
    );
    return allocs
      .map((a) => {
        const lps = db.lessonPlans.filter((l) => l.courseId === a.courseId && l.sectionId === a.sectionId);
        const done = lps.filter((l) => l.status === 'Completed').length;
        const due = lps.filter((l) => l.plannedDate <= todayISO()).length;
        return {
          a,
          course: db.courses.find((c) => c.id === a.courseId),
          done,
          total: lps.length,
          due,
          delayed: lps.filter((l) => l.status === 'Delayed').length,
        };
      })
      .sort((x, y) => y.delayed - x.delayed);
  }, [db, ayId, dept, facultyId]);
  return (
    <Card
      title="Course progress"
      subtitle="Lesson plan completion (planned vs completed)"
      actions={
        <Link to="/academic/lesson-plans" className="small">
          Lesson plans
        </Link>
      }
      bodyClass="scroll"
    >
      {rows.length === 0 ? (
        <EmptyState title="No courses allocated" />
      ) : (
        <ul className="meters">
          {rows.map((r) => (
            <li key={r.a.id}>
              <div className="meter-label">
                <span className="truncate">
                  {r.course.code} · {r.course.name} <span className="muted">({labelOf(db, 'sections', r.a.sectionId)})</span>
                </span>
                <span className="muted">
                  {r.done}/{r.total}
                  {r.delayed ? <span className="text-amber">· {r.delayed} delayed</span> : null}
                </span>
              </div>
              <ProgressBar value={pct(r.done, r.total)} tone={r.delayed ? 'amber' : 'green'} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
/* ====================== Faculty ====================== */
function FacultyDashboard() {
  const { user } = useAuth();
  const { db, ayId, settings } = useData();
  const navigate = useNavigate();
  const fid = user.employeeId;
  const allocs = db.allocations.filter((a) => a.facultyId === fid && a.academicYearId === ayId);
  const dow = DAY[new Date().getDay()];
  const todays = db.timetable
    .filter((t) => t.facultyId === fid && t.day === dow && t.academicYearId === ayId)
    .sort((a, b) => a.period - b.period);
  const keys = new Set(allocs.map((a) => a.courseId + '|' + a.sectionId));
  const asm = db.assessments.filter((a) => a.academicYearId === ayId && keys.has(a.courseId + '|' + a.sectionId));
  const sessions = db.attendance.filter((s) => s.academicYearId === ayId && keys.has(s.courseId + '|' + s.sectionId));
  const stats = attendanceStats(sessions);
  const low = [...stats.entries()].filter(([, s]) => s.pct < settings.minAttendance);
  const lps = db.lessonPlans.filter((l) => l.facultyId === fid && l.academicYearId === ayId);
  const announcements = useMyAnnouncements();
  const perCourse = allocs.map((a) => {
    const ss = sessions.filter((s) => s.courseId === a.courseId && s.sectionId === a.sectionId);
    return { course: db.courses.find((c) => c.id === a.courseId)?.code ?? '', Attendance: overallAttendancePct(ss) };
  });
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name}`}
        subtitle={`${roleLabel(user.role)} · ${labelOf(db, 'departments', user.departmentId)} · ${allocs.length} course-sections this year`}
      />
      <div className="grid cols-4 stats">
        <StatCard
          label="Assigned courses"
          value={allocs.length}
          icon={BookOpen}
          hint={`${sum(allocs.map((a) => a.hoursPerWeek))} hours / week`}
          onClick={() => navigate('/academic/allocation')}
        />
        <StatCard label="Classes today" value={todays.length} icon={Clock} tone="blue" onClick={() => navigate('/academic/timetable')} />
        <StatCard
          label="Assessments to complete"
          value={asm.filter((a) => a.status !== 'Verified').length}
          icon={FileCheck2}
          tone="amber"
          onClick={() => navigate('/academic/assessments')}
        />
        <StatCard
          label="Students below attendance"
          value={low.length}
          icon={AlertTriangle}
          tone={low.length ? 'red' : 'green'}
          hint={`Threshold ${settings.minAttendance}%`}
          onClick={() => navigate('/academic/attendance')}
        />
      </div>
      <div className="grid cols-3 mt-16">
        <Card title={`Today's timetable (${dow})`}>
          {todays.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes today" />
          ) : (
            <ul className="stack tight">
              {todays.map((t) => (
                <li key={t.id} className="slot-row">
                  <span className="period-tag">P{t.period}</span>
                  <div className="grow">
                    <p className="truncate strong">{labelOf(db, 'courses', t.courseId)}</p>
                    <p className="xs muted">
                      {labelOf(db, 'sections', t.sectionId)} · {labelOf(db, 'rooms', t.roomId)}
                    </p>
                  </div>
                  <Link to={`/academic/attendance?course=${t.courseId}&section=${t.sectionId}`} className="small strong">
                    Mark
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Attendance by course" className="span-2">
          <SimpleBar
            data={perCourse}
            x="course"
            bars={[{ key: 'Attendance', label: 'Attendance %' }]}
            unit="%"
            yMax={100}
            refLine={{ y: settings.minAttendance, label: 'Minimum' }}
          />
        </Card>
      </div>
      <div className="grid cols-3 mt-16">
        <CourseProgress facultyId={fid} />
        <Card title="Upcoming assessments">
          <ul className="stack tight">
            {asm
              .filter((a) => a.status === 'Scheduled')
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 6)
              .map((a) => (
                <li key={a.id} className="row between nowrap">
                  <span className="truncate">
                    {a.name} · {db.courses.find((c) => c.id === a.courseId)?.code}
                  </span>
                  <span className="xs muted">{fmtDate(a.date)}</span>
                </li>
              ))}
            {!asm.some((a) => a.status === 'Scheduled') && <EmptyState title="No scheduled assessments" />}
          </ul>
          <p className="mt-12 xs muted">Lesson plan completion: {pct(lps.filter((l) => l.status === 'Completed').length, lps.length)}%</p>
        </Card>
        <Card title="Notices">
          <AnnouncementList items={announcements} />
        </Card>
      </div>
    </>
  );
}
/* ====================== Mentor ====================== */
function MentorDashboard() {
  const { user } = useAuth();
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const navigate = useNavigate();
  const mentees = scope.students;
  const att = attendanceStats(db.attendance.filter((s) => s.academicYearId === ayId));
  const risk = studentRisk(
    mentees,
    att,
    db.assessments.filter((a) => a.academicYearId === ayId),
    db.invoices,
    settings,
  );
  const meetings = db.mentoringMeetings.filter((m) => m.mentorId === user.employeeId);
  const open = meetings.filter((m) => m.followUpStatus !== 'Closed');
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle={`Mentor · ${mentees.length} assigned students`} />
      <div className="grid cols-4 stats">
        <StatCard label="Mentees" value={mentees.length} icon={Users} onClick={() => navigate('/academic/mentoring')} />
        <StatCard
          label="High-risk mentees"
          value={risk.filter((r) => r.level === 'High Risk').length}
          icon={AlertTriangle}
          tone="red"
          onClick={() => navigate('/ai/early-warning')}
        />
        <StatCard label="Open follow-ups" value={open.length} icon={Inbox} tone="amber" />
        <StatCard label="Meetings recorded" value={meetings.length} icon={CalendarCheck} tone="green" />
      </div>
      <div className="grid cols-2 mt-16">
        <Card
          title="Mentees needing attention"
          actions={
            <Link to="/ai/early-warning" className="small">
              Early-warning view
            </Link>
          }
        >
          <ul className="list">
            {risk.slice(0, 8).map((r) => (
              <li key={r.student.id} className="row between nowrap">
                <Link to={`/students/${r.student.id}`} className="grow">
                  <p className="truncate strong">{r.student.name}</p>
                  <p className="xs muted">
                    {r.student.rollNo} · Att {r.attendance}% · Internal {r.internal ?? '—'}%
                  </p>
                </Link>
                <Badge>{r.level}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title="Open follow-up actions"
          actions={
            <Link to="/academic/mentoring" className="small">
              Mentoring
            </Link>
          }
        >
          {open.length === 0 ? (
            <EmptyState title="No open follow-ups" />
          ) : (
            <ul className="list">
              {open.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <p>{labelOf(db, 'students', m.studentId)}</p>
                  <p className="xs muted">
                    {m.concerns} · due {fmtDate(m.followUpDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
/* ====================== Student / Parent ====================== */
function StudentDashboard() {
  const { user } = useAuth();
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const navigate = useNavigate();
  const s = scope.linkedStudent;
  const announcements = useMyAnnouncements();
  if (!s)
    return <EmptyState title="No linked student record" message="Contact the administration to link your account to a student record." />;
  const sessions = db.attendance.filter((a) => a.academicYearId === ayId);
  const byCourse = attendanceStats(sessions, (x) => x.courseId);
  const overall = attendanceStats(sessions).get(s.id);
  const asm = db.assessments.filter((a) => a.academicYearId === ayId && a.studentIds.includes(s.id));
  const courseIds = [...new Set(sessions.map((x) => x.courseId))];
  const attRows = courseIds.map((cid) => ({
    course: db.courses.find((c) => c.id === cid)?.code ?? cid,
    Attendance: byCourse.get(cid)?.pct ?? 0,
  }));
  const dow = DAY[new Date().getDay()];
  const todays = db.timetable.filter((t) => t.sectionId === s.sectionId && t.day === dow).sort((a, b) => a.period - b.period);
  const inv = db.invoices.filter((i) => i.studentId === s.id && i.status !== 'Cancelled');
  const due = sum(inv.map((i) => i.amount - i.paid));
  const tickets = db.tickets.filter((t) => t.studentId === s.id && t.status !== 'Closed' && t.status !== 'Resolved');
  const internal = internalPercent(asm, s.id);
  const isParent = user.role === 'parent';
  return (
    <>
      <PageHeader
        title={isParent ? `Welcome, ${user.name}` : `${greeting()}, ${s.name.split(' ')[0]}`}
        subtitle={`${isParent ? 'Parent of ' + s.name + ' · ' : ''}${s.rollNo} · ${labelOf(db, 'programs', s.programId)} · Semester ${s.semesterNo}`}
      />
      <div className="grid cols-4 stats">
        <StatCard
          label="Overall attendance"
          value={`${overall?.pct ?? 0}%`}
          icon={ClipboardCheck}
          tone={(overall?.pct ?? 0) >= settings.minAttendance ? 'green' : 'red'}
          hint={`${overall?.present ?? 0} of ${overall?.total ?? 0} classes`}
          onClick={() => navigate('/academic/attendance')}
        />
        <StatCard
          label="Internal average"
          value={internal !== null ? `${internal}%` : '—'}
          icon={Award}
          tone="blue"
          onClick={() => navigate('/academic/results')}
        />
        <StatCard label="CGPA" value={s.cgpa ?? '—'} icon={GraduationCap} tone="violet" />
        <StatCard
          label="Fee outstanding"
          value={fmtMoney(due)}
          icon={Wallet}
          tone={due > 0 ? 'amber' : 'green'}
          onClick={() => navigate('/admin/finance')}
        />
      </div>
      {(overall?.pct ?? 100) < settings.minAttendance && (
        <div className="warning-banner mt-16">
          <AlertTriangle />
          Attendance is below the required {settings.minAttendance}%. Students below the threshold may not be eligible for end-semester
          examinations.
        </div>
      )}
      <div className="grid cols-3 mt-16">
        <Card title={`Today's classes (${dow})`}>
          {todays.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes today" />
          ) : (
            <ul className="stack tight">
              {todays.map((t) => (
                <li key={t.id} className="row">
                  <span className="period-tag">P{t.period}</span>
                  <div className="grow">
                    <p className="truncate">{labelOf(db, 'courses', t.courseId)}</p>
                    <p className="xs muted">
                      {labelOf(db, 'employees', t.facultyId)} · {labelOf(db, 'rooms', t.roomId)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Attendance by course" className="span-2">
          <SimpleBar
            data={attRows}
            x="course"
            bars={[{ key: 'Attendance', label: 'Attendance %' }]}
            unit="%"
            yMax={100}
            refLine={{ y: settings.minAttendance, label: 'Minimum' }}
          />
        </Card>
      </div>
      <div className="grid cols-3 mt-16">
        <Card
          title="Recent marks"
          actions={
            <Link to="/academic/assessments" className="small">
              All marks
            </Link>
          }
        >
          <ul className="list">
            {asm
              .filter((a) => a.marks[s.id] != null)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 7)
              .map((a) => (
                <li key={a.id} className="row between nowrap">
                  <span className="truncate">
                    {db.courses.find((c) => c.id === a.courseId)?.code} · {a.name}
                  </span>
                  <span className="strong">
                    {a.marks[s.id]}/{a.maxMarks}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
        <Card title="Notices">
          <AnnouncementList items={announcements} />
        </Card>
        <Card title="Support & upcoming">
          <Link to="/services/support" className="link-row mb-12">
            <span className="row">
              <LifeBuoy className="icon-16" />
              Open support tickets
            </span>
            <span className="strong">{tickets.length}</span>
          </Link>
          <EventsList />
        </Card>
      </div>
    </>
  );
}
/* ====================== Examination cell ====================== */
function ExamDashboard() {
  const { user } = useAuth();
  const { db, ayId, settings } = useData();
  const navigate = useNavigate();
  const exams = db.exams.filter((e) => e.academicYearId === ayId);
  const upcoming = exams.filter((e) => e.date >= todayISO() && e.status === 'Scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const asm = db.assessments.filter((a) => a.academicYearId === ayId);
  const pubs = db.resultPublications.filter((r) => r.academicYearId === ayId);
  const byStatus = ['Scheduled', 'Marks Entered', 'Verified'].map((s) => ({ status: s, Count: asm.filter((a) => a.status === s).length }));
  const prev = db.resultPublications.filter((r) => r.status === 'Published');
  const passRows = db.departments.map((d) => {
    const res = prev
      .filter((p) => db.courses.find((c) => c.id === p.courseId)?.departmentId === d.id)
      .flatMap((p) =>
        computeResults(
          db.assessments.filter((a) => a.courseId === p.courseId && a.sectionId === p.sectionId),
          settings,
        ),
      );
    return { dept: d.code, 'Pass %': pct(res.filter((r) => r.pass).length, res.length) };
  });
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle="Examination Cell dashboard" />
      <div className="grid cols-4 stats">
        <StatCard label="Upcoming exams" value={upcoming.length} icon={CalendarCheck} onClick={() => navigate('/academic/examinations')} />
        <StatCard
          label="Marks awaiting verification"
          value={asm.filter((a) => a.status === 'Marks Entered').length}
          icon={FileCheck2}
          tone="amber"
          onClick={() => navigate('/academic/assessments')}
        />
        <StatCard
          label="Results published"
          value={`${pubs.filter((p) => p.status === 'Published').length}/${pubs.length}`}
          icon={Award}
          tone="green"
          onClick={() => navigate('/academic/results')}
        />
        <StatCard label="Exam halls" value={db.rooms.filter((r) => r.type === 'Exam Hall').length} icon={Building2} tone="blue" />
      </div>
      <div className="grid cols-3 mt-16">
        <Card title="Assessment marks status">
          <SimpleBar data={byStatus} x="status" bars={[{ key: 'Count', label: 'Assessments' }]} />
        </Card>
        <Card title="Previous-term pass percentage" subtitle="Published results by department">
          <SimpleBar data={passRows} x="dept" bars={[{ key: 'Pass %', label: 'Pass %' }]} unit="%" yMax={100} />
        </Card>
        <Card title="Next examinations" bodyClass="scroll">
          <ul className="list">
            {upcoming.slice(0, 10).map((e) => (
              <li key={e.id}>
                <p className="truncate">{labelOf(db, 'courses', e.courseId)}</p>
                <p className="xs muted">
                  {e.name} · {fmtDate(e.date)} {e.session} · {labelOf(db, 'rooms', e.roomId)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
/* ====================== Finance ====================== */
function FinanceDashboard() {
  const { user } = useAuth();
  const { db, ayId } = useData();
  const navigate = useNavigate();
  const inv = db.invoices.filter((i) => i.academicYearId === ayId && i.status !== 'Cancelled');
  const billed = sum(inv.map((i) => i.amount)),
    collected = sum(inv.map((i) => i.paid));
  const byProgram = db.programs
    .map((p) => {
      const l = inv.filter((i) => db.students.find((s) => s.id === i.studentId)?.programId === p.id);
      return {
        program: p.code,
        Collected: Math.round((sum(l.map((i) => i.paid)) / 100000) * 10) / 10,
        Outstanding: Math.round((sum(l.map((i) => i.amount - i.paid)) / 100000) * 10) / 10,
      };
    })
    .filter((r) => r.Collected + r.Outstanding > 0);
  const byMonth = groupBy(db.payments, (p) => p.date.slice(0, 7));
  const trend = Object.keys(byMonth)
    .sort()
    .map((k) => ({
      month: MONTHS[Number(k.slice(5)) - 1],
      Collections: Math.round((sum(byMonth[k].map((p) => p.amount)) / 100000) * 10) / 10,
    }));
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle="Finance dashboard · amounts in ₹ lakh where charted" />
      <div className="grid cols-4 stats">
        <StatCard label="Total billed" value={fmtMoney(billed)} icon={IndianRupee} />
        <StatCard
          label="Collected"
          value={fmtMoney(collected)}
          icon={Wallet}
          tone="green"
          hint={`${pct(collected, billed)}% collection rate`}
        />
        <StatCard
          label="Outstanding"
          value={fmtMoney(billed - collected)}
          icon={AlertTriangle}
          tone="red"
          onClick={() => navigate('/admin/finance')}
        />
        <StatCard
          label="Unpaid invoices"
          value={inv.filter((i) => i.status === 'Unpaid').length}
          icon={FileCheck2}
          tone="amber"
          onClick={() => navigate('/admin/finance')}
        />
      </div>
      <div className="grid cols-2 mt-16">
        <Card title="Collection vs outstanding by program" subtitle="₹ lakh">
          <SimpleBar
            data={byProgram}
            x="program"
            stacked
            bars={[
              { key: 'Collected', label: 'Collected', color: '#2a78d6' },
              { key: 'Outstanding', label: 'Outstanding', color: '#eb6834' },
            ]}
          />
        </Card>
        <Card title="Monthly collections" subtitle="₹ lakh">
          <SimpleLine data={trend} x="month" lines={[{ key: 'Collections', label: 'Collections' }]} />
        </Card>
      </div>
    </>
  );
}
/* ====================== Placement ====================== */
function PlacementDashboard() {
  const { user } = useAuth();
  const { db } = useData();
  const finalYears = db.students.filter((s) => s.semesterNo === 7 && s.active !== false);
  const selected = db.placementApplications.filter((a) => a.status === 'Selected');
  const placed = new Set(selected.map((a) => a.studentId));
  const ctc = selected.map((a) => db.drives.find((d) => d.id === a.driveId)?.ctcLpa ?? 0);
  const byDept = db.departments.map((d) => {
    const fy = finalYears.filter((s) => s.departmentId === d.id);
    return { dept: d.code, 'Placed %': pct(fy.filter((s) => placed.has(s.id)).length, fy.length) };
  });
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle="Placement Cell dashboard · Batch 2023-27" />
      <div className="grid cols-4 stats">
        <StatCard label="Eligible final-year" value={finalYears.length} icon={GraduationCap} />
        <StatCard
          label="Students placed"
          value={placed.size}
          icon={UserCheck}
          tone="green"
          hint={`${pct(placed.size, finalYears.length)}% of batch`}
        />
        <StatCard label="Highest / avg CTC" value={`${Math.max(0, ...ctc)} / ${round1(avg(ctc))} LPA`} icon={Briefcase} tone="violet" />
        <StatCard
          label="Upcoming drives"
          value={db.drives.filter((d) => d.status === 'Upcoming').length}
          icon={CalendarCheck}
          tone="blue"
        />
      </div>
      <div className="grid cols-2 mt-16">
        <Card title="Placement percentage by department">
          <SimpleBar data={byDept} x="dept" bars={[{ key: 'Placed %', label: 'Placed %' }]} unit="%" yMax={100} />
        </Card>
        <Card title="Drives" bodyClass="scroll">
          <ul className="list">
            {db.drives
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((d) => (
                <li key={d.id} className="row between nowrap">
                  <span className="grow">
                    <span className="truncate">{labelOf(db, 'drives', d.id)}</span>
                    <span className="xs muted">
                      {fmtDate(d.date)} · {d.ctcLpa} LPA
                    </span>
                  </span>
                  <Badge>{d.status}</Badge>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
/* ====================== Library ====================== */
function LibraryDashboard() {
  const { user } = useAuth();
  const { db } = useData();
  const issued = db.bookIssues.filter((i) => i.status === 'Issued');
  const overdue = issued.filter((i) => i.dueDate < todayISO());
  const cats = groupBy(db.books, (b) => b.category);
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle="Library dashboard" />
      <div className="grid cols-4 stats">
        <StatCard label="Titles" value={db.books.length} icon={BookCopy} />
        <StatCard label="Total copies" value={sum(db.books.map((b) => b.copies))} icon={BookOpen} tone="blue" />
        <StatCard label="Currently issued" value={issued.length} icon={ClipboardCheck} tone="violet" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertTriangle} tone="red" />
      </div>
      <div className="grid cols-2 mt-16">
        <Card title="Collection by category">
          <ShareBars
            items={Object.entries(cats)
              .map(([k, v]) => ({ label: k, value: sum(v.map((b) => b.copies)), sub: `${v.length} titles` }))
              .sort((a, b) => b.value - a.value)}
          />
        </Card>
        <Card title="Overdue books">
          {overdue.length === 0 ? (
            <EmptyState title="No overdue books" />
          ) : (
            <ul className="list">
              {overdue.slice(0, 10).map((i) => (
                <li key={i.id}>
                  <p>{labelOf(db, 'books', i.bookId)}</p>
                  <p className="xs muted">
                    {labelOf(db, 'students', i.memberId)} · due {fmtDate(i.dueDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
/* ====================== HR ====================== */
function HRDashboard() {
  const { user } = useAuth();
  const { db } = useData();
  const emps = db.employees.filter((e) => e.active !== false);
  const byDes = groupBy(emps, (e) => e.designation);
  const byDept = db.departments.map((d) => ({
    dept: d.code,
    Teaching: emps.filter((e) => e.departmentId === d.id && e.category === 'Teaching').length,
  }));
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name}`} subtitle="Human Resources dashboard" />
      <div className="grid cols-4 stats">
        <StatCard label="Employees" value={emps.length} icon={Users} />
        <StatCard label="Teaching" value={emps.filter((e) => e.category === 'Teaching').length} icon={GraduationCap} tone="blue" />
        <StatCard label="Ph.D holders" value={emps.filter((e) => e.qualification === 'Ph.D').length} icon={Award} tone="violet" />
        <StatCard label="On leave" value={emps.filter((e) => e.status === 'On Leave').length} icon={CalendarDays} tone="amber" />
      </div>
      <div className="grid cols-2 mt-16">
        <Card title="Teaching staff by department">
          <SimpleBar data={byDept} x="dept" bars={[{ key: 'Teaching', label: 'Teaching staff' }]} />
        </Card>
        <Card title="Staff by designation">
          <ShareBars
            items={Object.entries(byDes)
              .map(([k, v]) => ({ label: k, value: v.length }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8)}
          />
        </Card>
      </div>
    </>
  );
}
export default function Dashboard() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'student':
    case 'parent':
      return <StudentDashboard />;
    case 'faculty':
    case 'course-champion':
      return <FacultyDashboard />;
    case 'mentor':
      return <MentorDashboard />;
    case 'exam-cell':
      return <ExamDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'placement':
      return <PlacementDashboard />;
    case 'library':
      return <LibraryDashboard />;
    case 'hr':
      return <HRDashboard />;
    default:
      return (
        <>
          <InstitutionalDashboard />
          {user?.role === 'it-admin' && <SystemPanel />}
          {(user?.role === 'iqac' || user?.role === 'accreditation') && <QualityPanel />}
        </>
      );
  }
}
function SystemPanel() {
  const { db, mode } = useData();
  return (
    <div className="grid cols-4 stats mt-16">
      <StatCard
        label="User accounts"
        value={db.users.length}
        icon={Users}
        hint={`${db.users.filter((u) => u.active !== false).length} active`}
      />
      <StatCard label="Audit log entries" value={db.auditLogs.length} icon={ShieldCheck} tone="violet" />
      <StatCard label="Data backend" value={mode === 'demo' ? 'Demo (IndexedDB)' : 'Cloud Firestore'} icon={Activity} tone="blue" />
      <StatCard label="Open support tickets" value={db.tickets.filter((t) => t.status === 'Open').length} icon={LifeBuoy} tone="amber" />
    </div>
  );
}
function QualityPanel() {
  const { db } = useData();
  return (
    <div className="grid cols-4 stats mt-16">
      <StatCard
        label="Accreditation evidence"
        value={db.evidence.length}
        icon={ShieldCheck}
        hint={`${db.evidence.filter((e) => e.status === 'Verified').length} verified`}
      />
      <StatCard label="Course outcomes defined" value={db.courseOutcomes.length} icon={Award} tone="violet" />
      <StatCard label="CO-PO mappings" value={db.coPoMaps.length} icon={Activity} tone="blue" />
      <StatCard label="Feedback responses" value={db.feedbackResponses.length} icon={Megaphone} tone="green" />
    </div>
  );
}
