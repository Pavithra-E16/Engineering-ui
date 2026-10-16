import { useMemo, useState } from 'react';
import { CheckCircle2, Download, Link2, Printer, Wand2, XCircle, ShieldCheck, FileWarning, Files } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
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
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  Tabs,
  useConfirm,
  useToast,
} from '../../components/ui';
import { runAi } from '../../lib/ai';
import { pct } from '../../lib/utils';
import { AiNotice, AiStatus } from './common';
const hasDoc = (types) => (db, dept) => {
  const n = db.courseFiles.filter((f) => f.status === 'Approved' && types.includes(f.docType) && (!dept || f.departmentId === dept)).length;
  return { ok: n > 0, detail: n ? `${n} approved document(s)` : `No approved ${types.join(' / ')}` };
};
const CRITERIA = {
  NBA: [
    {
      code: 'NBA C1',
      title: 'Vision, Mission & Program Educational Objectives',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'po',
          label: 'Program outcomes defined',
          check: (db) => ({ ok: db.programOutcomes.length >= 12, detail: `${db.programOutcomes.length} POs/PSOs defined` }),
        },
        {
          id: 'pso',
          label: 'Program-specific outcomes (PSOs)',
          check: (db) => {
            const n = db.programOutcomes.filter((p) => p.kind === 'PSO').length;
            return { ok: n > 0, detail: `${n} PSO(s)` };
          },
        },
      ],
    },
    {
      code: 'NBA C2 – Teaching-Learning',
      title: 'Program Curriculum & Teaching-Learning Process',
      mapsDocTypes: ['Syllabus', 'Lesson Plan', 'Lecture Notes', 'Lab Manual'],
      reqs: [
        {
          id: 'cur',
          label: 'Approved curriculum',
          check: (db) => {
            const n = db.curricula.filter((c) => c.status === 'Approved').length;
            return { ok: n > 0, detail: `${n} approved curriculum version(s)` };
          },
        },
        { id: 'syl', label: 'Syllabus documents', check: hasDoc(['Syllabus']) },
        { id: 'lp', label: 'Lesson plans', check: hasDoc(['Lesson Plan']) },
        { id: 'notes', label: 'Teaching materials', check: hasDoc(['Lecture Notes', 'Lab Manual']) },
      ],
    },
    {
      code: 'NBA C3 – CO & PO Attainment',
      title: 'Course Outcomes & Program Outcomes',
      mapsDocTypes: ['CO Attainment Sheet'],
      reqs: [
        {
          id: 'co',
          label: 'Course outcomes for all active courses',
          check: (db, dept) => {
            const cs = db.courses.filter((c) => db.allocations.some((a) => a.courseId === c.id) && (!dept || c.departmentId === dept));
            const n = cs.filter((c) => db.courseOutcomes.some((o) => o.courseId === c.id)).length;
            return { ok: n === cs.length && n > 0, detail: `${n}/${cs.length} courses have COs` };
          },
        },
        {
          id: 'map',
          label: 'CO–PO articulation matrix',
          check: (db) => ({ ok: db.coPoMaps.length > 0, detail: `${db.coPoMaps.length} mappings` }),
        },
        { id: 'att', label: 'CO attainment sheets', check: hasDoc(['CO Attainment Sheet']) },
        {
          id: 'ind',
          label: 'Indirect assessment (course exit / feedback)',
          check: (db) => ({ ok: db.feedbackResponses.length > 0, detail: `${db.feedbackResponses.length} feedback responses` }),
        },
      ],
    },
    {
      code: 'NBA C4 – Student Performance',
      title: "Students' Performance",
      mapsDocTypes: ['Question Paper', 'Assignment Evidence'],
      reqs: [
        { id: 'qp', label: 'Question papers', check: hasDoc(['Question Paper']) },
        { id: 'asg', label: 'Assignment evidence', check: hasDoc(['Assignment Evidence']) },
        {
          id: 'res',
          label: 'Published results',
          check: (db) => {
            const n = db.resultPublications.filter((r) => r.status === 'Published').length;
            return { ok: n > 0, detail: `${n} published course results` };
          },
        },
        {
          id: 'plc',
          label: 'Placement records',
          check: (db) => {
            const n = db.placementApplications.filter((a) => a.status === 'Selected').length;
            return { ok: n > 0, detail: `${n} offers recorded` };
          },
        },
      ],
    },
    {
      code: 'NBA C5',
      title: 'Faculty Information & Contributions',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'fac',
          label: 'Faculty profiles',
          check: (db, dept) => {
            const n = db.employees.filter((e) => e.category === 'Teaching' && (!dept || e.departmentId === dept)).length;
            return { ok: n > 0, detail: `${n} faculty profiles` };
          },
        },
        {
          id: 'phd',
          label: 'Faculty qualification (Ph.D)',
          check: (db, dept) => {
            const f = db.employees.filter((e) => e.category === 'Teaching' && (!dept || e.departmentId === dept));
            const n = f.filter((e) => e.qualification === 'Ph.D').length;
            return { ok: n / Math.max(1, f.length) >= 0.3, detail: `${n}/${f.length} Ph.D (${pct(n, f.length)}%)` };
          },
        },
      ],
    },
    {
      code: 'NBA C6',
      title: 'Facilities & Technical Support',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'lab',
          label: 'Laboratory register',
          check: (db) => {
            const n = db.rooms.filter((r) => r.type === 'Lab').length;
            return { ok: n > 0, detail: `${n} labs` };
          },
        },
        { id: 'ast', label: 'Asset register', check: (db) => ({ ok: db.assets.length > 0, detail: `${db.assets.length} assets` }) },
      ],
    },
    {
      code: 'NBA C7',
      title: 'Continuous Improvement',
      mapsDocTypes: ['Course Report'],
      reqs: [
        { id: 'rep', label: 'Course end reports / action taken', check: hasDoc(['Course Report']) },
        {
          id: 'mnt',
          label: 'Mentoring records',
          check: (db) => ({ ok: db.mentoringMeetings.length > 0, detail: `${db.mentoringMeetings.length} mentoring records` }),
        },
      ],
    },
  ],
  NAAC: [
    {
      code: 'NAAC C1',
      title: 'Curricular Aspects',
      mapsDocTypes: ['Syllabus'],
      reqs: [
        {
          id: 'cur',
          label: 'Approved curriculum',
          check: (db) => ({
            ok: db.curricula.some((c) => c.status === 'Approved'),
            detail: `${db.curricula.filter((c) => c.status === 'Approved').length} approved`,
          }),
        },
        {
          id: 'fb',
          label: 'Stakeholder feedback on curriculum',
          check: (db) => ({ ok: db.feedbackForms.length > 0, detail: `${db.feedbackForms.length} feedback forms` }),
        },
      ],
    },
    {
      code: 'NAAC C2 – Teaching-Learning & Evaluation',
      title: 'Teaching-Learning & Evaluation',
      mapsDocTypes: ['Lesson Plan', 'Lecture Notes', 'Question Paper', 'CO Attainment Sheet'],
      reqs: [
        { id: 'lp', label: 'Lesson plans', check: hasDoc(['Lesson Plan']) },
        { id: 'qp', label: 'Question papers', check: hasDoc(['Question Paper']) },
        { id: 'att', label: 'Outcome attainment', check: hasDoc(['CO Attainment Sheet']) },
      ],
    },
    {
      code: 'NAAC C3 – Research & Innovation',
      title: 'Research, Innovations & Extension',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'pub',
          label: 'Research publications register',
          check: () => ({ ok: false, detail: 'No research module data — upload evidence as course files with this criterion' }),
        },
      ],
    },
    {
      code: 'NAAC C4',
      title: 'Infrastructure & Learning Resources',
      mapsDocTypes: [],
      reqs: [
        { id: 'lib', label: 'Library resources', check: (db) => ({ ok: db.books.length > 0, detail: `${db.books.length} titles` }) },
        { id: 'ast', label: 'Asset register', check: (db) => ({ ok: db.assets.length > 0, detail: `${db.assets.length} assets` }) },
      ],
    },
    {
      code: 'NAAC C5',
      title: 'Student Support & Progression',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'plc',
          label: 'Placement data',
          check: (db) => ({ ok: db.placementApplications.length > 0, detail: `${db.placementApplications.length} applications` }),
        },
        {
          id: 'alm',
          label: 'Alumni engagement',
          check: (db) => ({
            ok: db.alumni.some((a) => a.engagement && a.engagement !== 'None'),
            detail: `${db.alumni.filter((a) => a.engagement && a.engagement !== 'None').length} engaged alumni`,
          }),
        },
        {
          id: 'grv',
          label: 'Grievance redressal (support tickets)',
          check: (db) => ({ ok: db.tickets.length > 0, detail: `${db.tickets.length} tickets tracked` }),
        },
      ],
    },
    {
      code: 'NAAC C6',
      title: 'Governance, Leadership & Management',
      mapsDocTypes: [],
      reqs: [
        {
          id: 'aud',
          label: 'Audit trail / e-governance',
          check: (db) => ({ ok: db.auditLogs.length > 0, detail: `${db.auditLogs.length} audit entries` }),
        },
        {
          id: 'fin',
          label: 'Financial records',
          check: (db) => ({ ok: db.payments.length > 0, detail: `${db.payments.length} payment records` }),
        },
      ],
    },
    {
      code: 'NAAC C7',
      title: 'Institutional Values & Best Practices',
      mapsDocTypes: [],
      reqs: [
        { id: 'evt', label: 'Institutional events', check: (db) => ({ ok: db.events.length > 0, detail: `${db.events.length} events` }) },
      ],
    },
  ],
};
export default function Accreditation() {
  const { db, can, create, update, audit } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const [fw, setFw] = useState('NBA');
  const [dept, setDept] = useState(scope.departmentId ?? '');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const edit = can('ai-accreditation', 'edit');
  const deptId = dept || null;
  const status = useMemo(
    () =>
      CRITERIA[fw].map((c) => {
        const mapped = db.evidence.filter((e) => e.framework === fw && e.criterion === c.code && (!deptId || e.departmentId === deptId));
        const reqs = c.reqs.map((r) => ({
          ...r,
          ...r.check(
            db,
            deptId,
            mapped.map((m) => m.id),
          ),
        }));
        return { ...c, mapped, reqs, score: pct(reqs.filter((r) => r.ok).length, reqs.length) };
      }),
    [fw, db, deptId],
  );
  const overall = Math.round(status.reduce((t, s) => t + s.score, 0) / Math.max(1, status.length));
  const missing = status.flatMap((s) =>
    s.reqs.filter((r) => !r.ok).map((r) => ({ id: s.code + r.id, criterion: s.code, item: r.label, detail: r.detail })),
  );
  const unmapped = db.courseFiles.filter(
    (f) =>
      f.status === 'Approved' &&
      (!deptId || f.departmentId === deptId) &&
      !db.evidence.some((e) => e.courseFileId === f.id && e.framework === fw) &&
      CRITERIA[fw].some((c) => c.mapsDocTypes.includes(f.docType)),
  );
  const autoMap = async () => {
    if (
      !(await confirm({
        title: 'Auto-map course files?',
        message: `${unmapped.length} approved course file(s) will be mapped to ${fw} criteria based on document type. Mappings are marked "Mapped" until verified by the accreditation team.`,
        confirmLabel: 'Map evidence',
        tone: 'primary',
      }))
    )
      return;
    try {
      for (const f of unmapped) {
        const c = CRITERIA[fw].find((x) => x.mapsDocTypes.includes(f.docType));
        await create(
          'evidence',
          { framework: fw, criterion: c.code, title: f.title, courseFileId: f.id, departmentId: f.departmentId, status: 'Mapped' },
          { audit: false },
        );
      }
      await audit('Auto-mapped', 'Accreditation evidence', undefined, `${unmapped.length} files → ${fw}`);
      toast.success(`${unmapped.length} document(s) mapped.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const generate = async () => {
    setBusy(true);
    try {
      const res = await runAi(
        'accreditation-report',
        {
          framework: fw,
          department: deptId ? labelOf(db, 'departments', deptId) : 'Institution',
          status: status.map((s) => ({
            code: s.code,
            score: s.score,
            reqs: s.reqs.map((r) => ({ label: r.label, ok: r.ok, detail: r.detail })),
            evidence: s.mapped.length,
          })),
        },
        () => {
          const lines = [
            `DRAFT ${fw} SELF-ASSESSMENT / ACADEMIC AUDIT REPORT`,
            `Scope: ${deptId ? labelOf(db, 'departments', deptId) : 'Whole institution'}   Prepared: ${new Date().toLocaleDateString('en-IN')}`,
            `Overall evidence readiness: ${overall}%`,
            '',
          ];
          status.forEach((s) => {
            lines.push(`${s.code} — ${s.title}  [readiness ${s.score}%]`);
            lines.push(`  Evidence mapped: ${s.mapped.length} document(s).`);
            s.reqs.forEach((r) => lines.push(`  ${r.ok ? '✔' : '✘'} ${r.label}: ${r.detail}`));
            const gaps = s.reqs.filter((r) => !r.ok);
            lines.push(
              gaps.length
                ? `  Action required: obtain ${gaps.map((g) => g.label.toLowerCase()).join('; ')}.`
                : '  Status: requirements satisfied based on ERP records.',
            );
            lines.push('');
          });
          lines.push(
            'NOTE: This is a simulated draft assembled from ERP records using rules. It must be reviewed and edited by the accreditation team before submission.',
          );
          return { report: lines.join('\n') };
        },
      );
      setReport(res);
      await audit('Generated', 'Accreditation draft report', undefined, fw);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!report) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report.data.report], { type: 'text/plain' }));
    a.download = `${fw}-draft-audit-report.txt`;
    a.click();
  };
  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w || !report) return;
    w.document.write(
      `<pre style="font-family:Inter,Segoe UI,sans-serif;white-space:pre-wrap;padding:24px">${report.data.report.replace(/</g, '&lt;')}</pre><script>window.print()</script>`,
    );
    w.document.close();
  };
  return (
    <>
      <PageHeader
        title="AI Accreditation & Academic Audit Assistant"
        subtitle="Organise evidence, map documents to criteria, identify gaps and prepare draft audit reports"
      />
      <AiNotice> Criteria checks and gap detection are rule-based over ERP records.</AiNotice>
      <div className="filter-bar">
        <Tabs
          tabs={[
            { id: 'NBA', label: 'NBA' },
            { id: 'NAAC', label: 'NAAC' },
          ]}
          value={fw}
          onChange={(v) => {
            setFw(v);
            setReport(null);
          }}
        />
        {!scope.departmentId && (
          <Field label="Scope" className="w-md">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">Whole institution</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="grid cols-4 stats">
        <StatCard label="Evidence readiness" value={`${overall}%`} icon={ShieldCheck} tone={overall >= 80 ? 'green' : 'amber'} />
        <StatCard label="Mapped documents" value={status.reduce((t, s) => t + s.mapped.length, 0)} icon={Files} tone="blue" />
        <StatCard label="Missing evidence items" value={missing.length} icon={FileWarning} tone="red" />
        <StatCard label="Unmapped approved files" value={unmapped.length} icon={Link2} tone="violet" />
      </div>
      <UrlTabs
        tabs={[
          { id: 'criteria', label: 'Criteria status' },
          { id: 'missing', label: 'Missing evidence', count: missing.length },
          { id: 'evidence', label: 'Evidence register' },
          { id: 'report', label: 'Draft report' },
        ]}
      >
        {(t) =>
          t === 'criteria' ? (
            <>
              {edit && unmapped.length > 0 && (
                <div className="callout">
                  <span>
                    {unmapped.length} approved course files can be mapped automatically to {fw} criteria.
                  </span>
                  <Button size="sm" icon={Link2} onClick={autoMap}>
                    Auto-map evidence
                  </Button>
                </div>
              )}
              <div className="grid cols-2">
                {status.map((s) => (
                  <Card
                    key={s.code}
                    title={s.code}
                    subtitle={s.title}
                    actions={<Badge tone={s.score === 100 ? 'green' : s.score >= 50 ? 'amber' : 'red'}>{s.score}%</Badge>}
                  >
                    <ProgressBar value={s.score} tone={s.score === 100 ? 'green' : s.score >= 50 ? 'amber' : 'red'} />
                    <ul className="stack tight mt-12">
                      {s.reqs.map((r) => (
                        <li key={r.id} className="criteria-item">
                          {r.ok ? <CheckCircle2 className="ok-icon" /> : <XCircle className="bad-icon" />}
                          <span>
                            <span>{r.label}</span> <span className="xs muted">— {r.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-8 xs muted">{s.mapped.length} mapped evidence document(s)</p>
                  </Card>
                ))}
              </div>
            </>
          ) : t === 'missing' ? (
            missing.length === 0 ? (
              <Alert tone="success">No missing evidence detected for the configured criteria.</Alert>
            ) : (
              <DataTable
                title={`${fw} missing evidence`}
                rows={missing}
                columns={[
                  { key: 'criterion', header: 'Criterion' },
                  { key: 'item', header: 'Required evidence' },
                  { key: 'detail', header: 'Finding' },
                ]}
              />
            )
          ) : t === 'evidence' ? (
            <DataTable
              title="Evidence register"
              rows={db.evidence.filter((e) => e.framework === fw && (!deptId || e.departmentId === deptId))}
              columns={[
                { key: 'criterion', header: 'Criterion' },
                { key: 'title', header: 'Document' },
                { key: 'dept', header: 'Dept', value: (r) => labelOf(db, 'departments', r.departmentId) },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
              actions={
                edit
                  ? (r) =>
                      r.status === 'Mapped' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={CheckCircle2}
                          className="text-green"
                          onClick={async () => {
                            await update('evidence', r.id, { status: 'Verified' }, { audit: 'Verified' });
                            toast.success('Evidence verified.');
                          }}
                        >
                          Verify
                        </Button>
                      ) : null
                  : undefined
              }
            />
          ) : (
            <Card
              title="Draft audit report"
              actions={
                <>
                  <Button size="sm" icon={Wand2} onClick={generate} loading={busy}>
                    Generate draft
                  </Button>
                  {report && (
                    <>
                      <Button size="sm" variant="secondary" icon={Download} onClick={download}>
                        Download
                      </Button>
                      <Button size="sm" variant="secondary" icon={Printer} onClick={printReport}>
                        Print
                      </Button>
                    </>
                  )}
                </>
              }
            >
              {!report ? (
                <EmptyState title="No draft yet" message="Generate a draft self-assessment report from mapped evidence and gaps." />
              ) : (
                <>
                  <AiStatus simulated={report.simulated} />
                  <pre className="pre">{report.data.report}</pre>
                </>
              )}
            </Card>
          )
        }
      </UrlTabs>
    </>
  );
}
