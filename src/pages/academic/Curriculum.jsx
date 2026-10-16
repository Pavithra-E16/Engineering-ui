import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import { EntityPage } from '../../components/EntityPage';
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
  Tabs,
  useConfirm,
  useToast,
} from '../../components/ui';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { sum } from '../../lib/utils';
/** Add a course to one semester of a curriculum: pick an existing course of the program or create a new one. */
function AddCourseModal({ cur, semesterNo, onClose }) {
  const { db, create, update } = useData();
  const toast = useToast();
  const program = db.programs.find((p) => p.id === cur.programId);
  const unmapped = db.courses.filter((c) => c.programId === cur.programId && c.active !== false && c.curriculumId !== cur.id);
  const [mode, setMode] = useState(unmapped.length ? 'existing' : 'new');
  const [courseId, setCourseId] = useState('');
  const [f, setF] = useState({ code: '', name: '', L: 3, T: 0, P: 0, credits: 3, type: 'Core' });
  const [err, setErr] = useState('');
  const setL = (k, v) => {
    const next = { ...f, [k]: v };
    // Suggest credits from L-T-P (1 credit per lecture/tutorial hour, 1 per 2 practical hours).
    if (['L', 'T', 'P'].includes(k)) next.credits = Number(next.L || 0) + Number(next.T || 0) + Number(next.P || 0) / 2;
    setF(next);
  };
  const save = async () => {
    setErr('');
    try {
      if (mode === 'existing') {
        if (!courseId) return setErr('Select a course.');
        await update(
          'courses',
          courseId,
          { curriculumId: cur.id, semesterNo },
          { audit: 'Mapped to curriculum', details: `Sem ${semesterNo}` },
        );
      } else {
        if (!f.code.trim() || !f.name.trim()) return setErr('Course code and name are required.');
        if (db.courses.some((c) => c.code.toLowerCase() === f.code.trim().toLowerCase())) return setErr('This course code already exists.');
        if (!(Number(f.credits) > 0)) return setErr('Credits must be greater than 0.');
        await create('courses', {
          code: f.code.trim(),
          name: f.name.trim(),
          credits: Number(f.credits),
          L: Number(f.L),
          T: Number(f.T),
          P: Number(f.P),
          type: f.type,
          departmentId: program.departmentId,
          programId: program.id,
          semesterNo,
          curriculumId: cur.id,
          status: 'Active',
          prerequisites: '',
        });
      }
      toast.success(`Course added to Semester ${semesterNo}.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Add course to Semester ${semesterNo}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Add to Semester {semesterNo}</Button>
        </>
      }
    >
      <div className="stack">
        <Tabs
          tabs={[
            { id: 'existing', label: 'Existing course', count: unmapped.length },
            { id: 'new', label: 'New course' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {err && <Alert tone="error">{err}</Alert>}
        {mode === 'existing' ? (
          unmapped.length ? (
            <Field label="Course" required hint={`Courses of ${program?.code} not yet in this curriculum`}>
              <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Select…</option>
                {unmapped.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} – {c.name} ({c.credits} cr)
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <EmptyState title="All courses of this program are already mapped" message="Create a new course instead." />
          )
        ) : (
          <div className="form-grid cols-4">
            <Field label="Course code" required>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. 26CS501" />
            </Field>
            <Field label="Course name" required className="wide">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {['Core', 'Elective', 'Lab', 'Project'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="L (lecture hrs/wk)">
              <Input type="number" min={0} max={6} value={f.L} onChange={(e) => setL('L', e.target.value)} />
            </Field>
            <Field label="T (tutorial hrs/wk)">
              <Input type="number" min={0} max={4} value={f.T} onChange={(e) => setL('T', e.target.value)} />
            </Field>
            <Field label="P (practical hrs/wk)">
              <Input type="number" min={0} max={8} value={f.P} onChange={(e) => setL('P', e.target.value)} />
            </Field>
            <Field label="Credits" hint="Auto: L + T + P÷2">
              <Input type="number" min={0} step="0.5" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SemesterMap() {
  const { db, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const editable = can('curriculum', 'edit');
  const curricula = db.curricula.filter(
    (c) =>
      c.active !== false && (!scope.departmentId || db.programs.find((p) => p.id === c.programId)?.departmentId === scope.departmentId),
  );
  const [cid, setCid] = useState(curricula[0]?.id ?? '');
  const [adding, setAdding] = useState(null); // semester number
  const cur = db.curricula.find((c) => c.id === cid);
  const courses = useMemo(() => db.courses.filter((c) => c.curriculumId === cid && c.active !== false), [db.courses, cid]);
  const mapped = sum(courses.map((c) => c.credits));
  const sems = Math.max(8, (db.programs.find((p) => p.id === cur?.programId)?.durationYears ?? 4) * 2);

  const move = async (c, semesterNo) => {
    try {
      await update('courses', c.id, { semesterNo }, { audit: 'Moved semester', details: `${c.code} → Sem ${semesterNo}` });
      toast.success(`${c.code} moved to Semester ${semesterNo}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const unmap = async (c) => {
    if (
      !(await confirm({
        title: 'Remove from curriculum?',
        message: `Remove ${c.code} – ${c.name} from ${labelOf(db, 'curricula', cid)}? The course itself is kept and can be mapped again.`,
        confirmLabel: 'Remove',
      }))
    )
      return;
    try {
      await update('courses', c.id, { curriculumId: '' }, { audit: 'Removed from curriculum', details: c.code });
      toast.success(`${c.code} removed from this curriculum.`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Alert tone="info" title="How semester mapping works">
        A curriculum (for example <b>BT-CSE R22</b>) defines <b>which course is taught in which semester</b> of a program and how many
        credits it carries. To build it: <b>1.</b> create the curriculum in the <i>Curriculum versions</i> tab (program, regulation, total
        credits required);
        <b> 2.</b> select it below; <b>3.</b> click <b>+ Add</b> on a semester to add an existing course of that program or create a new
        one;
        <b> 4.</b> use the semester selector on a course to move it, or <b>×</b> to remove it. Semester and total credits update
        automatically, and the timetable, faculty allocation and attendance use these semester assignments.
      </Alert>
      <Card
        className="mt-16"
        title="Semester-wise course mapping"
        actions={
          <Select value={cid} onChange={(e) => setCid(e.target.value)} className="input-sm w-md" aria-label="Curriculum">
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {labelOf(db, 'curricula', c.id)}
              </option>
            ))}
          </Select>
        }
      >
        {!cur ? (
          <EmptyState title="No curriculum yet" message="Create a curriculum version first, then map its courses here." />
        ) : (
          <>
            <div className="row between mb-12">
              <p className="muted">
                {labelOf(db, 'programs', cur.programId)} · Regulation {cur.regulation} · <Badge>{cur.status}</Badge>
              </p>
              <p className="small">
                Mapped credits <b>{mapped}</b> / {cur.totalCredits}{' '}
                {mapped < cur.totalCredits ? (
                  <span className="text-amber">({cur.totalCredits - mapped} more needed)</span>
                ) : (
                  <span className="text-green">✓ complete</span>
                )}
              </p>
            </div>
            <div className="mb-16">
              <ProgressBar value={(mapped / Math.max(1, cur.totalCredits)) * 100} tone={mapped >= cur.totalCredits ? 'green' : 'navy'} />
            </div>
            <div className="grid cols-4 gap-sm">
              {Array.from({ length: sems }, (_, i) => i + 1).map((s) => {
                const list = courses.filter((c) => c.semesterNo === s).sort((a, b) => a.code.localeCompare(b.code));
                return (
                  <div key={s} className="sem-box">
                    <div className="head">
                      <span>
                        Semester {s} · {sum(list.map((c) => c.credits))} cr
                      </span>
                      {editable && (
                        <button className="sem-add" onClick={() => setAdding(s)}>
                          <Plus /> Add
                        </button>
                      )}
                    </div>
                    <ul className="list">
                      {list.map((c) => (
                        <li key={c.id}>
                          <div className="row between nowrap start">
                            <div className="grow">
                              <p className="strong">
                                {c.code}{' '}
                                <span className="muted">
                                  · {c.credits} cr · {c.L}-{c.T}-{c.P}
                                </span>
                              </p>
                              <p className="muted">{c.name}</p>
                              {c.prerequisites && <p className="xs muted">Prereq: {c.prerequisites}</p>}
                            </div>
                            {editable && (
                              <div className="sem-tools">
                                <select
                                  value={c.semesterNo}
                                  onChange={(e) => move(c, Number(e.target.value))}
                                  title="Move to semester"
                                  aria-label={`Move ${c.code} to semester`}
                                >
                                  {Array.from({ length: sems }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                      S{i + 1}
                                    </option>
                                  ))}
                                </select>
                                <button title="Remove from curriculum" onClick={() => unmap(c)}>
                                  <X />
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                      {!list.length && <li className="xs muted">No courses</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
      {adding && cur && <AddCourseModal cur={cur} semesterNo={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export default function Curriculum() {
  const { db, can, update } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const approve = async (r) => {
    if (
      !(await confirm({
        title: 'Approve curriculum?',
        message: `Approve ${labelOf(db, 'curricula', r.id)}? Approved curricula become effective from ${r.effectiveFrom}.`,
        confirmLabel: 'Approve',
        tone: 'primary',
      }))
    )
      return;
    try {
      await update('curricula', r.id, { status: 'Approved', approvedBy: 'Academic Council' }, { audit: 'Approved' });
      toast.success('Curriculum approved.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader
        title="Curriculum Management"
        subtitle="Curriculum versions, credits, semester mapping, prerequisites and learning outcomes"
      />
      <UrlTabs
        tabs={[
          { id: 'versions', label: 'Curriculum versions' },
          { id: 'map', label: 'Semester mapping' },
          { id: 'outcomes', label: 'Learning outcomes (COs)' },
        ]}
      >
        {(t) =>
          t === 'versions' ? (
            <EntityPage
              config={{
                collection: 'curricula',
                title: 'Curriculum versions',
                singular: 'Curriculum',
                module: 'curriculum',
                rowFilter: (r, { scope, db: d }) =>
                  !scope.departmentId || d.programs.find((p) => p.id === r.programId)?.departmentId === scope.departmentId,
                rowActions: (r) =>
                  can('curriculum', 'edit') && r.status === 'Draft' ? (
                    <Button size="sm" variant="ghost" icon={CheckCircle2} onClick={() => approve(r)} title="Approve">
                      Approve
                    </Button>
                  ) : null,
                fields: [
                  { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, filter: true },
                  { key: 'regulation', label: 'Regulation', required: true },
                  { key: 'version', label: 'Version', required: true },
                  { key: 'effectiveFrom', label: 'Effective from', type: 'date', required: true },
                  { key: 'totalCredits', label: 'Total credits', type: 'number', min: 1, max: 250, required: true },
                  {
                    key: 'mapped',
                    label: 'Mapped credits',
                    form: false,
                    value: (r, d) => sum(d.courses.filter((c) => c.curriculumId === r.id && c.active !== false).map((c) => c.credits)),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Draft', 'Approved', 'Archived'],
                    required: true,
                    filter: true,
                    default: 'Draft',
                  },
                  { key: 'approvedBy', label: 'Approved by', table: false },
                ],
              }}
            />
          ) : t === 'map' ? (
            <SemesterMap />
          ) : (
            <EntityPage
              config={{
                collection: 'courseOutcomes',
                title: 'Course outcomes',
                singular: 'Course Outcome',
                module: 'curriculum',
                rowFilter: (r, { scope }) => scope.courseAllowed(r.courseId),
                fields: [
                  { key: 'courseId', label: 'Course', type: 'ref', ref: 'courses', required: true, filter: true },
                  { key: 'code', label: 'CO code', required: true },
                  { key: 'statement', label: 'Outcome statement', type: 'textarea', required: true },
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
          )
        }
      </UrlTabs>
    </>
  );
}
