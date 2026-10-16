import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EntityPage } from '../../components/EntityPage';
import { Button, Card, PageHeader, ProgressBar, StatCard, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { pct, todayISO } from '../../lib/utils';
import { NotebookPen, CheckCheck, Clock, AlertTriangle } from 'lucide-react';
export default function LessonPlans() {
  const { db, ayId, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const rows = useMemo(
    () => db.lessonPlans.filter((l) => l.academicYearId === ayId && l.active !== false && scope.csAllowed(l.courseId, l.sectionId)),
    [db.lessonPlans, ayId, scope],
  );
  const done = rows.filter((r) => r.status === 'Completed').length;
  const due = rows.filter((r) => r.plannedDate <= todayISO()).length;
  const delayed = rows.filter((r) => r.status === 'Delayed' || (r.status === 'Planned' && r.plannedDate < todayISO())).length;
  const byUnit = [1, 2, 3, 4, 5].map((u) => {
    const l = rows.filter((r) => r.unit === u);
    return { unit: `Unit ${u}`, Planned: l.length, Completed: l.filter((r) => r.status === 'Completed').length };
  });
  const complete = async (r) => {
    try {
      await update('lessonPlans', r.id, { status: 'Completed', completedDate: todayISO() }, { audit: 'Marked completed' });
      toast.success('Lesson marked as completed.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Lesson Planning" subtitle="Plan topics, record teaching dates and track planned vs completed lessons" />
      <div className="grid cols-4 stats">
        <StatCard label="Planned topics" value={rows.length} icon={NotebookPen} />
        <StatCard label="Completed" value={done} icon={CheckCheck} tone="green" hint={`${pct(done, rows.length)}% of plan`} />
        <StatCard label="Due till today" value={due} icon={Clock} tone="blue" hint={`${pct(done, due)}% on track`} />
        <StatCard label="Delayed" value={delayed} icon={AlertTriangle} tone={delayed ? 'amber' : 'green'} />
      </div>
      <div className="grid cols-3 mb-16">
        <Card title="Planned vs completed by unit" className="span-2">
          <SimpleBar
            data={byUnit}
            x="unit"
            bars={[
              { key: 'Planned', label: 'Planned' },
              { key: 'Completed', label: 'Completed' },
            ]}
            height={220}
          />
        </Card>
        <Card title="Overall syllabus coverage">
          <p className="big-number">{pct(done, rows.length)}%</p>
          <p className="mb-12 xs muted">of planned topics completed</p>
          <ProgressBar value={pct(done, rows.length)} tone="navy" />
          <p className="mt-16 xs muted">Topics planned for a past date but not completed are counted as delayed.</p>
        </Card>
      </div>
      <EntityPage
        config={{
          collection: 'lessonPlans',
          title: 'Lesson plans',
          singular: 'Lesson Plan',
          module: 'lesson-plans',
          ayFiltered: true,
          rowFilter: (r, { scope: s }) => s.csAllowed(r.courseId, r.sectionId),
          initialSort: { key: 'plannedDate', dir: 'asc' },
          defaults: ({ ayId: a, scope: s }) => ({ academicYearId: a, facultyId: s.facultyId ?? undefined }),
          rowActions: (r) =>
            can('lesson-plans', 'edit') && r.status !== 'Completed' ? (
              <Button
                size="sm"
                variant="ghost"
                icon={CheckCircle2}
                className="text-green"
                onClick={() => complete(r)}
                title="Mark completed"
              >
                Done
              </Button>
            ) : null,
          beforeSave: (f, existing, d) => {
            const alloc = d.allocations.find((a) => a.courseId === f.courseId && a.sectionId === f.sectionId && a.academicYearId === ayId);
            const status = f.completedDate
              ? 'Completed'
              : f.status === 'Completed'
                ? 'Completed'
                : f.plannedDate < todayISO()
                  ? 'Delayed'
                  : 'Planned';
            return {
              ...f,
              facultyId: f.facultyId ?? existing?.facultyId ?? alloc?.facultyId,
              status,
              completedDate: status === 'Completed' ? (f.completedDate ?? todayISO()) : undefined,
            };
          },
          fields: [
            {
              key: 'courseId',
              label: 'Course',
              type: 'ref',
              ref: 'courses',
              required: true,
              filter: true,
              refFilter: (r, _f, d) =>
                d.allocations.some((a) => a.courseId === r.id && a.academicYearId === ayId && scope.csAllowed(a.courseId, a.sectionId)),
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
            { key: 'unit', label: 'Unit', type: 'number', min: 1, max: 6, required: true, filter: true },
            { key: 'topic', label: 'Topic', required: true, wide: true },
            { key: 'plannedDate', label: 'Planned date', type: 'date', required: true },
            {
              key: 'completedDate',
              label: 'Completed on',
              type: 'date',
              validate: (v) => (v && v > todayISO() ? 'Cannot be in the future' : undefined),
            },
            {
              key: 'method',
              label: 'Teaching method',
              type: 'select',
              options: ['Lecture', 'Lecture + PPT', 'Flipped Classroom', 'Case Study', 'Problem Solving', 'Demonstration', 'Lab Session'],
              required: true,
            },
            {
              key: 'coIds',
              label: 'Course outcomes',
              type: 'multiref',
              ref: 'courseOutcomes',
              refFilter: (r, f) => r.courseId === f.courseId,
              table: false,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Planned', 'Completed', 'Delayed'],
              filter: true,
              default: 'Planned',
              hint: 'Set automatically from dates',
            },
          ],
        }}
      />
    </>
  );
}
