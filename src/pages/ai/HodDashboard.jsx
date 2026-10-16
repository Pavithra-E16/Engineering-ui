import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, ClipboardCheck, FileCheck2, NotebookPen, Users, Inbox, Siren } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats, overallAttendancePct, studentRisk } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { Button, Card, EmptyState, Field, PageHeader, ProgressBar, Select, StatCard, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { runAi } from '../../lib/ai';
import { avg, pct, round1, sum, todayISO } from '../../lib/utils';
import { AiNotice, AiStatus } from './common';
export default function HodDashboard() {
  const { db, ayId, settings, audit } = useData();
  const scope = useScope();
  const toast = useToast();
  const [dept, setDept] = useState(scope.departmentId ?? db.departments[0]?.id ?? '');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const m = useMemo(() => {
    const courses = new Map(db.courses.filter((c) => c.departmentId === dept).map((c) => [c.id, c]));
    const allocs = db.allocations.filter((a) => a.academicYearId === ayId && courses.has(a.courseId));
    const sessions = db.attendance.filter((s) => s.academicYearId === ayId && courses.has(s.courseId));
    const asm = db.assessments.filter((a) => a.academicYearId === ayId && courses.has(a.courseId));
    const lps = db.lessonPlans.filter((l) => l.academicYearId === ayId && courses.has(l.courseId));
    const students = db.students.filter((s) => s.departmentId === dept && s.active !== false);
    const faculty = db.employees.filter((e) => e.departmentId === dept && e.category === 'Teaching' && e.active !== false);
    const perCourse = allocs.map((a) => {
      const ss = sessions.filter((s) => s.courseId === a.courseId && s.sectionId === a.sectionId);
      const as = asm.filter((x) => x.courseId === a.courseId && x.sectionId === a.sectionId && x.status !== 'Scheduled');
      const vals = as.flatMap((x) =>
        Object.values(x.marks)
          .filter((v) => v != null)
          .map((v) => (Number(v) / x.maxMarks) * 100),
      );
      const lp = lps.filter((l) => l.courseId === a.courseId && l.sectionId === a.sectionId);
      return {
        code: courses.get(a.courseId).code,
        name: courses.get(a.courseId).name,
        att: overallAttendancePct(ss),
        internal: round1(avg(vals)),
        progress: pct(lp.filter((l) => l.status === 'Completed').length, lp.length),
        delayed: lp.filter((l) => l.status === 'Delayed' || (l.status === 'Planned' && l.plannedDate < todayISO())).length,
        faculty: labelOf(db, 'employees', a.facultyId),
      };
    });
    const workload = faculty.map((f) => ({
      name: f.name.replace(/^Dr\. /, ''),
      hours: sum(allocs.filter((a) => a.facultyId === f.id).map((a) => a.hoursPerWeek)),
      max: f.maxWorkload,
    }));
    const risks = studentRisk(students, attendanceStats(sessions), asm, db.invoices, settings);
    const pending = {
      marks: asm.filter((a) => a.status === 'Marks Entered').length,
      files: db.courseFiles.filter((f) => f.departmentId === dept && f.status === 'Pending Review').length,
      questions: db.questions.filter((q) => courses.has(q.courseId) && q.status === 'Pending Review').length,
      leave: db.leaveRequests.filter((l) => l.status === 'Pending' && students.some((s) => s.id === l.studentId)).length,
    };
    return {
      perCourse,
      workload,
      students,
      faculty,
      att: overallAttendancePct(sessions),
      risks,
      pending,
      lpDone: pct(lps.filter((l) => l.status === 'Completed').length, lps.length),
    };
  }, [db, dept, ayId, settings]);
  const high = m.risks.filter((r) => r.level === 'High Risk').length;
  const generate = async () => {
    setBusy(true);
    try {
      const payload = {
        dept: labelOf(db, 'departments', dept),
        attendance: m.att,
        courses: m.perCourse,
        workload: m.workload,
        highRisk: high,
        pending: m.pending,
      };
      const res = await runAi('hod-summary', payload, () => {
        const lowAtt = [...m.perCourse].sort((a, b) => a.att - b.att)[0];
        const lowInt = [...m.perCourse].sort((a, b) => a.internal - b.internal)[0];
        const behind = m.perCourse.filter((c) => c.delayed > 0);
        const over = m.workload.filter((w) => w.hours > w.max);
        const under = m.workload.filter((w) => w.hours < w.max * 0.5);
        return {
          bullets: [
            `Department attendance is ${m.att}% (institutional minimum ${settings.minAttendance}%). Lowest: ${lowAtt?.code} ${lowAtt?.name} at ${lowAtt?.att}%.`,
            `Internal assessment average is lowest in ${lowInt?.code} (${lowInt?.internal}%); consider remedial sessions and a review of question difficulty.`,
            `Syllabus coverage is ${m.lpDone}% of planned topics; ${behind.length} course-section(s) have delayed topics${
              behind.length
                ? ` (e.g. ${behind
                    .slice(0, 3)
                    .map((b) => b.code)
                    .join(', ')})`
                : ''
            }.`,
            over.length
              ? `${over.length} faculty member(s) exceed maximum workload (${over.map((o) => o.name).join(', ')}); rebalance allocations.`
              : under.length
                ? `Workload is within limits; ${under.length} faculty have spare capacity for remedial or project mentoring.`
                : 'Faculty workload is balanced within limits.',
            `${high} student(s) are high risk. Pending: ${m.pending.marks} mark verifications, ${m.pending.files} course files, ${m.pending.questions} questions and ${m.pending.leave} leave requests.`,
          ],
        };
      });
      setOut(res);
      await audit('Generated', 'HOD AI summary', dept);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="AI-Powered HOD Dashboard"
        subtitle="Department performance, attendance, course progress, faculty workload and pending tasks"
      />
      <AiNotice />
      {!scope.departmentId && (
        <Field label="Department" className="mb-16 w-md">
          <Select
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setOut(null);
            }}
          >
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid cols-6 stats">
        <StatCard label="Students" value={m.students.length} icon={Users} />
        <StatCard label="Attendance" value={`${m.att}%`} icon={ClipboardCheck} tone={m.att >= settings.minAttendance ? 'green' : 'amber'} />
        <StatCard label="Syllabus covered" value={`${m.lpDone}%`} icon={NotebookPen} tone="blue" />
        <StatCard label="High-risk students" value={high} icon={Siren} tone="red" />
        <StatCard label="Marks to verify" value={m.pending.marks} icon={FileCheck2} tone="amber" />
        <StatCard label="Other approvals" value={m.pending.files + m.pending.questions + m.pending.leave} icon={Inbox} tone="violet" />
      </div>
      <div className="grid cols-3 mb-16">
        <Card
          title="AI department summary"
          actions={
            <Button size="sm" icon={Wand2} onClick={generate} loading={busy}>
              Generate
            </Button>
          }
        >
          {!out ? (
            <EmptyState title="Generate a summary" message="Summarises the department's performance with evidence from ERP data." />
          ) : (
            <div className="stack tight">
              <AiStatus simulated={out.simulated} />
              <ul className="bullets">
                {out.data.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card title="Attendance & internal average by course" className="span-2">
          <SimpleBar
            data={m.perCourse.map((c) => ({ course: c.code, 'Attendance %': c.att, 'Internal %': c.internal }))}
            x="course"
            bars={[
              { key: 'Attendance %', label: 'Attendance %' },
              { key: 'Internal %', label: 'Internal %' },
            ]}
            unit="%"
            yMax={100}
            height={280}
          />
        </Card>
      </div>
      <div className="grid cols-2">
        <Card title="Course progress" bodyClass="scroll">
          {m.perCourse.length === 0 ? (
            <EmptyState title="No courses" />
          ) : (
            <ul className="meters">
              {m.perCourse
                .sort((a, b) => a.progress - b.progress)
                .map((c) => (
                  <li key={c.code + c.faculty}>
                    <div className="meter-label">
                      <span className="truncate">
                        {c.code} · {c.faculty}
                      </span>
                      <span>
                        {c.progress}%{c.delayed ? <span className="text-amber">· {c.delayed} delayed</span> : null}
                      </span>
                    </div>
                    <ProgressBar value={c.progress} tone={c.delayed ? 'amber' : 'green'} />
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card
          title="Faculty workload"
          actions={
            <Link className="small" to="/academic/allocation">
              Allocation
            </Link>
          }
        >
          <ul className="meters">
            {m.workload.map((w) => (
              <li key={w.name}>
                <div className="meter-label">
                  <span>{w.name}</span>
                  <span className={w.hours > w.max ? 'strong text-red' : ''}>
                    {w.hours}/{w.max} h
                  </span>
                </div>
                <ProgressBar value={(w.hours / Math.max(1, w.max)) * 100} tone={w.hours > w.max ? 'red' : 'navy'} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
