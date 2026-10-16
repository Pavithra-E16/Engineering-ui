import { Bus, Route as RouteIcon, Users, Wrench } from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Card, EmptyState, PageHeader, ProgressBar, StatCard } from '../../components/ui';
import { fmtMoney, pct } from '../../lib/utils';
export default function Transport() {
  const { db } = useData();
  const scope = useScope();
  const riders = (routeId) => db.transportAllocations.filter((a) => a.routeId === routeId && a.status === 'Active').length;
  const cap = (routeId) => db.vehicles.find((v) => v.id === db.routes.find((r) => r.id === routeId)?.vehicleId)?.capacity ?? 0;
  if (scope.personal) {
    const a = db.transportAllocations.find((x) => scope.linked.includes(x.studentId) && x.status === 'Active');
    const r = a && db.routes.find((x) => x.id === a.routeId);
    const v = r && db.vehicles.find((x) => x.id === r.vehicleId);
    return (
      <>
        <PageHeader title="Transport" subtitle="Your bus route" />
        <Card>
          {!a ? (
            <EmptyState icon={Bus} title="No transport allocation" message="Contact the transport office to register for a route." />
          ) : (
            <dl className="grid cols-4">
              <div>
                <dt className="xs muted">Route</dt>
                <dd className="strong">
                  {r?.code} – {r?.name}
                </dd>
              </div>
              <div>
                <dt className="xs muted">Boarding stop</dt>
                <dd className="strong">{a.stop}</dd>
              </div>
              <div>
                <dt className="xs muted">Vehicle</dt>
                <dd className="strong">{v?.regNo}</dd>
              </div>
              <div>
                <dt className="xs muted">Driver</dt>
                <dd className="strong">
                  {v?.driver} · {v?.driverPhone}
                </dd>
              </div>
              <div>
                <dt className="xs muted">Annual fee</dt>
                <dd className="strong">{fmtMoney(r?.fee)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </>
    );
  }
  const totalRiders = db.transportAllocations.filter((a) => a.status === 'Active').length;
  return (
    <>
      <PageHeader title="Transport Management" subtitle="Vehicles, routes, stops, capacity and student allocations" />
      <div className="grid cols-4 stats">
        <StatCard label="Vehicles" value={db.vehicles.length} icon={Bus} />
        <StatCard label="Routes" value={db.routes.length} icon={RouteIcon} tone="blue" />
        <StatCard label="Students using transport" value={totalRiders} icon={Users} tone="violet" />
        <StatCard
          label="Under maintenance"
          value={db.vehicles.filter((v) => v.status === 'Maintenance').length}
          icon={Wrench}
          tone="amber"
        />
      </div>
      <Card title="Route utilisation" className="mb-16">
        <div className="grid cols-3 gap-sm">
          {db.routes.map((r) => (
            <div key={r.id}>
              <div className="meter-label">
                <span>
                  {r.code} · {r.name}
                </span>
                <span>
                  {riders(r.id)}/{cap(r.id)}
                </span>
              </div>
              <ProgressBar value={pct(riders(r.id), cap(r.id))} tone="navy" />
            </div>
          ))}
        </div>
      </Card>
      <UrlTabs
        tabs={[
          { id: 'alloc', label: 'Student allocations' },
          { id: 'routes', label: 'Routes & stops' },
          { id: 'vehicles', label: 'Vehicles' },
        ]}
      >
        {(t) =>
          t === 'alloc' ? (
            <EntityPage
              config={{
                collection: 'transportAllocations',
                title: 'Transport allocations',
                singular: 'Allocation',
                module: 'transport',
                defaults: () => ({ status: 'Active' }),
                fields: [
                  {
                    key: 'studentId',
                    label: 'Student',
                    type: 'ref',
                    ref: 'students',
                    required: true,
                    validate: (v, f, d) =>
                      d.transportAllocations.some((a) => a.id !== f.id && a.studentId === v && a.status === 'Active')
                        ? 'Student already has an active route'
                        : undefined,
                  },
                  {
                    key: 'routeId',
                    label: 'Route',
                    type: 'ref',
                    ref: 'routes',
                    required: true,
                    filter: true,
                    validate: (v, f, d) => {
                      const n = d.transportAllocations.filter((a) => a.routeId === v && a.status === 'Active' && a.id !== f.id).length;
                      const c = cap(v);
                      return c && n >= c ? `Route vehicle is full (${n}/${c})` : undefined;
                    },
                  },
                  {
                    key: 'stop',
                    label: 'Boarding stop',
                    required: true,
                    hint: 'Must be one of the route stops',
                    validate: (v, f, d) => {
                      const r = d.routes.find((x) => x.id === f.routeId);
                      return r &&
                        !r.stops
                          .split(',')
                          .map((s) => s.trim().toLowerCase())
                          .includes(String(v).trim().toLowerCase())
                        ? `Stops on this route: ${r.stops}`
                        : undefined;
                    },
                  },
                  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Cancelled'], required: true, filter: true },
                ],
              }}
            />
          ) : t === 'routes' ? (
            <EntityPage
              config={{
                collection: 'routes',
                title: 'Routes',
                singular: 'Route',
                module: 'transport',
                fields: [
                  { key: 'code', label: 'Code', required: true, unique: true },
                  { key: 'name', label: 'Name', required: true },
                  { key: 'vehicleId', label: 'Vehicle', type: 'ref', ref: 'vehicles', required: true },
                  { key: 'stops', label: 'Stops (comma separated)', type: 'textarea', required: true },
                  { key: 'distanceKm', label: 'Distance (km)', type: 'number', min: 1, required: true },
                  { key: 'fee', label: 'Annual fee', type: 'money', min: 0, required: true },
                  { key: 'riders', label: 'Riders', form: false, value: (r) => `${riders(r.id)}/${cap(r.id)}` },
                ],
              }}
            />
          ) : (
            <EntityPage
              config={{
                collection: 'vehicles',
                title: 'Vehicles',
                singular: 'Vehicle',
                module: 'transport',
                fields: [
                  { key: 'regNo', label: 'Registration no', required: true, unique: true },
                  { key: 'type', label: 'Type', required: true },
                  { key: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 80, required: true },
                  { key: 'driver', label: 'Driver', required: true },
                  { key: 'driverPhone', label: 'Driver phone', type: 'tel', required: true },
                  { key: 'status', label: 'Status', type: 'select', options: ['In Service', 'Maintenance'], required: true, filter: true },
                ],
              }}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
