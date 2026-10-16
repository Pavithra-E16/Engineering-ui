import { useMemo, useState } from 'react';
import { BadgeCheck, PenLine } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { computeResults } from '../../data/analytics';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Button, EmptyState, Field, Input, Modal, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { avg, fmtDate, round1 } from '../../lib/utils';
const TYPES = ['Internal Test', 'Assignment', 'Quiz', 'End Semester Exam'];
export function MarksEntry({ a, onClose }) {
  const { db, update } = useData();
  const toast = useToast();
  const students = a.studentIds
    .map((id) => db.students.find((s) => s.id === id))
    .filter(Boolean)
    .sort((x, y) => x.rollNo.localeCompare(y.rollNo));
  const [marks, setMarks] = useState(() =>
    Object.fromEntries(a.studentIds.map((id) => [id, a.marks[id] == null ? '' : String(a.marks[id])])),
  );
  const [saving, setSaving] = useState(false);
  const errs = Object.entries(marks)
    .filter(([, v]) => v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > a.maxMarks))
    .map(([k]) => k);
  const filled = Object.values(marks).filter((v) => v !== '').length;
  const save = async () => {
    if (errs.length) {
      toast.error(`Marks must be between 0 and ${a.maxMarks}.`);
      return;
    }
    setSaving(true);
    try {
      const m = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v === '' ? null : Number(v)]));
      await update(
        'assessments',
        a.id,
        { marks: m, status: filled === a.studentIds.length ? 'Marks Entered' : 'Scheduled' },
        { audit: 'Marks entered', details: `${a.name} ${labelOf(db, 'courses', a.courseId)}` },
      );
      toast.success(`Marks saved for ${filled} of ${a.studentIds.length} students.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Enter marks · ${a.name} (max ${a.maxMarks})`}
      size="lg"
      footer={
        <>
          <span className="left xs muted">
            {filled}/{a.studentIds.length} entered
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save marks
          </Button>
        </>
      }
    >
      <p className="mb-12 muted">
        {labelOf(db, 'courses', a.courseId)} · {labelOf(db, 'sections', a.sectionId)} · {fmtDate(a.date)}
      </p>
      {a.status === 'Verified' && (
        <div className="mb-12">
          <Alert tone="warning">These marks were verified. Saving changes will reset the status for re-verification.</Alert>
        </div>
      )}
      <div className="marks-grid">
        {students.map((s) => (
          <label key={s.id}>
            <span className="truncate">
              <span className="mono muted">{s.rollNo}</span> {s.name}
            </span>
            <Input
              type="number"
              min={0}
              max={a.maxMarks}
              step="0.5"
              value={marks[s.id]}
              onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
              className="input-sm text-right"
              error={errs.includes(s.id)}
              aria-label={`Marks for ${s.name}`}
            />
          </label>
        ))}
      </div>
    </Modal>
  );
}
function Consolidated() {
  const { db, ayId, settings } = useData();
  const scope = useScope();
  const css = db.allocations.filter((a) => a.academicYearId === ayId && scope.csAllowed(a.courseId, a.sectionId));
  const [cs, setCs] = useState(css[0] ? `${css[0].courseId}|${css[0].sectionId}` : '');
  const [cid, sid] = cs.split('|');
  const list = db.assessments.filter((a) => a.courseId === cid && a.sectionId === sid && a.academicYearId === ayId);
  const res = computeResults(list, settings);
  const w = settings.assessmentWeights;
  return (
    <>
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
      </div>
      <div className="mb-12">
        <Alert tone="info">
          Assessment rules (configurable in Settings): {TYPES.map((t) => `${t} ${w[t]}%`).join(' · ')}. Each component is the average
          percentage of its assessments, then weighted.
        </Alert>
      </div>
      <DataTable
        title={`Consolidated marks ${labelOf(db, 'courses', cid)}`}
        rows={res.map((r) => ({ ...r, id: r.studentId, s: db.students.find((x) => x.id === r.studentId) }))}
        initialSort={{ key: 'roll', dir: 'asc' }}
        columns={[
          { key: 'roll', header: 'Roll no', value: (r) => r.s?.rollNo },
          { key: 'name', header: 'Student', value: (r) => r.s?.name },
          ...TYPES.map((t) => ({ key: t, header: `${t} %`, value: (r) => r.components[t] ?? '' })),
          { key: 'total', header: 'Weighted total', value: (r) => r.total ?? '' },
        ]}
      />
    </>
  );
}
function StudentMarks() {
  const { db, ayId } = useData();
  const scope = useScope();
  const sid = scope.linked[0];
  const rows = db.assessments.filter((a) => a.academicYearId === ayId && a.studentIds.includes(sid));
  if (!rows.length) return <EmptyState title="No assessments yet" />;
  return (
    <DataTable
      title="My marks"
      rows={rows}
      initialSort={{ key: 'date', dir: 'desc' }}
      filters={[{ key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: t })), match: (r, v) => r.type === v }]}
      columns={[
        { key: 'course', header: 'Course', value: (r) => labelOf(db, 'courses', r.courseId) },
        { key: 'name', header: 'Assessment' },
        { key: 'type', header: 'Type' },
        { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'marks', header: 'Marks', value: (r) => (r.marks[sid] == null ? 'Pending' : `${r.marks[sid]} / ${r.maxMarks}`) },
        { key: 'pct', header: '%', value: (r) => (r.marks[sid] == null ? '' : round1((Number(r.marks[sid]) / r.maxMarks) * 100)) },
        {
          key: 'class',
          header: 'Class avg %',
          value: (r) => {
            const v = Object.values(r.marks)
              .filter((x) => x != null)
              .map((x) => (Number(x) / r.maxMarks) * 100);
            return v.length ? round1(avg(v)) : '';
          },
        },
      ]}
    />
  );
}
export default function Assessments() {
  const { user } = useAuth();
  const { db, ayId, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const [entering, setEntering] = useState(null);
  const canVerify = ['hod', 'exam-cell', 'principal'].includes(user.role);
  const editable = can('assessments', 'edit');
  const pending = useMemo(
    () => db.assessments.filter((a) => a.academicYearId === ayId && a.status === 'Marks Entered' && scope.courseAllowed(a.courseId)).length,
    [db, ayId, scope],
  );
  if (scope.personal)
    return (
      <>
        <PageHeader title="Assessments & Marks" subtitle="Internal tests, assignments, quizzes and examination marks" />
        <StudentMarks />
      </>
    );
  const verify = async (a) => {
    if (
      !(await confirm({
        title: 'Verify marks?',
        message: `Verify marks for ${a.name} – ${labelOf(db, 'courses', a.courseId)}? Verified marks are used for results.`,
        confirmLabel: 'Verify',
        tone: 'primary',
      }))
    )
      return;
    try {
      await update('assessments', a.id, { status: 'Verified' }, { audit: 'Verified', details: a.name });
      toast.success('Marks verified.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Assessments & Marks" subtitle="Create assessments, enter marks and calculate totals using configurable rules" />
      <UrlTabs
        tabs={[
          { id: 'list', label: 'Assessments' },
          { id: 'totals', label: 'Consolidated marks' },
        ]}
      >
        {(t) =>
          t === 'list' ? (
            <>
              {canVerify && pending > 0 && (
                <div className="mb-12">
                  <Alert tone="warning">{pending} assessment(s) have marks entered and are awaiting verification.</Alert>
                </div>
              )}
              <EntityPage
                config={{
                  collection: 'assessments',
                  title: 'Assessments',
                  singular: 'Assessment',
                  module: 'assessments',
                  ayFiltered: true,
                  rowFilter: (r, { scope: s }) => s.csAllowed(r.courseId, r.sectionId),
                  initialSort: { key: 'date', dir: 'desc' },
                  defaults: ({ ayId: a }) => ({ academicYearId: a }),
                  beforeSave: (f, existing, d) => {
                    if (existing) return f;
                    const ids = d.students
                      .filter((s) => s.sectionId === f.sectionId && s.active !== false && s.status === 'Active')
                      .map((s) => s.id);
                    return { ...f, status: 'Scheduled', studentIds: ids, marks: Object.fromEntries(ids.map((i) => [i, null])) };
                  },
                  canEditRow: (r) => r.status !== 'Verified' || canVerify,
                  rowActions: (r) => (
                    <>
                      {editable && (r.status !== 'Verified' || canVerify) && (
                        <Button size="sm" variant="ghost" icon={PenLine} onClick={() => setEntering(r)} title="Enter marks">
                          Marks
                        </Button>
                      )}
                      {canVerify && r.status === 'Marks Entered' && (
                        <Button size="sm" variant="ghost" icon={BadgeCheck} className="text-green" onClick={() => verify(r)}>
                          Verify
                        </Button>
                      )}
                    </>
                  ),
                  fields: [
                    {
                      key: 'courseId',
                      label: 'Course',
                      type: 'ref',
                      ref: 'courses',
                      required: true,
                      filter: true,
                      refFilter: (r, _f, d) =>
                        d.allocations.some(
                          (a) => a.courseId === r.id && a.academicYearId === ayId && scope.csAllowed(a.courseId, a.sectionId),
                        ),
                    },
                    {
                      key: 'sectionId',
                      label: 'Section',
                      type: 'ref',
                      ref: 'sections',
                      required: true,
                      filter: true,
                      refFilter: (r, f, d) =>
                        d.allocations.some((a) => a.sectionId === r.id && a.courseId === f.courseId && a.academicYearId === ayId),
                    },
                    { key: 'name', label: 'Name', required: true },
                    { key: 'type', label: 'Type', type: 'select', options: TYPES, required: true, filter: true },
                    { key: 'maxMarks', label: 'Max marks', type: 'number', min: 1, max: 200, required: true },
                    { key: 'date', label: 'Date', type: 'date', required: true },
                    {
                      key: 'coIds',
                      label: 'Course outcomes assessed',
                      type: 'multiref',
                      ref: 'courseOutcomes',
                      refFilter: (r, f) => r.courseId === f.courseId,
                      table: false,
                      required: true,
                    },
                    {
                      key: 'entered',
                      label: 'Entered',
                      form: false,
                      value: (r) => `${Object.values(r.marks ?? {}).filter((v) => v != null).length}/${r.studentIds?.length ?? 0}`,
                    },
                    {
                      key: 'avg',
                      label: 'Avg %',
                      form: false,
                      value: (r) => {
                        const v = Object.values(r.marks ?? {})
                          .filter((x) => x != null)
                          .map((x) => (Number(x) / r.maxMarks) * 100);
                        return v.length ? round1(avg(v)) : '—';
                      },
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      type: 'select',
                      options: ['Scheduled', 'Marks Entered', 'Verified'],
                      form: false,
                      filter: true,
                    },
                  ],
                }}
              />
            </>
          ) : (
            <Consolidated />
          )
        }
      </UrlTabs>
      {entering && <MarksEntry a={db.assessments.find((x) => x.id === entering.id)} onClose={() => setEntering(null)} />}
    </>
  );
}
