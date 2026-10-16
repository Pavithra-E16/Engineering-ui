import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { EntityPage } from '../../components/EntityPage';
import { Alert, Button, PageHeader, StatCard, useToast } from '../../components/ui';
import { Library, Clock, Sparkles, CheckCheck } from 'lucide-react';
export default function QuestionBank() {
  const { user } = useAuth();
  const { db, can, update } = useData();
  const toast = useToast();
  const reviewer = ['hod', 'course-champion', 'dean', 'program-coordinator'].includes(user.role);
  const pending = db.questions.filter((q) => q.status === 'Pending Review');
  const decide = async (r, status) => {
    try {
      await update('questions', r.id, { status }, { audit: status, details: r.text.slice(0, 60) });
      toast.success(`Question ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Question Bank" subtitle="Questions by course, unit, topic, difficulty, Bloom's level and course outcome" />
      <div className="grid cols-4 stats">
        <StatCard label="Questions" value={db.questions.length} icon={Library} />
        <StatCard label="Approved" value={db.questions.filter((q) => q.status === 'Approved').length} icon={CheckCheck} tone="green" />
        <StatCard label="Pending review" value={pending.length} icon={Clock} tone="amber" />
        <StatCard label="AI drafts" value={db.questions.filter((q) => q.source === 'AI Draft').length} icon={Sparkles} tone="violet" />
      </div>
      {reviewer && pending.length > 0 && (
        <div className="mb-12">
          <Alert tone="warning">
            {pending.length} question(s) are awaiting review. AI-drafted questions must be reviewed by faculty before approval.
          </Alert>
        </div>
      )}
      <EntityPage
        config={{
          collection: 'questions',
          title: 'Question bank',
          singular: 'Question',
          module: 'question-bank',
          rowFilter: (r, { scope }) => scope.courseAllowed(r.courseId),
          defaults: () => ({ source: 'Faculty', authorId: user.employeeId, status: 'Pending Review' }),
          rowActions: (r) =>
            reviewer && can('question-bank', 'edit') && r.status === 'Pending Review' ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={CheckCircle2}
                  className="text-green"
                  onClick={() => decide(r, 'Approved')}
                  title="Approve"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={XCircle}
                  className="text-red"
                  onClick={() => decide(r, 'Rejected')}
                  title="Reject"
                />
              </>
            ) : null,
          fields: [
            {
              key: 'courseId',
              label: 'Course',
              type: 'ref',
              ref: 'courses',
              required: true,
              filter: true,
              value: (r, d) => d.courses.find((c) => c.id === r.courseId)?.code,
            },
            { key: 'unit', label: 'Unit', type: 'number', min: 1, max: 6, required: true, filter: true },
            { key: 'topic', label: 'Topic', required: true },
            {
              key: 'text',
              label: 'Question',
              type: 'textarea',
              required: true,
              render: (r) => <span className="clamp-2">{r.text}</span>,
            },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: ['MCQ', 'Short Answer', 'Long Answer', 'Numerical'],
              required: true,
              filter: true,
            },
            { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Medium', 'Hard'], required: true, filter: true },
            {
              key: 'bloom',
              label: "Bloom's level",
              type: 'select',
              options: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
              required: true,
              filter: true,
              table: false,
            },
            { key: 'marks', label: 'Marks', type: 'number', min: 1, max: 20, required: true },
            {
              key: 'coId',
              label: 'Course outcome',
              type: 'ref',
              ref: 'courseOutcomes',
              refFilter: (r, f) => r.courseId === f.courseId,
              filter: false,
            },
            { key: 'source', label: 'Source', type: 'select', options: ['Faculty', 'AI Draft'], form: false, filter: true },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Draft', 'Pending Review', 'Approved', 'Rejected'],
              required: true,
              filter: true,
            },
          ],
        }}
      />
    </>
  );
}
