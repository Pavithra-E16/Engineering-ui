import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarPlus, ChevronDown, ChevronRight, Siren, Users, AlertTriangle, ShieldCheck, Wand2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { attendanceStats, studentRisk } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { runAi } from '../../lib/ai';
import { addDays, cn, groupBy, todayISO } from '../../lib/utils';
import { AiNotice, AiStatus } from './common';
export default function EarlyWarning() {
  const { user } = useAuth();
  const { db, ayId, settings, create, notify, can, audit } = useData();
  const scope = useScope();
  const toast = useToast();
  const [dept, setDept] = useState(scope.departmentId ?? '');
  const [level, setLevel] = useState('High Risk');
  const [open, setOpen] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  // faculty see only students in their course-sections
  const students = useMemo(() => {
    let s = scope.students;
    if (scope.role === 'faculty' && scope.myAllocations) {
      const secs = new Set(scope.myAllocations.map((a) => a.sectionId));
      s = s.filter((x) => secs.has(x.sectionId));
    }
    return dept ? s.filter((x) => x.departmentId === dept) : s;
  }, [scope, dept]);
  const att = useMemo(() => attendanceStats(db.attendance.filter((a) => a.academicYearId === ayId)), [db.attendance, ayId]);
  const openFU = useMemo(() => {
    const m = new Map();
    db.mentoringMeetings.filter((x) => x.followUpStatus !== 'Closed').forEach((x) => m.set(x.studentId, (m.get(x.studentId) ?? 0) + 1));
    return m;
  }, [db.mentoringMeetings]);
  const risks = useMemo(
    () =>
      studentRisk(
        students,
        att,
        db.assessments.filter((a) => a.academicYearId === ayId),
        db.invoices,
        settings,
        { openFollowUps: openFU },
      ),
    [students, att, db, ayId, settings, openFU],
  );
  const shown = risks.filter((r) => !level || r.level === level);
  const counts = {
    high: risks.filter((r) => r.level === 'High Risk').length,
    mod: risks.filter((r) => r.level === 'Moderate Risk').length,
  };
  const factorFreq = Object.entries(
    groupBy(
      risks.flatMap((r) => r.factors),
      (f) => f.label,
    ),
  )
    .map(([k, v]) => ({ factor: k, Students: v.length }))
    .sort((a, b) => b.Students - a.Students);
  const byDept = db.departments
    .map((d) => ({
      dept: d.code,
      High: risks.filter((r) => r.student.departmentId === d.id && r.level === 'High Risk').length,
      Moderate: risks.filter((r) => r.student.departmentId === d.id && r.level === 'Moderate Risk').length,
    }))
    .filter((x) => x.High + x.Moderate > 0);
  const generate = async () => {
    setBusy(true);
    try {
      const payload = {
        total: risks.length,
        high: counts.high,
        moderate: counts.mod,
        factors: factorFreq,
        byDept,
        minAttendance: settings.minAttendance,
      };
      const res = await runAi('early-warning-summary', payload, () => {
        const top = factorFreq[0];
        return {
          summary: `${counts.high} of ${risks.length} students (${Math.round((counts.high / Math.max(1, risks.length)) * 100)}%) are flagged high risk and ${counts.mod} moderate risk. ${top ? `The most common indicator is “${top.factor.toLowerCase()}” (${top.Students} students).` : ''} ${byDept.length ? `The highest concentration of high-risk students is in ${[...byDept].sort((a, b) => b.High - a.High)[0].dept}.` : ''} Risk is driven mainly by attendance below ${settings.minAttendance}% combined with weak internal assessment scores.`,
          actions: [
            'Schedule mentor meetings within 7 days for every high-risk student and record follow-ups.',
            `Run remedial / tutorial sessions for courses where internal averages are below 50%.`,
            'Send attendance alerts to parents of students below the threshold.',
            'Review fee-related cases with Finance for instalment or scholarship support.',
            'Re-evaluate risk after CIA-2 marks are entered.',
          ],
        };
      });
      setSummary(res);
      await audit('Generated', 'Early-warning summary');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const followUp = async (r) => {
    try {
      await create(
        'mentoringMeetings',
        {
          mentorId: r.student.mentorId ?? user.employeeId ?? '',
          studentId: r.student.id,
          date: todayISO(),
          mode: 'In-person',
          concerns: `Early-warning flag: ${r.factors.map((f) => f.label).join(', ')}`,
          actionItems: r.actions.join('; '),
          followUpDate: addDays(todayISO(), 7),
          followUpStatus: 'Open',
          confidential: false,
        },
        { audit: 'Created from early warning' },
      );
      toast.success('Mentoring follow-up created.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const alertMentor = async (r) => {
    const mentorUser = db.users.find((u) => u.employeeId === r.student.mentorId);
    await notify({
      ...(mentorUser ? { userId: mentorUser.id } : { role: 'mentor' }),
      title: `Early warning: ${r.student.name}`,
      message: `${r.level} – ${r.factors.map((f) => f.label).join(', ')}`,
      link: `/students/${r.student.id}`,
    });
    toast.success('Mentor notified.');
  };
  return (
    <>
      <PageHeader
        title="AI Student Early-Warning System"
        subtitle="Explainable risk indicators from attendance, assessments, academic progress and follow-ups"
      />
      <AiNotice>
        {' '}
        Risk score = sum of weighted, visible factors (attendance, internal marks, trend, CGPA, fees, open follow-ups); High ≥ 45, Moderate
        ≥ 20.
      </AiNotice>
      <div className="grid cols-4 stats">
        <StatCard label="Students analysed" value={risks.length} icon={Users} />
        <StatCard label="High risk" value={counts.high} icon={Siren} tone="red" onClick={() => setLevel('High Risk')} />
        <StatCard label="Moderate risk" value={counts.mod} icon={AlertTriangle} tone="amber" onClick={() => setLevel('Moderate Risk')} />
        <StatCard
          label="Low risk"
          value={risks.length - counts.high - counts.mod}
          icon={ShieldCheck}
          tone="green"
          onClick={() => setLevel('Low Risk')}
        />
      </div>
      <div className="grid cols-3 mb-16">
        <Card title="Most frequent risk indicators">
          <SimpleBar data={factorFreq.slice(0, 6)} x="factor" bars={[{ key: 'Students', label: 'Students' }]} horizontal height={240} />
        </Card>
        <Card title="Risk by department">
          <SimpleBar
            data={byDept}
            x="dept"
            stacked
            bars={[
              { key: 'High', label: 'High', color: '#e34948' },
              { key: 'Moderate', label: 'Moderate', color: '#eda100' },
            ]}
            height={240}
          />
        </Card>
        <Card
          title="Insight summary"
          actions={
            <Button size="sm" icon={Wand2} onClick={generate} loading={busy}>
              Generate
            </Button>
          }
        >
          {!summary ? (
            <EmptyState title="No summary yet" message="Generate a narrative summary of the current risk picture." />
          ) : (
            <div className="stack tight">
              <AiStatus simulated={summary.simulated} />
              <p>{summary.data.summary}</p>
              <ul className="bullets small">
                {summary.data.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
      <Card
        title="Students needing support"
        subtitle={`${shown.length} shown`}
        bodyClass="p-0"
        actions={
          <>
            {!scope.departmentId && (
              <Select value={dept} onChange={(e) => setDept(e.target.value)} className="input-sm w-sm" aria-label="Department">
                <option value="">All departments</option>
                {db.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </Select>
            )}
            <Select value={level} onChange={(e) => setLevel(e.target.value)} className="input-sm w-sm" aria-label="Risk level">
              <option value="">All levels</option>
              <option>High Risk</option>
              <option>Moderate Risk</option>
              <option>Low Risk</option>
            </Select>
          </>
        }
      >
        {shown.length === 0 ? (
          <EmptyState title="No students at this risk level" />
        ) : (
          <ul className="list">
            {shown.slice(0, 100).map((r) => (
              <li key={r.student.id}>
                <button onClick={() => setOpen(open === r.student.id ? null : r.student.id)} className="risk-row">
                  {open === r.student.id ? <ChevronDown className="icon-16 muted" /> : <ChevronRight className="icon-16 muted" />}
                  <div className="grow">
                    <p className="strong">
                      {r.student.name}{' '}
                      <span className="muted">
                        · {r.student.rollNo} · {labelOf(db, 'departments', r.student.departmentId)} Sem {r.student.semesterNo}
                      </span>
                    </p>
                    <p className="truncate xs muted">{r.factors.map((f) => f.label).join(' · ') || 'No risk indicators'}</p>
                  </div>
                  <span className="xs muted">Score {r.score}</span>
                  <Badge>{r.level}</Badge>
                </button>
                {open === r.student.id && (
                  <div className="risk-detail">
                    <div>
                      <p className="section-label">Why flagged (explainable factors)</p>
                      <ul className="stack tight">
                        {r.factors.map((f) => (
                          <li key={f.label} className="row between nowrap">
                            <span>
                              {f.label} <span className="xs muted">– {f.detail}</span>
                            </span>
                            <span className="xs strong">+{f.weight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="section-label">Suggested support actions</p>
                      <ul className="bullets">
                        {r.actions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                      <div className="row mt-12">
                        <Link to={`/students/${r.student.id}`}>
                          <Button size="sm" variant="secondary">
                            Student 360°
                          </Button>
                        </Link>
                        {can('mentoring', 'edit') && (
                          <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => followUp(r)}>
                            Create follow-up
                          </Button>
                        )}
                        {scope.role !== 'mentor' && (
                          <Button size="sm" variant="secondary" icon={BellRing} onClick={() => alertMentor(r)}>
                            Notify mentor
                          </Button>
                        )}
                      </div>
                      <p className={'mt-8 xs muted'}>Mentor: {labelOf(db, 'employees', r.student.mentorId)}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
