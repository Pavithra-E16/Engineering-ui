import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui';
import { ROLES, roleLabel } from '../../lib/roles';
import { fmtDate, todayISO } from '../../lib/utils';
import { useMyAnnouncements } from '../dashboard/Dashboard';
import { Megaphone } from 'lucide-react';
const ROLE_IDS = ROLES.map((r) => r.id);
function NoticeBoard() {
  const items = useMyAnnouncements();
  if (!items.length) return <EmptyState icon={Megaphone} title="No notices for you right now" />;
  return (
    <div className="grid cols-2 gap-sm">
      {items.map((a) => (
        <Card key={a.id}>
          <div className="row between start nowrap">
            <h3 className="strong">{a.title}</h3>
            {a.priority !== 'Normal' && <Badge>{a.priority}</Badge>}
          </div>
          <p className="mt-8 muted pre-line">{a.body}</p>
          <p className="mt-12 xs muted">
            {fmtDate(a.publishDate)} · {a.authorName}
            {a.semesterNo ? ` · Semester ${a.semesterNo}` : ''}
          </p>
        </Card>
      ))}
    </div>
  );
}
export default function Communication() {
  const { user } = useAuth();
  const { can, notify } = useData();
  const edit = can('communication', 'edit');
  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Announcements and notices targeted by role, department and semester, with in-app notifications"
      />
      <UrlTabs
        tabs={[
          { id: 'board', label: 'Notice board' },
          { id: 'manage', label: 'Manage announcements', hidden: !edit },
          { id: 'events', label: 'Academic calendar' },
        ]}
      >
        {(t) =>
          t === 'board' ? (
            <NoticeBoard />
          ) : t === 'manage' ? (
            <EntityPage
              config={{
                collection: 'announcements',
                title: 'Announcements',
                singular: 'Announcement',
                module: 'communication',
                initialSort: { key: 'publishDate', dir: 'desc' },
                defaults: () => ({ authorName: user.name, publishDate: todayISO(), priority: 'Normal' }),
                beforeSave: (f) => ({ ...f, semesterNo: f.semesterNo ? Number(f.semesterNo) : undefined }),
                afterSave: async (rec, isNew) => {
                  if (!isNew) return;
                  for (const r of rec.audienceRoles)
                    await notify({
                      role: r,
                      title: `New notice: ${rec.title}`,
                      message: rec.body.slice(0, 120),
                      link: '/services/communication',
                    });
                },
                fields: [
                  { key: 'title', label: 'Title', required: true, wide: true },
                  { key: 'body', label: 'Message', type: 'textarea', required: true, table: false },
                  {
                    key: 'audienceRoles',
                    label: 'Audience (roles)',
                    type: 'multiselect',
                    options: ROLE_IDS,
                    optionLabel: (o) => roleLabel(o),
                    required: true,
                    value: (r) => (r.audienceRoles ?? []).map((x) => roleLabel(x)).join(', '),
                    render: (r) => <span className="truncate xs">{(r.audienceRoles ?? []).map((x) => roleLabel(x)).join(', ')}</span>,
                  },
                  { key: 'departmentId', label: 'Department (optional)', type: 'ref', ref: 'departments', filter: true },
                  { key: 'semesterNo', label: 'Semester (optional)', type: 'number', min: 1, max: 8, table: false },
                  {
                    key: 'priority',
                    label: 'Priority',
                    type: 'select',
                    options: ['Normal', 'Important', 'Urgent'],
                    required: true,
                    filter: true,
                  },
                  { key: 'publishDate', label: 'Publish date', type: 'date', required: true },
                  {
                    key: 'expiryDate',
                    label: 'Expiry date',
                    type: 'date',
                    validate: (v, f) => (v && f.publishDate && v < f.publishDate ? 'Expiry must be after publish date' : undefined),
                  },
                  { key: 'authorName', label: 'Author', readOnly: true, table: false },
                ],
              }}
            />
          ) : (
            <EntityPage
              config={{
                collection: 'events',
                title: 'Academic calendar',
                singular: 'Event',
                module: 'communication',
                initialSort: { key: 'date', dir: 'asc' },
                fields: [
                  { key: 'title', label: 'Event', required: true },
                  { key: 'date', label: 'Date', type: 'date', required: true },
                  {
                    key: 'type',
                    label: 'Type',
                    type: 'select',
                    options: ['Academic', 'Exam', 'Cultural', 'Placement', 'Holiday', 'Meeting'],
                    required: true,
                    filter: true,
                  },
                  { key: 'description', label: 'Description', type: 'textarea', table: false },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
