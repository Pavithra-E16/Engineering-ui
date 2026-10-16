import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { coAttainment, poAttainment } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { avg, cn, round1 } from '../../lib/utils';
function useCoursePicker() {
  const { db, ayId } = useData();
  const scope = useScope();
  const courses = useMemo(
    () =>
      db.courses
        .filter(
          (c) =>
            scope.courseAllowed(c.id) &&
            db.courseOutcomes.some((o) => o.courseId === c.id) &&
            db.allocations.some((a) => a.courseId === c.id && a.academicYearId === ayId),
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [db, scope, ayId],
  );
  const [cid, setCid] = useState(courses[0]?.id ?? '');
  const picker = (
    <Field label="Course" className="mb-16 w-lg">
      <Select value={cid} onChange={(e) => setCid(e.target.value)}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} – {c.name}
          </option>
        ))}
      </Select>
    </Field>
  );
  return { cid, picker, courses };
}
function Matrix() {
  const { db, can, create, update, remove, audit } = useData();
  const toast = useToast();
  const { cid, picker } = useCoursePicker();
  const cos = db.courseOutcomes.filter((c) => c.courseId === cid).sort((a, b) => a.code.localeCompare(b.code));
  const pos = db.programOutcomes
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.kind === b.kind ? Number(a.code.replace(/\D/g, '')) - Number(b.code.replace(/\D/g, '')) : a.kind === 'PO' ? -1 : 1));
  const existing = db.coPoMaps.filter((m) => m.courseId === cid);
  const [draft, setDraft] = useState(null);
  const val = (co, po) => draft?.[`${co}|${po}`] ?? existing.find((m) => m.coId === co && m.poId === po)?.strength ?? 0;
  const editable = can('obe', 'edit');
  const cycle = (co, po) => editable && setDraft((d) => ({ ...(d ?? {}), [`${co}|${po}`]: (val(co, po) + 1) % 4 }));
  const save = async () => {
    if (!draft) return;
    try {
      for (const [k, v] of Object.entries(draft)) {
        const [co, po] = k.split('|');
        const ex = existing.find((m) => m.coId === co && m.poId === po);
        if (ex && v === 0) await remove('coPoMaps', ex.id, { audit: false });
        else if (ex && v !== ex.strength) await update('coPoMaps', ex.id, { strength: v }, { audit: false });
        else if (!ex && v > 0) await create('coPoMaps', { courseId: cid, coId: co, poId: po, strength: v }, { audit: false });
      }
      await audit('Updated', 'CO-PO Mapping', cid, labelOf(db, 'courses', cid));
      toast.success('CO-PO mapping saved.');
      setDraft(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      {picker}
      <Card
        title="CO–PO / PSO articulation matrix"
        subtitle={editable ? 'Click a cell to cycle strength 0 → 1 (low) → 2 (medium) → 3 (high)' : 'Strength: 1 low · 2 medium · 3 high'}
        actions={
          editable && draft ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button size="sm" icon={Save} onClick={save}>
                Save mapping
              </Button>
            </>
          ) : undefined
        }
        bodyClass="p-0"
      >
        {!cos.length ? (
          <EmptyState title="No course outcomes defined" />
        ) : (
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th>CO</th>
                  {pos.map((p) => (
                    <th key={p.id} title={p.title}>
                      {p.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cos.map((co) => (
                  <tr key={co.id}>
                    <td className="co" title={co.statement}>
                      <b>{co.code}</b>
                      <span className="muted"> {co.statement.slice(0, 40)}…</span>
                    </td>
                    {pos.map((p) => {
                      const v = val(co.id, p.id);
                      const changed = draft && `${co.id}|${p.id}` in draft;
                      return (
                        <td key={p.id}>
                          <button
                            onClick={() => cycle(co.id, p.id)}
                            disabled={!editable}
                            aria-label={`${co.code} to ${p.code}: ${v || 'none'}`}
                            className={cn('cell', `s${v}`, changed && 'changed')}
                          >
                            {v || '–'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
function Attainment() {
  const { db, settings, audit } = useData();
  const scope = useScope();
  const { cid, picker } = useCoursePicker();
  const cos = db.courseOutcomes.filter((c) => c.courseId === cid).sort((a, b) => a.code.localeCompare(b.code));
  const asm = db.assessments.filter((a) => a.courseId === cid);
  const att = coAttainment(cos, asm, settings);
  const attMap = new Map(att.map((a) => [a.coId, a]));
  const poAtt = poAttainment(
    db.coPoMaps.filter((m) => m.courseId === cid),
    attMap,
  );
  const pos = db.programOutcomes.filter((p) => poAtt.has(p.id));
  // Program level (department) PO attainment, averaged across courses
  const deptId = scope.departmentId ?? db.courses.find((c) => c.id === cid)?.departmentId;
  const program = useMemo(() => {
    const deptCourses = db.courses.filter((c) => c.departmentId === deptId && db.courseOutcomes.some((o) => o.courseId === c.id));
    const acc = new Map();
    deptCourses.forEach((c) => {
      const a = coAttainment(
        db.courseOutcomes.filter((o) => o.courseId === c.id),
        db.assessments.filter((x) => x.courseId === c.id),
        settings,
      );
      const m = new Map(a.map((x) => [x.coId, x]));
      poAttainment(
        db.coPoMaps.filter((x) => x.courseId === c.id),
        m,
      ).forEach((v, k) => acc.set(k, [...(acc.get(k) ?? []), v]));
    });
    return db.programOutcomes.map((p) => ({ po: p.code, Attainment: round1(avg(acc.get(p.id) ?? [])) })).filter((x) => x.Attainment > 0);
  }, [db, deptId, settings]);
  return (
    <>
      {picker}
      <Alert tone="info">
        Direct attainment: % of students scoring ≥ {settings.coTargetPercent}% in assessments mapped to each CO. Level 3 ≥{' '}
        {settings.attainmentLevels.level3}%, Level 2 ≥ {settings.attainmentLevels.level2}%, Level 1 ≥ {settings.attainmentLevels.level1}%.
        PO attainment = Σ(CO level × strength) / Σ strength.
      </Alert>
      <div className="grid cols-2 mt-16">
        <Card
          title="CO attainment"
          actions={
            <Button size="sm" variant="secondary" onClick={() => audit('Generated', 'OBE Attainment Report', cid)}>
              Log report
            </Button>
          }
        >
          {!att.length ? (
            <EmptyState title="No COs" />
          ) : (
            <SimpleBar
              data={att.map((a) => ({ co: a.code, '% students ≥ target': a.attainedPct }))}
              x="co"
              bars={[{ key: '% students ≥ target', label: '% students ≥ target' }]}
              unit="%"
              yMax={100}
              refLine={{ y: settings.attainmentLevels.level2, label: 'Level 2' }}
              height={230}
            />
          )}
          <table className="simple-table mt-12">
            <thead>
              <tr>
                <th>CO</th>
                <th className="text-right">Responses</th>
                <th className="text-right">% ≥ target</th>
                <th className="text-center">Level</th>
              </tr>
            </thead>
            <tbody>
              {att.map((a) => (
                <tr key={a.coId}>
                  <td className="strong">{a.code}</td>
                  <td className="text-right">{a.assessed}</td>
                  <td className="text-right">{a.attainedPct}%</td>
                  <td className="text-center">
                    <Badge tone={a.level === 3 ? 'green' : a.level === 2 ? 'blue' : a.level === 1 ? 'amber' : 'red'}>
                      {a.assessed ? `Level ${a.level}` : 'Not assessed'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="PO / PSO attainment for this course" subtitle="Scale 0–3">
          {!pos.length ? (
            <EmptyState title="No mapped and assessed outcomes" />
          ) : (
            <SimpleBar
              data={pos.map((p) => ({ po: p.code, Attainment: poAtt.get(p.id) }))}
              x="po"
              bars={[{ key: 'Attainment', label: 'Attainment (0–3)' }]}
              yMax={3}
              height={300}
            />
          )}
        </Card>
      </div>
      <Card
        title={`Program-level PO attainment · ${labelOf(db, 'departments', deptId)}`}
        subtitle="Average of course-level PO attainment (0–3)"
        className="mt-16"
      >
        <SimpleBar data={program} x="po" bars={[{ key: 'Attainment', label: 'Attainment (0–3)' }]} yMax={3} />
      </Card>
    </>
  );
}
export default function Obe() {
  const { db } = useData();
  return (
    <>
      <PageHeader title="Outcome-Based Education" subtitle="Course outcomes, program outcomes, CO–PO mapping and attainment" />
      <UrlTabs
        tabs={[
          { id: 'matrix', label: 'CO–PO mapping' },
          { id: 'attainment', label: 'Attainment' },
          { id: 'cos', label: 'Course outcomes' },
          { id: 'pos', label: 'Program outcomes', count: db.programOutcomes.length },
        ]}
      >
        {(t) =>
          t === 'matrix' ? (
            <Matrix />
          ) : t === 'attainment' ? (
            <Attainment />
          ) : t === 'cos' ? (
            <EntityPage
              config={{
                collection: 'courseOutcomes',
                title: 'Course outcomes',
                singular: 'Course Outcome',
                module: 'obe',
                rowFilter: (r, { scope }) => scope.courseAllowed(r.courseId),
                fields: [
                  { key: 'courseId', label: 'Course', type: 'ref', ref: 'courses', required: true, filter: true },
                  { key: 'code', label: 'CO', required: true },
                  { key: 'statement', label: 'Statement', type: 'textarea', required: true },
                  {
                    key: 'bloom',
                    label: "Bloom's level",
                    type: 'select',
                    options: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
                    required: true,
                    filter: true,
                  },
                  { key: 'target', label: 'Target %', type: 'number', min: 0, max: 100, required: true, default: 60 },
                ],
              }}
            />
          ) : (
            <EntityPage
              config={{
                collection: 'programOutcomes',
                title: 'Program outcomes',
                singular: 'Program Outcome',
                module: 'obe',
                fields: [
                  { key: 'code', label: 'Code', required: true, unique: true },
                  { key: 'kind', label: 'Type', type: 'select', options: ['PO', 'PSO'], required: true, filter: true },
                  { key: 'title', label: 'Title', required: true },
                  { key: 'statement', label: 'Statement', type: 'textarea', required: true },
                  { key: 'programId', label: 'Program (PSO only)', type: 'ref', ref: 'programs' },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
