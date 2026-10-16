import { LogOut } from 'lucide-react';
import { BedDouble, Building, Users, Percent } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, StatCard, useConfirm, useToast } from '../../components/ui';
import { fmtDate, fmtMoney, pct, sum, todayISO } from '../../lib/utils';
export default function Hostel() {
  const { db, can, update } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const occ = (roomId) => db.hostelAllocations.filter((a) => a.roomId === roomId && a.status === 'Allocated').length;
  const beds = sum(db.hostelRooms.filter((r) => r.active !== false).map((r) => r.capacity));
  const occupied = db.hostelAllocations.filter((a) => a.status === 'Allocated').length;
  if (scope.personal) {
    const a = db.hostelAllocations.find((x) => scope.linked.includes(x.studentId) && x.status === 'Allocated');
    const room = a && db.hostelRooms.find((r) => r.id === a.roomId);
    const h = room && db.hostels.find((x) => x.id === room.hostelId);
    return (
      <>
        <PageHeader title="Hostel" subtitle="Your hostel accommodation" />
        <Card>
          {!a ? (
            <EmptyState icon={BedDouble} title="No hostel allocation" message="Contact the hostel office to apply for accommodation." />
          ) : (
            <dl className="grid cols-4">
              <div>
                <dt className="xs muted">Hostel</dt>
                <dd className="strong">{h?.name}</dd>
              </div>
              <div>
                <dt className="xs muted">Room</dt>
                <dd className="strong">
                  {room?.roomNo} ({room?.type})
                </dd>
              </div>
              <div>
                <dt className="xs muted">Warden</dt>
                <dd className="strong">{h?.warden}</dd>
              </div>
              <div>
                <dt className="xs muted">Annual fee</dt>
                <dd className="strong">{fmtMoney(room?.fee)}</dd>
              </div>
              <div>
                <dt className="xs muted">Since</dt>
                <dd className="strong">{fmtDate(a.fromDate)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </>
    );
  }
  const vacate = async (r) => {
    if (
      !(await confirm({
        title: 'Vacate room?',
        message: `Mark ${labelOf(db, 'students', r.studentId)} as vacated?`,
        confirmLabel: 'Vacate',
      }))
    )
      return;
    try {
      await update('hostelAllocations', r.id, { status: 'Vacated', toDate: todayISO() }, { audit: 'Vacated' });
      toast.success('Room vacated.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Hostel Management" subtitle="Buildings, rooms, capacity, occupancy and student allocations" />
      <div className="grid cols-4 stats">
        <StatCard label="Hostels" value={db.hostels.length} icon={Building} />
        <StatCard label="Rooms / beds" value={`${db.hostelRooms.length} / ${beds}`} icon={BedDouble} tone="blue" />
        <StatCard label="Residents" value={occupied} icon={Users} tone="violet" />
        <StatCard label="Occupancy" value={`${pct(occupied, beds)}%`} icon={Percent} tone="green" />
      </div>
      <div className="grid cols-2 mb-16">
        {db.hostels.map((h) => {
          const rooms = db.hostelRooms.filter((r) => r.hostelId === h.id);
          const cap = sum(rooms.map((r) => r.capacity)),
            o = sum(rooms.map((r) => occ(r.id)));
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
          { id: 'alloc', label: 'Allocations' },
          { id: 'rooms', label: 'Rooms' },
          { id: 'hostels', label: 'Hostels' },
        ]}
      >
        {(t) =>
          t === 'alloc' ? (
            <EntityPage
              config={{
                collection: 'hostelAllocations',
                title: 'Hostel allocations',
                singular: 'Allocation',
                module: 'hostel',
                noDeactivate: true,
                defaults: () => ({ status: 'Allocated', fromDate: todayISO() }),
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
                    validate: (v, f, d) =>
                      d.hostelAllocations.some((a) => a.id !== f.id && a.studentId === v && a.status === 'Allocated')
                        ? 'Student already has a room'
                        : undefined,
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
                      return !s || (h?.type === 'Boys') === (s.gender === 'Male');
                    },
                    validate: (v, f, d) => {
                      const r = d.hostelRooms.find((x) => x.id === v);
                      const n = d.hostelAllocations.filter((a) => a.roomId === v && a.status === 'Allocated' && a.id !== f.id).length;
                      return r && n >= r.capacity ? `Room is full (${n}/${r.capacity})` : undefined;
                    },
                  },
                  { key: 'fromDate', label: 'From', type: 'date', required: true },
                  { key: 'toDate', label: 'To', type: 'date' },
                  {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Allocated', 'Vacated'],
                    filter: true,
                    render: (r) => <Badge>{r.status}</Badge>,
                  },
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
