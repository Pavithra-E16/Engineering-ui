import { useMemo, useState } from 'react';
import { Wand2, TrendingUp, Lightbulb } from 'lucide-react';
import { useData } from '../../data/store';
import { attendanceStats, computeResults, overallAttendancePct, studentRisk } from '../../data/analytics';
import { DataTable } from '../../components/DataTable';
import { Badge, Button, Card, EmptyState, PageHeader, useToast } from '../../components/ui';
import { SimpleBar, SimpleLine } from '../../components/charts';
import { runAi } from '../../lib/ai';
import { avg, groupBy, pct, round1, sum } from '../../lib/utils';
import { AiNotice, AiStatus } from './common';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export default function DecisionSupport() {
  const { db, ayId, settings, audit } = useData();
  const toast = useToast();
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const kpis = useMemo(() => {
    const att = attendanceStats(db.attendance.filter((a) => a.academicYearId === ayId));
    const asm = db.assessments.filter((a) => a.academicYearId === ayId);
    const risks = studentRisk(
      db.students.filter((s) => s.active !== false),
      att,
      asm,
      db.invoices,
      settings,
    );
    const published = db.resultPublications.filter((p) => p.status === 'Published');
    const placedSet = new Set(db.placementApplications.filter((a) => a.status === 'Selected').map((a) => a.studentId));
    return db.departments.map((d) => {
      const cids = new Set(db.courses.filter((c) => c.departmentId === d.id).map((c) => c.id));
      const studs = db.students.filter((s) => s.departmentId === d.id && s.active !== false);
      const fac = db.employees.filter((e) => e.departmentId === d.id && e.category === 'Teaching' && e.active !== false);
      const sessions = db.attendance.filter((s) => s.academicYearId === ayId && cids.has(s.courseId));
      const vals = asm
        .filter((a) => cids.has(a.courseId))
        .flatMap((a) =>
          Object.values(a.marks)
            .filter((v) => v != null)
            .map((v) => (Number(v) / a.maxMarks) * 100),
        );
      const res = published
        .filter((p) => cids.has(p.courseId))
        .flatMap((p) =>
          computeResults(
            db.assessments.filter((a) => a.courseId === p.courseId && a.sectionId === p.sectionId),
            settings,
          ),
        );
      const fy = studs.filter((s) => s.semesterNo === 7);
      const inv = db.invoices.filter((i) => studs.some((s) => s.id === i.studentId));
      const lps = db.lessonPlans.filter((l) => l.academicYearId === ayId && cids.has(l.courseId));
      return {
        id: d.id,
        dept: d.code,
        students: studs.length,
        sfr: round1(studs.length / Math.max(1, fac.length)),
        attendance: overallAttendancePct(sessions),
        internal: round1(avg(vals)),
        pass: pct(res.filter((r) => r.pass).length, res.length),
        placement: pct(fy.filter((s) => placedSet.has(s.id)).length, fy.length),
        fees: pct(sum(inv.map((i) => i.paid)), sum(inv.map((i) => i.amount))),
        highRisk: risks.filter((r) => r.student.departmentId === d.id && r.level === 'High Risk').length,
        syllabus: pct(lps.filter((l) => l.status === 'Completed').length, lps.length),
        phd: pct(fac.filter((f) => f.qualification === 'Ph.D').length, fac.length),
      };
    });
  }, [db, ayId, settings]);
  const inst = {
    attendance: round1(avg(kpis.map((k) => k.attendance))),
    internal: round1(avg(kpis.map((k) => k.internal))),
    pass: round1(avg(kpis.map((k) => k.pass))),
    placement: round1(avg(kpis.map((k) => k.placement))),
    fees: round1(avg(kpis.map((k) => k.fees))),
    highRisk: sum(kpis.map((k) => k.highRisk)),
  };
  const trend = (() => {
    const g = groupBy(
      db.attendance.filter((a) => a.academicYearId === ayId),
      (s) => s.date.slice(0, 7),
    );
    return Object.keys(g)
      .sort()
      .map((k) => ({ month: MONTHS[Number(k.slice(5)) - 1], Attendance: overallAttendancePct(g[k]) }));
  })();
  const generate = async () => {
    setBusy(true);
    try {
      const res = await runAi('decision-support', { institution: inst, departments: kpis, trend }, () => {
        const by = (k) => [...kpis].sort((a, b) => a[k] - b[k]);
        const lowAtt = by('attendance')[0],
          hiAtt = by('attendance').slice(-1)[0];
        const lowPl = by('placement')[0],
          lowFee = by('fees')[0],
          hiRisk = by('highRisk').slice(-1)[0],
          hiSfr = by('sfr').slice(-1)[0];
        const tr = trend.length > 1 ? round1(trend[trend.length - 1].Attendance - trend[0].Attendance) : 0;
        return {
          insights: [
            `Institutional attendance averages ${inst.attendance}% and has ${tr >= 0 ? 'risen' : 'fallen'} by ${Math.abs(tr)} points since the start of term.`,
            `${hiAtt.dept} leads attendance (${hiAtt.attendance}%); ${lowAtt.dept} trails at ${lowAtt.attendance}%.`,
            `Placement among final-year students averages ${inst.placement}%; ${lowPl.dept} is lowest at ${lowPl.placement}%.`,
            `Fee collection is ${inst.fees}% overall; ${lowFee.dept} has the lowest collection (${lowFee.fees}%).`,
            `${inst.highRisk} students are high risk, with the most in ${hiRisk.dept} (${hiRisk.highRisk}).`,
          ],
          recommendations: [
            `Target attendance interventions in ${lowAtt.dept}: weekly mentor reviews and parent alerts for students below ${settings.minAttendance}%.`,
            `Strengthen training and industry tie-ups for ${lowPl.dept} (aptitude, domain certifications, core-company drives).`,
            `Review fee follow-up and scholarship processing for ${lowFee.dept} students with Finance.`,
            hiSfr.sfr > 20
              ? `Student–faculty ratio in ${hiSfr.dept} is ${hiSfr.sfr}:1 — consider additional faculty recruitment to meet the 20:1 norm.`
              : 'Student–faculty ratios are within the 20:1 norm across departments.',
            'Re-run this analysis after CIA-2 and end-semester results to measure the impact of interventions.',
          ],
        };
      });
      setOut(res);
      await audit('Generated', 'Decision support analysis');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const tone = (v, good, ok) => (v >= good ? 'green' : v >= ok ? 'amber' : 'red');
  return (
    <>
      <PageHeader
        title="AI Institutional Decision Support"
        subtitle="Institutional KPIs, department comparison, trends and evidence-based recommendations"
      />
      <AiNotice />
      <div className="grid cols-6 stats">
        {[
          ['Attendance', `${inst.attendance}%`],
          ['Internal avg', `${inst.internal}%`],
          ['Pass % (prev.)', `${inst.pass}%`],
          ['Placement', `${inst.placement}%`],
          ['Fee collection', `${inst.fees}%`],
          ['High-risk students', inst.highRisk],
        ].map(([l, v]) => (
          <div key={l} className="stat">
            <p className="xs muted">{l}</p>
            <p className="stat-value">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid cols-3 mb-16">
        <Card title="Department comparison" subtitle="Attendance, internal average, placement" className="span-2">
          <SimpleBar
            data={kpis.map((k) => ({ dept: k.dept, Attendance: k.attendance, Internal: k.internal, Placement: k.placement }))}
            x="dept"
            bars={[
              { key: 'Attendance', label: 'Attendance %' },
              { key: 'Internal', label: 'Internal %' },
              { key: 'Placement', label: 'Placement %' },
            ]}
            unit="%"
            yMax={100}
            height={280}
          />
        </Card>
        <Card title="Attendance trend">
          <SimpleLine
            data={trend}
            x="month"
            lines={[{ key: 'Attendance', label: 'Attendance %' }]}
            unit="%"
            yDomain={[60, 100]}
            height={280}
          />
        </Card>
      </div>
      <Card
        title="Insights & recommendations"
        className="mb-16"
        actions={
          <Button size="sm" icon={Wand2} onClick={generate} loading={busy}>
            Analyse
          </Button>
        }
      >
        {!out ? (
          <EmptyState
            title="Run the analysis"
            message="Identifies trends, compares departments and recommends actions with supporting evidence."
          />
        ) : (
          <>
            <AiStatus simulated={out.simulated} />
            <div className="grid cols-2 mt-12">
              <div>
                <p className="row strong mb-8">
                  <TrendingUp className="icon-16" />
                  Key insights
                </p>
                <ul className="bullets">
                  {out.data.insights.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="row strong mb-8">
                  <Lightbulb className="icon-16 text-amber" />
                  Recommendations
                </p>
                <ol className="bullets">
                  {out.data.recommendations.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </Card>
      <DataTable
        title="Department KPI scorecard"
        rows={kpis}
        hideExport={false}
        columns={[
          { key: 'dept', header: 'Dept' },
          { key: 'students', header: 'Students' },
          { key: 'sfr', header: 'SFR' },
          {
            key: 'attendance',
            header: 'Attendance %',
            render: (r) => <Badge tone={tone(r.attendance, 85, settings.minAttendance)}>{r.attendance}</Badge>,
          },
          { key: 'internal', header: 'Internal %', render: (r) => <Badge tone={tone(r.internal, 65, 50)}>{r.internal}</Badge> },
          { key: 'pass', header: 'Pass %', render: (r) => <Badge tone={tone(r.pass, 90, 75)}>{r.pass}</Badge> },
          { key: 'placement', header: 'Placement %', render: (r) => <Badge tone={tone(r.placement, 70, 50)}>{r.placement}</Badge> },
          { key: 'fees', header: 'Fees %', render: (r) => <Badge tone={tone(r.fees, 85, 70)}>{r.fees}</Badge> },
          { key: 'syllabus', header: 'Syllabus %' },
          { key: 'phd', header: 'Ph.D %' },
          { key: 'highRisk', header: 'High risk' },
        ]}
      />
    </>
  );
}
