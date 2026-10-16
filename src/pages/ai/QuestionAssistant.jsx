import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Trash2, Wand2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui';
import { runAi } from '../../lib/ai';
import { rng } from '../../lib/utils';
import { AiNotice, AiStatus } from './common';
const BLOOM_BY_DIFF = { Easy: ['Remember', 'Understand'], Medium: ['Understand', 'Apply'], Hard: ['Analyze', 'Evaluate', 'Create'] };
const STEMS = {
  Remember: ['Define {t} and list its key characteristics.', 'State the basic principles underlying {t}.'],
  Understand: ['Explain {t} with a suitable example.', 'Describe how {t} works and why it is important in {c}.'],
  Apply: [
    'Apply the concepts of {t} to solve a practical engineering problem of your choice. Show all steps.',
    'Using {t}, work out a solution for a typical scenario in {c}.',
  ],
  Analyze: [
    'Analyse the strengths and limitations of {t}. Compare it with an alternative approach.',
    'Examine a case where {t} fails and identify the root causes.',
  ],
  Evaluate: ['Critically evaluate the suitability of {t} for a real-world application in {c}. Justify your conclusion.'],
  Create: ['Design a solution that integrates {t} to address a given requirement. Present the design with justification.'],
};
export default function QuestionAssistant() {
  const { user } = useAuth();
  const { db, ayId, create, audit } = useData();
  const scope = useScope();
  const toast = useToast();
  const courses = useMemo(
    () =>
      db.courses
        .filter((c) => scope.courseAllowed(c.id) && db.allocations.some((a) => a.courseId === c.id && a.academicYearId === ayId))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [db, scope, ayId],
  );
  const [p, setP] = useState({ courseId: courses[0]?.id ?? '', unit: 1, difficulty: 'Medium', type: 'Long Answer', count: 5, coId: '' });
  const [drafts, setDrafts] = useState(null);
  const [sim, setSim] = useState(true);
  const [busy, setBusy] = useState(false);
  const course = db.courses.find((c) => c.id === p.courseId);
  const cos = db.courseOutcomes.filter((c) => c.courseId === p.courseId);
  // Authorised course material used as grounding: lesson plan topics + CO statements.
  const topics = db.lessonPlans.filter((l) => l.courseId === p.courseId && l.unit === p.unit).map((l) => l.topic.split(': ').pop());
  const generate = async () => {
    if (!course) return;
    setBusy(true);
    try {
      const payload = {
        course: `${course.code} ${course.name}`,
        unit: p.unit,
        topics,
        outcomes: cos.map((c) => `${c.code}: ${c.statement}`),
        difficulty: p.difficulty,
        type: p.type,
        count: p.count,
      };
      const res = await runAi('question-drafts', payload, () => {
        const r = rng(Date.now() % 100000);
        const blooms = BLOOM_BY_DIFF[p.difficulty];
        const pool = topics.length ? topics : [`Unit ${p.unit} concepts`];
        return {
          questions: Array.from({ length: p.count }, (_, i) => {
            const bloom = blooms[i % blooms.length];
            const t = `${pool[i % pool.length].toLowerCase()} (Unit ${p.unit})`;
            const stem = r.pick(STEMS[bloom]).replace('{t}', t).replace('{c}', course.name);
            const text =
              p.type === 'MCQ'
                ? `${stem.replace(/\.$/, '')}? (a) … (b) … (c) … (d) …  [Options to be completed by faculty]`
                : p.type === 'Numerical'
                  ? `${stem} Use the given data: [values to be specified by faculty].`
                  : stem;
            return {
              text,
              type: p.type,
              difficulty: p.difficulty,
              bloom,
              marks: p.type === 'MCQ' ? 1 : p.type === 'Short Answer' ? 2 : p.difficulty === 'Hard' ? 12 : 8,
            };
          }),
        };
      });
      const co = p.coId || cos[Math.min(p.unit, cos.length) - 1]?.id;
      setDrafts(res.data.questions.map((q) => ({ ...q, keep: true, coId: co, unit: p.unit, topic: `Unit ${p.unit}` })));
      setSim(res.simulated);
      await audit('Generated', 'AI question drafts', p.courseId, `${p.count} × ${p.type}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const keep = drafts?.filter((d) => d.keep && d.text.trim()) ?? [];
    if (!keep.length) {
      toast.error('Select at least one draft to save.');
      return;
    }
    try {
      for (const d of keep)
        await create(
          'questions',
          {
            courseId: p.courseId,
            unit: d.unit,
            topic: d.topic,
            text: d.text,
            type: d.type,
            difficulty: d.difficulty,
            bloom: d.bloom,
            marks: Number(d.marks),
            coId: d.coId,
            status: 'Pending Review',
            source: 'AI Draft',
            authorId: user.employeeId,
          },
          { audit: false },
        );
      await audit('Saved', 'AI question drafts', p.courseId, `${keep.length} pending review`);
      toast.success(`${keep.length} draft(s) saved to the question bank for faculty review.`);
      setDrafts(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader
        title="AI Question Bank & Assessment Assistant"
        subtitle="Draft course questions from authorised course material, difficulty levels and learning outcomes"
      />
      <AiNotice>
        {' '}
        Drafts are grounded only on this course's lesson-plan topics and course outcomes. Every draft is saved as “Pending Review” and must
        be approved by faculty in the Question Bank.
      </AiNotice>
      <div className="grid cols-3">
        <Card title="Generation parameters">
          {!courses.length ? (
            <EmptyState title="No allocated courses" />
          ) : (
            <div className="stack">
              <Field label="Course">
                <Select value={p.courseId} onChange={(e) => setP({ ...p, courseId: e.target.value, coId: '' })}>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} – {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="form-grid">
                <Field label="Unit">
                  <Select value={p.unit} onChange={(e) => setP({ ...p, unit: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((u) => (
                      <option key={u} value={u}>
                        Unit {u}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Number">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={p.count}
                    onChange={(e) => setP({ ...p, count: Math.max(1, Math.min(10, Number(e.target.value))) })}
                  />
                </Field>
                <Field label="Difficulty">
                  <Select value={p.difficulty} onChange={(e) => setP({ ...p, difficulty: e.target.value })}>
                    {['Easy', 'Medium', 'Hard'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type">
                  <Select value={p.type} onChange={(e) => setP({ ...p, type: e.target.value })}>
                    {['MCQ', 'Short Answer', 'Long Answer', 'Numerical'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Course outcome">
                <Select value={p.coId} onChange={(e) => setP({ ...p, coId: e.target.value })}>
                  <option value="">Auto (by unit)</option>
                  {cos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} – {c.statement.slice(0, 50)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="quote">
                <b>Source material:</b> {topics.length ? topics.join('; ') : 'No lesson-plan topics for this unit'} · {cos.length} COs
              </div>
              <Button icon={Wand2} onClick={generate} loading={busy}>
                Generate drafts
              </Button>
            </div>
          )}
        </Card>
        <Card
          title="Drafts for review"
          className="span-2"
          actions={
            drafts && (
              <>
                <AiStatus simulated={sim} />
                <Button size="sm" icon={Save} onClick={save}>
                  Save selected for review
                </Button>
              </>
            )
          }
        >
          {!drafts ? (
            <EmptyState title="No drafts yet" message="Choose parameters and generate. You can edit each draft before saving." />
          ) : (
            <ul className="stack">
              {drafts.map((d, i) => (
                <li key={i} className={`draft ${d.keep ? '' : 'off'}`}>
                  <div className="row mb-8">
                    <input
                      type="checkbox"
                      checked={d.keep}
                      onChange={(e) => setDrafts((x) => x.map((y, j) => (j === i ? { ...y, keep: e.target.checked } : y)))}
                      className="checkbox"
                      aria-label="Keep draft"
                    />
                    <Badge tone="violet">AI Draft</Badge>
                    <Badge tone="slate">{d.type}</Badge>
                    <Badge tone="slate">{d.difficulty}</Badge>
                    <Badge tone="blue">{d.bloom}</Badge>
                    <span className="row ml-auto">
                      Marks{' '}
                      <Input
                        type="number"
                        value={d.marks}
                        onChange={(e) => setDrafts((x) => x.map((y, j) => (j === i ? { ...y, marks: Number(e.target.value) } : y)))}
                        className="input-sm"
                      />
                    </span>
                    <button onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} className="close-btn" aria-label="Remove draft">
                      <Trash2 className="icon-16" />
                    </button>
                  </div>
                  <Textarea
                    value={d.text}
                    onChange={(e) => setDrafts((x) => x.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))}
                    rows={2}
                  />
                </li>
              ))}
            </ul>
          )}
          {drafts && (
            <div className="mt-12">
              <Alert tone="warning">
                Faculty review is required. Saved drafts appear in the <Link to="/academic/question-bank">Question Bank</Link> as “Pending
                Review” and cannot be used until approved.
              </Alert>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
