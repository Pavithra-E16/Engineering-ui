import { useMemo, useState } from 'react';
import { useData } from '../../data/store';
import { DataTable } from '../../components/DataTable';
import { Badge, Field, Input, PageHeader } from '../../components/ui';
import { ROLES, roleLabel } from '../../lib/roles';
import { fmtDateTime } from '../../lib/utils';
export default function AuditLogs() {
  const { db } = useData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rows = useMemo(
    () => db.auditLogs.filter((l) => (!from || l.createdAt.slice(0, 10) >= from) && (!to || l.createdAt.slice(0, 10) <= to)),
    [db.auditLogs, from, to],
  );
  const entities = [...new Set(db.auditLogs.map((l) => l.entity))].sort();
  const actions = [...new Set(db.auditLogs.map((l) => l.action))].sort();
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Append-only record of sign-ins and important administrative actions" />
      <div className="filter-bar">
        <Field label="From" className="w-sm">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" className="w-sm">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <DataTable
        title="Audit log"
        rows={rows}
        pageSize={25}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        emptyMessage="Actions such as sign-in, record creation, updates, approvals and publications are logged here."
        filters={[
          { key: 'role', label: 'Role', options: ROLES.map((r) => ({ value: r.id, label: r.label })), match: (r, v) => r.role === v },
          { key: 'entity', label: 'Entity', options: entities.map((e) => ({ value: e, label: e })), match: (r, v) => r.entity === v },
          { key: 'action', label: 'Action', options: actions.map((e) => ({ value: e, label: e })), match: (r, v) => r.action === v },
        ]}
        columns={[
          { key: 'createdAt', header: 'Timestamp', render: (r) => fmtDateTime(r.createdAt) },
          { key: 'userName', header: 'User' },
          { key: 'role', header: 'Role', value: (r) => roleLabel(r.role), render: (r) => <Badge tone="navy">{roleLabel(r.role)}</Badge> },
          { key: 'action', header: 'Action' },
          { key: 'entity', header: 'Entity' },
          { key: 'details', header: 'Details' },
          { key: 'entityId', header: 'Record ID', className: 'mono' },
        ]}
      />
    </>
  );
}
