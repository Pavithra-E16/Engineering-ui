import { BedDouble, Building, LogOut, Percent, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, StatCard, useConfirm, useToast } from '../../components/ui';
import { PROVISIONS } from '../../lib/domain';
import { fmtDate, fmtMoney, pct, sum, todayISO } from '../../lib/utils';

export default function Hostel() {
  const { user } = useAuth();
  const { db, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  // A warden linked to one hostel sees only that hostel.
  const mine = (hostelId) => !user?.hostelId || hostelId === user.hostelId;
  const hostels = db.hostels.filter((h) => mine(h.id));
  const rooms = db.hostelRooms.filter((r) => mine(r.hostelId));
  const allocs = db.hostelAllocations.filter((a) => mine(db.hostelRooms.find((r) => r.id === a.roomId)?.hostelId));
  const occ = (roomId) => allocs.filter((a) => a.roomId === roomId && a.status === 'Allocated').length;
  const beds = sum(rooms.filter((r) => r.active !== false).map((r) => r.capacity));
  const residents = allocs.filter((a) => a.status === 'Allocated').length;

  if (scope.personal) {
    const a = db.hostelAllocations.find((x) => scope.linked.includes(x.studentId) && x.status === 'Allocated');
    const room = a && db.hostelRooms.find((r) => r.id === a.roomId);
    const h = room && db.hostels.find((x) => x.id === room.hostelId);
    return (
      <>
        <PageHeader title="My Hostel" subtitle="Room, warden and provisions issued to you" />
        <Card>
          {!a ? (
            <EmptyState icon={BedDouble} title="No hostel allocation" message="Contact the hostel office to apply for accommodation." />
          ) : (
            <dl className="details">
              {[
                ['Hostel', h?.name],
                ['Room / bed', `${room?.roomNo} (${room?.type}) · Bed ${a.bedNo ?? '—'}`],
                ['Warden', h?.warden],
                ['Annual hostel fee', fmtMoney(room?.fee)],
                ['Resident since', fmtDate(a.fromDate)],
                ['Provisions issued', (a.provisions ?? []).join(', ')],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </>
    );
  }
  const vacate = async (r) => {
    if (!(await confirm({ title: 'Vacate room?', message: `Mark ${labelOf(db, 'students', r.studentId)} as vacated? Collect the issued provisions first.`, confirmLabel: 'Vacate' }))) return;
    try {
      await update('hostelAllocations', r.id, { status: 'Vacated', toDate: todayISO() }, { audit: 'Vacated' });
      toast.success('Room vacated.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Hostel Residents" subtitle="Hostel student records, room allocation and provisions issued" />
      <div className="grid cols-4 stats">
        <StatCard label="Hostels" value={hostels.length} icon={Building} />
        <StatCard label="Rooms / beds" value={`${rooms.length} / ${beds}`} icon={BedDouble} tone="blue" />
        <StatCard label="Residents" value={residents} icon={Users} tone="violet" />
        <StatCard label="Occupancy" value={`${pct(residents, beds)}%`} icon={Percent} tone="green" />
      </div>
      <div className="grid cols-2 mb-16">
        {hostels.map((h) => {
          const rs = rooms.filter((r) => r.hostelId === h.id);
          const cap = sum(rs.map((r) => r.capacity));
          const o = sum(rs.map((r) => occ(r.id)));
          return (
            <Card key={h.id} title={h.name} subtitle={`${h.type} · Warden ${h.warden}`}>
              <div className="meter-label">
                <span>
                  {o} of {cap} beds occupied
                </span>
                <span>{pct(o, cap)}%</span>
              </div>
              <ProgressBar value={pct(o, cap)} tone="navy" />
            </Card>
          );
        })}
      </div>
      <UrlTabs
        tabs={[
          { id: 'residents', label: 'Residents & provisions' },
          { id: 'rooms', label: 'Rooms' },
          { id: 'hostels', label: 'Hostels' },
        ]}
      >
        {(t) =>
          t === 'residents' ? (
            <EntityPage
              config={{
                collection: 'hostelAllocations',
                title: 'Hostel residents',
                singular: 'Resident',
                module: 'hostel',
                noDeactivate: true,
                rowFilter: (r) => allocs.some((a) => a.id === r.id),
                defaults: () => ({ status: 'Allocated', fromDate: todayISO(), provisions: [] }),
                beforeSave: (f, prev, d) => {
                  const st = d.students.find((s) => s.id === f.studentId);
                  return {
                    ...f,
                    hostelId: d.hostelRooms.find((r) => r.id === f.roomId)?.hostelId,
                    guardianName: f.guardianName || st?.parentName,
                    guardianPhone: f.guardianPhone || st?.parentPhone,
                  };
                },
                afterSave: async (rec, isNew) => {
                  if (isNew) await update('students', rec.studentId, { hosteller: true }, { audit: false }).catch(() => {});
                },
                rowActions: (r) =>
                  can('hostel', 'edit') && r.status === 'Allocated' ? (
                    <Button size="sm" variant="ghost" icon={LogOut} onClick={() => vacate(r)}>
                      Vacate
                    </Button>
                  ) : null,
                fields: [
                  {
                    key: 'studentId',
                    label: 'Student',
                    type: 'ref',
                    ref: 'students',
                    required: true,
                    refFilter: (s) => s.status === 'Active',
                    validate: (v, f, d) =>
                      d.hostelAllocations.some((a) => a.id !== f.id && a.studentId === v && a.status === 'Allocated') ? 'Student already has a room' : undefined,
                  },
                  {
                    key: 'roomId',
                    label: 'Room',
                    type: 'ref',
                    ref: 'hostelRooms',
                    required: true,
                    filter: true,
                    refFilter: (r, f, d) => {
                      const s = d.students.find((x) => x.id === f.studentId);
                      const h = d.hostels.find((x) => x.id === r.hostelId);
                      return mine(r.hostelId) && (!s || (h?.type === 'Boys') === (s.gender === 'Male'));
                    },
                    validate: (v, f, d) => {
                      const r = d.hostelRooms.find((x) => x.id === v);
                      const n = d.hostelAllocations.filter((a) => a.roomId === v && a.status === 'Allocated' && a.id !== f.id).length;
                      return r && n >= r.capacity ? `Room is full (${n}/${r.capacity})` : undefined;
                    },
                  },
                  { key: 'bedNo', label: 'Bed', type: 'number', min: 1, max: 8 },
                  { key: 'fromDate', label: 'From', type: 'date', required: true },
                  { key: 'toDate', label: 'To', type: 'date', table: false },
                  { key: 'provisions', label: 'Provisions issued', type: 'multiselect', options: PROVISIONS, table: false },
                  { key: 'provCount', label: 'Provisions', form: false, value: (r) => `${(r.provisions ?? []).length}/${PROVISIONS.length}` },
                  { key: 'guardianName', label: 'Local guardian', table: false, hint: 'Defaults to the parent on the student record' },
                  { key: 'guardianPhone', label: 'Guardian mobile', type: 'tel', table: false },
                  { key: 'emergencyContact', label: 'Emergency contact', type: 'tel', table: false },
                  { key: 'status', label: 'Status', type: 'select', options: ['Allocated', 'Vacated'], filter: true, render: (r) => <Badge>{r.status}</Badge> },
                ],
              }}
            />
          ) : t === 'rooms' ? (
            <EntityPage
              config={{
                collection: 'hostelRooms',
                title: 'Hostel rooms',
                singular: 'Room',
                module: 'hostel',
                rowFilter: (r) => mine(r.hostelId),
                fields: [
                  { key: 'hostelId', label: 'Hostel', type: 'ref', ref: 'hostels', required: true, filter: true },
                  { key: 'roomNo', label: 'Room no', required: true },
                  { key: 'type', label: 'Type', required: true, filter: true },
                  { key: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 8, required: true },
                  {
                    key: 'occ',
                    label: 'Occupied',
                    form: false,
                    value: (r) => occ(r.id),
                    render: (r) => (
                      <Badge tone={occ(r.id) >= r.capacity ? 'amber' : 'green'}>
                        {occ(r.id)}/{r.capacity}
                      </Badge>
                    ),
                  },
                  { key: 'fee', label: 'Annual fee', type: 'money', min: 0, required: true },
                ],
              }}
            />
          ) : (
            <EntityPage
              config={{
                collection: 'hostels',
                title: 'Hostels',
                singular: 'Hostel',
                module: 'hostel',
                fields: [
                  { key: 'name', label: 'Name', required: true, unique: true },
                  { key: 'type', label: 'Type', type: 'select', options: ['Boys', 'Girls'], required: true },
                  { key: 'warden', label: 'Warden', required: true },
                  { key: 'wardenEmployeeId', label: 'Warden employee record', type: 'ref', ref: 'employees', table: false },
                  { key: 'floors', label: 'Floors', type: 'number', min: 1, max: 20, required: true },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
