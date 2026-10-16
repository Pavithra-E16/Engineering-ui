import { useState } from 'react';
import { Send, Star } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Textarea, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { avg, cn, fmtDate, round1, todayISO } from '../../lib/utils';
function Respond({ form, onClose }) {
  const { create } = useData();
  const scope = useScope();
  const toast = useToast();
  const [ratings, setRatings] = useState(form.questions.map(() => 0));
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    if (ratings.some((r) => !r)) return setErr('Please rate every question.');
    try {
      await create('feedbackResponses', { formId: form.id, respondentId: scope.linked[0], ratings, comment }, { audit: 'Submitted' });
      toast.success('Thank you! Your feedback has been submitted anonymously.');
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={form.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Send} onClick={submit}>
            Submit
          </Button>
        </>
      }
    >
      <p className="mb-12 xs muted">Responses are shown to staff only as aggregated summaries.</p>
      {err && (
        <div className="mb-12">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      <ul className="stack">
        {form.questions.map((q, i) => (
          <li key={i} className="row between">
            <span>
              {i + 1}. {q}
            </span>
            <div className="stars" role="radiogroup" aria-label={q}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={ratings[i] === n}
                  onClick={() => setRatings((r) => r.map((x, j) => (j === i ? n : x)))}
                  aria-label={`${n} star`}
                >
                  <Star className={undefined} />
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Field label="Comments (optional)" className="mt-16">
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </Field>
    </Modal>
  );
}
function Summary() {
  const { db } = useData();
  const [fid, setFid] = useState(db.feedbackForms[0]?.id ?? '');
  const form = db.feedbackForms.find((f) => f.id === fid);
  const res = db.feedbackResponses.filter((r) => r.formId === fid);
  if (!form) return <EmptyState title="No feedback forms" />;
  const data = form.questions.map((q, i) => ({
    q: q.length > 22 ? q.slice(0, 22) + '…' : q,
    'Avg rating': round1(avg(res.map((r) => r.ratings[i] ?? 0))),
  }));
  const comments = res.map((r) => r.comment).filter(Boolean);
  return (
    <>
      <Field label="Form" className="mb-16 w-lg">
        <Select value={fid} onChange={(e) => setFid(e.target.value)}>
          {db.feedbackForms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid cols-3">
        <Card title="Average rating per question" subtitle={`${res.length} responses · scale 1–5`} className="span-2">
          {res.length ? (
            <SimpleBar
              data={data}
              x="q"
              bars={[{ key: 'Avg rating', label: 'Average rating' }]}
              yMax={5}
              horizontal
              height={Math.max(220, data.length * 44)}
            />
          ) : (
            <EmptyState title="No responses yet" />
          )}
        </Card>
        <Card title="Overall" subtitle="Anonymised comments">
          <p className="big-number">
            {round1(avg(res.flatMap((r) => r.ratings)))}
            <span> / 5</span>
          </p>
          <ul className="stack tight mt-12 scroll-64">
            {comments.slice(0, 20).map((c, i) => (
              <li key={i} className="quote">
                “{c}”
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
export default function Feedback() {
  const { user } = useAuth();
  const { db, can } = useData();
  const scope = useScope();
  const [resp, setResp] = useState(null);
  const manage = can('feedback', 'edit') && !scope.personal;
  if (scope.personal) {
    const open = db.feedbackForms.filter((f) => f.status === 'Open' && f.closesOn >= todayISO());
    const done = new Set(db.feedbackResponses.filter((r) => r.respondentId === scope.linked[0]).map((r) => r.formId));
    return (
      <>
        <PageHeader title="Feedback" subtitle="Share anonymous feedback on courses, faculty and facilities" />
        {!open.length ? (
          <EmptyState title="No open feedback forms" />
        ) : (
          <div className="grid cols-2 gap-sm">
            {open.map((f) => (
              <Card key={f.id}>
                <div className="row between start nowrap">
                  <div>
                    <p className="strong">{f.title}</p>
                    <p className="xs muted">
                      {f.type} · {f.questions.length} questions · closes {fmtDate(f.closesOn)}
                    </p>
                  </div>
                  {done.has(f.id) ? (
                    <Badge tone="green">Submitted</Badge>
                  ) : user.role === 'student' ? (
                    <Button size="sm" onClick={() => setResp(f)}>
                      Respond
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
        {resp && <Respond form={resp} onClose={() => setResp(null)} />}
      </>
    );
  }
  return (
    <>
      <PageHeader title="Feedback Management" subtitle="Create feedback forms, collect responses and view authorised summaries" />
      <UrlTabs
        tabs={[
          { id: 'summary', label: 'Summaries' },
          { id: 'forms', label: 'Forms', hidden: !manage },
        ]}
      >
        {(t) =>
          t === 'summary' ? (
            <Summary />
          ) : (
            <EntityPage
              config={{
                collection: 'feedbackForms',
                title: 'Feedback forms',
                singular: 'Feedback Form',
                module: 'feedback',
                defaults: ({ ayId }) => ({ academicYearId: ayId, status: 'Draft' }),
                beforeSave: (f) => ({
                  ...f,
                  questions:
                    typeof f.questions === 'string'
                      ? f.questions
                          .split('\n')
                          .map((x) => x.trim())
                          .filter(Boolean)
                      : f.questions,
                }),
                fields: [
                  { key: 'title', label: 'Title', required: true, wide: true },
                  {
                    key: 'type',
                    label: 'Type',
                    type: 'select',
                    options: ['Course', 'Faculty', 'Facility', 'Exit'],
                    required: true,
                    filter: true,
                  },
                  { key: 'courseId', label: 'Course (optional)', type: 'ref', ref: 'courses', table: false },
                  {
                    key: 'questions',
                    label: 'Questions (one per line, rated 1–5)',
                    type: 'textarea',
                    required: true,
                    value: (r) => (Array.isArray(r.questions) ? r.questions.length : 0),
                    render: (r) => `${r.questions?.length ?? 0} questions`,
                  },
                  { key: 'closesOn', label: 'Closes on', type: 'date', required: true },
                  {
                    key: 'responses',
                    label: 'Responses',
                    form: false,
                    value: (r) => db.feedbackResponses.filter((x) => x.formId === r.id).length,
                  },
                  { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Open', 'Closed'], required: true, filter: true },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
