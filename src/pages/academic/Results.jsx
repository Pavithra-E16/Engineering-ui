import { useMemo, useState } from 'react';
import { BadgeCheck, Send, Lock } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { computeResults } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, useConfirm, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { avg, pct, round1, sum } from '../../lib/utils';
import { Award, Percent, TrendingUp, Users } from 'lucide-react';
function StudentResults() {
  const { db, settings } = useData();
  const scope = useScope();
  const sid = scope.linked[0];
  const published = db.resultPublications.filter((p) => p.status === 'Published');
  const byAy = useMemo(() => {
    const out = {};
    published.forEach((p) => {
      const list = db.assessments.filter((a) => a.courseId === p.courseId && a.sectionId === p.sectionId && a.studentIds.includes(sid));
      if (!list.length) return;
      const r = computeResults(list, settings).find((x) => x.studentId === sid);
      const c = db.courses.find((x) => x.id === p.courseId);
      if (!r || !c) return;
      (out[p.academicYearId] ||= []).push({
        course: c.name,
        code: c.code,
        credits: c.credits,
        total: r.total,
        grade: r.grade,
        points: r.points,
        pass: r.pass,
      });
    });
    return out;
  }, [published, db, settings, sid]);
  const ays = Object.keys(byAy);
  if (!ays.length)
    return (
      <EmptyState
        icon={Lock}
        title="No published results yet"
        message="Results become visible here after the Examination Cell publishes them."
      />
    );
  return (
    <div className="stack">
      {ays.map((ay) => {
        const rows = byAy[ay];
        const sgpa = sum(rows.map((r) => r.points * r.credits)) / Math.max(1, sum(rows.map((r) => r.credits)));
        return (
          <Card
            key={ay}
            title={`AY ${labelOf(db, 'academicYears', ay)}`}
            actions={
              <span>
                SGPA <b className="big-number">{sgpa.toFixed(2)}</b>
              </span>
            }
            bodyClass="p-0"
          >
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th className="text-right">Credits</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Grade</th>
                  <th className="text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td className="mono">{r.code}</td>
                    <td>{r.course}</td>
                    <td className="text-right">{r.credits}</td>
                    <td className="text-right">{r.total}</td>
                    <td className="text-center strong">{r.grade}</td>
                    <td className="text-center">
                      <Badge tone={r.pass ? 'green' : 'red'}>{r.pass ? 'Pass' : 'Fail'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
export default function Results() {
  const { user } = useAuth();
  const { db, ayId, settings, can, update, create, notify } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const css = db.allocations.filter((a) => a.academicYearId === ayId && scope.csAllowed(a.courseId, a.sectionId));
  const [cs, setCs] = useState(css[0] ? `${css[0].courseId}|${css[0].sectionId}` : '');
  const [cid, sid] = cs.split('|');
  const list = db.assessments.filter((a) => a.courseId === cid && a.sectionId === sid && a.academicYearId === ayId);
  const results = useMemo(() => computeResults(list, settings), [list, settings]);
  const pub = db.resultPublications.find((p) => p.courseId === cid && p.sectionId === sid && p.academicYearId === ayId);
  const status = pub?.status ?? 'Draft';
  const canVerify = can('results', 'edit') && ['hod', 'exam-cell'].includes(user.role);
  const canPublish = can('results', 'edit') && ['exam-cell', 'principal'].includes(user.role);
  const complete = results.length > 0 && results.every((r) => r.complete);
  const unverified = list.filter((a) => a.status !== 'Verified').length;
  if (scope.personal)
    return (
      <>
        <PageHeader title="Results" subtitle="Published semester results and grades" />
        <StudentResults />
      </>
    );
  const setStatus = async (s) => {
    if (s === 'Published' && (!complete || unverified)) {
      toast.error('All assessments must be complete and verified before publishing.');
      return;
    }
    const ok = await confirm({
      title: s === 'Published' ? 'Publish results?' : 'Verify results?',
      message:
        s === 'Published'
          ? 'Published results become visible to students and parents. This action is recorded in the audit log.'
          : 'Confirm that the computed results have been checked.',
      confirmLabel: s === 'Published' ? 'Publish' : 'Verify',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      const patch =
        s === 'Published'
          ? { status: s, publishedBy: user.name, publishedAt: new Date().toISOString() }
          : { status: s, verifiedBy: user.name };
      if (pub) await update('resultPublications', pub.id, patch, { audit: s, details: labelOf(db, 'courses', cid) });
      else await create('resultPublications', { academicYearId: ayId, courseId: cid, sectionId: sid, ...patch }, { audit: s });
      if (s === 'Published') {
        await notify({
          role: 'student',
          title: 'Results published',
          message: `Results for ${labelOf(db, 'courses', cid)} are now available.`,
          link: '/academic/results',
        });
        await notify({
          role: 'parent',
          title: 'Results published',
          message: `Results for ${labelOf(db, 'courses', cid)} are now available.`,
          link: '/academic/results',
        });
      }
      toast.success(`Results ${s.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const dist = settings.gradeRules.map((g) => ({ grade: g.grade, Students: results.filter((r) => r.grade === g.grade).length }));
  const totals = results.map((r) => r.total ?? 0);
  return (
    <>
      <PageHeader
        title="Results Management"
        subtitle="Computed with configurable weights and grading rules · publish only through authorised users"
      />
      <div className="filter-bar">
        <Field label="Course · Section" className="w-lg">
          <Select value={cs} onChange={(e) => setCs(e.target.value)}>
            {css.map((a) => (
              <option key={a.id} value={`${a.courseId}|${a.sectionId}`}>
                {labelOf(db, 'courses', a.courseId)} · {labelOf(db, 'sections', a.sectionId)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="row">
          <span className="muted">Status:</span>
          <Badge>{status}</Badge>
          {canVerify && status === 'Draft' && (
            <Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => setStatus('Verified')} disabled={!results.length}>
              Verify
            </Button>
          )}
          {canPublish && status !== 'Published' && (
            <Button size="sm" icon={Send} onClick={() => setStatus('Published')} disabled={!results.length}>
              Publish
            </Button>
          )}
        </div>
      </div>
      {!complete && results.length > 0 && (
        <div className="mb-12">
          <Alert tone="info">
            Some components (e.g. CIA-2 or end-semester exam) are not yet entered. Results are provisional and graded as “Pending” until
            complete.
          </Alert>
        </div>
      )}
      {unverified > 0 && (
        <div className="mb-12">
          <Alert tone="warning">{unverified} assessment(s) for this course-section are not yet verified.</Alert>
        </div>
      )}
      {!results.length ? (
        <EmptyState title="No assessments for this course-section" />
      ) : (
        <>
          <div className="grid cols-4 stats">
            <StatCard label="Students" value={results.length} icon={Users} />
            <StatCard
              label="Pass %"
              value={complete ? `${pct(results.filter((r) => r.pass).length, results.length)}%` : '—'}
              icon={Percent}
              tone="green"
            />
            <StatCard label="Class average" value={round1(avg(totals))} icon={TrendingUp} tone="blue" />
            <StatCard label="Highest" value={Math.max(...totals)} icon={Award} tone="violet" />
          </div>
          <div className="grid cols-3 mb-16">
            <Card title="Grade distribution">
              <SimpleBar data={dist} x="grade" bars={[{ key: 'Students', label: 'Students' }]} height={220} />
            </Card>
            <Card title="Grading rules" className="span-2">
              <div className="row">
                {[...settings.gradeRules]
                  .sort((a, b) => b.min - a.min)
                  .map((g) => (
                    <span key={g.grade} className="chip">
                      <b>{g.grade}</b> ≥ {g.min} · {g.points} pts
                    </span>
                  ))}
              </div>
              <p className="mt-12 xs muted">
                Weights:{' '}
                {Object.entries(settings.assessmentWeights)
                  .map(([k, v]) => `${k} ${v}%`)
                  .join(' · ')}{' '}
                · Pass mark {settings.passMarks}. Change in Settings.
              </p>
            </Card>
          </div>
          <DataTable
            title={`Results ${labelOf(db, 'courses', cid)}`}
            rows={results.map((r) => ({ ...r, id: r.studentId, s: db.students.find((x) => x.id === r.studentId) }))}
            initialSort={{ key: 'roll', dir: 'asc' }}
            filters={[
              {
                key: 'grade',
                label: 'Grade',
                options: [...settings.gradeRules.map((g) => g.grade), 'Pending'].map((g) => ({ value: g, label: g })),
                match: (r, v) => r.grade === v,
              },
            ]}
            columns={[
              { key: 'roll', header: 'Roll no', value: (r) => r.s?.rollNo },
              { key: 'name', header: 'Student', value: (r) => r.s?.name },
              ...Object.keys(settings.assessmentWeights).map((t) => ({ key: t, header: t, value: (r) => r.components[t] ?? '—' })),
              { key: 'total', header: 'Total', value: (r) => r.total ?? '' },
              { key: 'grade', header: 'Grade', render: (r) => <b>{r.grade}</b>, value: (r) => r.grade },
              {
                key: 'res',
                header: 'Result',
                value: (r) => (!r.complete ? 'Pending' : r.pass ? 'Pass' : 'Fail'),
                render: (r) => (
                  <Badge tone={!r.complete ? 'slate' : r.pass ? 'green' : 'red'}>
                    {!r.complete ? 'Pending' : r.pass ? 'Pass' : 'Fail'}
                  </Badge>
                ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
