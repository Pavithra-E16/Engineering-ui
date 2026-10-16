import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Award, BedDouble, Briefcase, Bus, ClipboardCheck, GraduationCap, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../data/store';
import { useScope } from '../data/scope';
import { attendanceStats, internalPercent, studentRisk } from '../data/analytics';
import { labelOf } from '../data/labels';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from '../components/ui';
import { fmtDate, fmtMoney, sum } from '../lib/utils';
import { ForbiddenPage } from './Errors';
export default function Student360() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { db, ayId, settings, can } = useData();
  const scope = useScope();
  const s = db.students.find((x) => x.id === id);
  const allowed =
    !!s &&
    scope.studentAllowed(id) &&
    (can('mentoring') || can('attendance') || can('admissions') || can('academic-structure') || can('results') || scope.personal);
  const data = useMemo(() => {
    if (!s) return null;
    const sessions = db.attendance.filter((a) => a.academicYearId === ayId && a.studentIds.includes(s.id));
    const byCourse = attendanceStats(
      sessions.map((x) => ({ ...x, marks: { [s.id]: x.marks[s.id] } })),
      (x) => x.courseId,
    );
    const overall = attendanceStats(sessions).get(s.id);
    const asm = db.assessments.filter((a) => a.academicYearId === ayId && a.studentIds.includes(s.id));
    const risk = studentRisk([s], attendanceStats(sessions), asm, db.invoices, settings)[0];
    const inv = db.invoices.filter((i) => i.studentId === s.id && i.status !== 'Cancelled');
    return { byCourse, overall, asm, risk, due: sum(inv.map((i) => i.amount - i.paid)), internal: internalPercent(asm, s.id) };
  }, [s, db, ayId, settings]);
  if (!allowed || !s || !data) return <ForbiddenPage />;
  const confidentialOK = (m) => !m.confidential || ['hod', 'principal'].includes(user.role) || m.mentorId === user.employeeId;
  const meetings = db.mentoringMeetings
    .filter((m) => m.studentId === s.id && confidentialOK(m))
    .sort((a, b) => b.date.localeCompare(a.date));
  const hostel = db.hostelAllocations.find((a) => a.studentId === s.id && a.status === 'Allocated');
  const transport = db.transportAllocations.find((a) => a.studentId === s.id && a.status === 'Active');
  const apps = db.placementApplications.filter((a) => a.studentId === s.id);
  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={`${s.rollNo} · ${labelOf(db, 'programs', s.programId)} · ${labelOf(db, 'sections', s.sectionId)} · Batch ${s.batch}`}
        actions={<Badge>{data.risk.level}</Badge>}
      />
      <div className="grid cols-4 stats">
        <StatCard
          label="Attendance"
          value={`${data.overall?.pct ?? 0}%`}
          icon={ClipboardCheck}
          tone={(data.overall?.pct ?? 0) >= settings.minAttendance ? 'green' : 'red'}
        />
        <StatCard label="Internal avg" value={data.internal !== null ? `${data.internal}%` : '—'} icon={Award} tone="blue" />
        <StatCard label="CGPA" value={s.cgpa ?? '—'} icon={GraduationCap} tone="violet" />
        <StatCard label="Fee due" value={fmtMoney(data.due)} icon={Wallet} tone={data.due ? 'amber' : 'green'} />
      </div>
      <div className="grid cols-3">
        <Card title="Profile">
          <dl className="stack tight">
            {[
              ['Email', s.email],
              ['Phone', s.phone],
              ['Gender', s.gender],
              ['Date of birth', fmtDate(s.dob)],
              ['Category', s.category],
              ['Parent / guardian', `${s.parentName} · ${s.parentPhone}`],
              ['Mentor', labelOf(db, 'employees', s.mentorId)],
              ['Status', s.status],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Attendance by course">
          <ul className="meters">
            {[...data.byCourse.entries()].map(([cid, v]) => (
              <li key={cid}>
                <div className="meter-label">
                  <span className="truncate">{labelOf(db, 'courses', cid)}</span>
                  <span>{v.pct}%</span>
                </div>
                <ProgressBar value={v.pct} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Risk indicators">
          {data.risk.factors.length === 0 ? (
            <p className="text-green">No risk indicators.</p>
          ) : (
            <ul className="stack tight">
              {data.risk.factors.map((f) => (
                <li key={f.label}>
                  <b>{f.label}</b> <span className="xs muted">— {f.detail}</span>
                </li>
              ))}
            </ul>
          )}
          {data.risk.actions.length > 0 && (
            <ul className="bullets small mt-12">
              {data.risk.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid cols-2 mt-16">
        <Card title="Assessment marks" bodyClass="scroll">
          <table className="simple-table">
            <tbody>
              {data.asm
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((a) => (
                  <tr key={a.id}>
                    <td>{db.courses.find((c) => c.id === a.courseId)?.code}</td>
                    <td>{a.name}</td>
                    <td className="text-right strong">
                      {a.marks[s.id] ?? '—'}/{a.maxMarks}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
        <Card title="Mentoring history" bodyClass="scroll">
          {meetings.length === 0 ? (
            <EmptyState title="No mentoring records" />
          ) : (
            <ul className="list">
              {meetings.map((m) => (
                <li key={m.id}>
                  <div className="row between nowrap">
                    <span className="strong">
                      {fmtDate(m.date)} · {m.mode}
                    </span>
                    <Badge>{m.followUpStatus}</Badge>
                  </div>
                  <p className="muted">{m.concerns}</p>
                  <p className="xs muted">{m.actionItems}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid cols-3 mt-16">
        <Card
          title={
            <span className="row">
              <BedDouble className="icon-16" />
              Hostel
            </span>
          }
        >
          <p>{hostel ? `${labelOf(db, 'hostelRooms', hostel.roomId)} since ${fmtDate(hostel.fromDate)}` : 'Day scholar'}</p>
        </Card>
        <Card
          title={
            <span className="row">
              <Bus className="icon-16" />
              Transport
            </span>
          }
        >
          <p>{transport ? `${labelOf(db, 'routes', transport.routeId)} · ${transport.stop}` : 'Not registered'}</p>
        </Card>
        <Card
          title={
            <span className="row">
              <Briefcase className="icon-16" />
              Placements
            </span>
          }
        >
          {apps.length ? (
            <ul className="stack tight">
              {apps.map((a) => (
                <li key={a.id} className="row between nowrap">
                  <span className="truncate">{labelOf(db, 'drives', a.driveId)}</span>
                  <Badge>{a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No applications</p>
          )}
        </Card>
      </div>
    </>
  );
}
