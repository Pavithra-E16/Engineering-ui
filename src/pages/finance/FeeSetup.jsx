import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../../data/store';
import { findUsage } from '../../data/refs';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { categoryOf } from '../../lib/domain';
import { fmtMoney, sum } from '../../lib/utils';

const subtotal = (db, fs, cat) => sum(fs.items.filter((i) => !cat || categoryOf(db, i.feeHeadId) === cat).map((i) => i.amount));

function StructureForm({ fs, onClose }) {
  const { db, ayId, create, update } = useData();
  const toast = useToast();
  const heads = db.feeHeads.filter((h) => h.active !== false && !h.hostelOnly);
  const [f, setF] = useState(() => ({
    name: fs?.name ?? '',
    programId: fs?.programId ?? '',
    academicYearId: fs?.academicYearId ?? ayId,
    amounts: Object.fromEntries(heads.map((h) => [h.id, String(fs?.items.find((i) => i.feeHeadId === h.id)?.amount ?? '')])),
  }));
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.name.trim() || !f.programId) return setErr('Name and program are required.');
    const items = heads.filter((h) => Number(f.amounts[h.id]) > 0).map((h) => ({ feeHeadId: h.id, amount: Number(f.amounts[h.id]) }));
    if (!items.length) return setErr('Enter an amount for at least one fee head.');
    if (db.feeStructures.some((x) => x.id !== fs?.id && x.programId === f.programId && x.academicYearId === f.academicYearId))
      return setErr('A fee structure already exists for this program and academic year.');
    try {
      const data = { name: f.name.trim(), programId: f.programId, academicYearId: f.academicYearId, items };
      if (fs?.id) await update('feeStructures', fs.id, data);
      else await create('feeStructures', data);
      toast.success('Fee structure saved.');
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  const total = (cat) => sum(heads.filter((h) => !cat || h.category === cat).map((h) => Number(f.amounts[h.id]) || 0));
  return (
    <Modal
      open
      onClose={onClose}
      title={fs?.id ? 'Edit fee structure' : 'New fee structure'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Name" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Program" required>
            <Select value={f.programId} onChange={(e) => setF({ ...f, programId: e.target.value })}>
              <option value="">Select…</option>
              {options(db, 'programs').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Academic year" required>
            <Select value={f.academicYearId} onChange={(e) => setF({ ...f, academicYearId: e.target.value })}>
              {db.academicYears.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {['Internal', 'External'].map((cat) => (
          <div key={cat}>
            <h4 className="mb-8">
              {cat} fees <span className="muted small">· {cat === 'Internal' ? 'retained by the college' : 'collected for the university / examination board'}</span>
            </h4>
            <div className="form-grid">
              {heads
                .filter((h) => h.category === cat)
                .map((h) => (
                  <Field key={h.id} label={`${h.name} (₹)`} hint={h.oneTime ? 'Charged in the first year only' : undefined}>
                    <Input type="number" min={0} value={f.amounts[h.id]} onChange={(e) => setF({ ...f, amounts: { ...f.amounts, [h.id]: e.target.value } })} />
                  </Field>
                ))}
            </div>
          </div>
        ))}
        <p className="muted">
          Internal {fmtMoney(total('Internal'))} + External {fmtMoney(total('External'))} = <b>{fmtMoney(total())}</b>. Hostel fee is charged per room
          (Hostel → Rooms).
        </p>
      </div>
    </Modal>
  );
}

export default function FeeSetup() {
  const { db, ayId, can, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(undefined);
  const edit = can('fee-setup', 'edit');
  const del = async (fs) => {
    const usage = findUsage(db, 'feeStructures', fs.id);
    if (usage.length) return toast.error(`Cannot delete: used by ${usage.join(', ')}.`);
    if (!(await confirm({ title: 'Delete fee structure?', message: `Delete “${fs.name}”?`, confirmLabel: 'Delete' }))) return;
    try {
      await remove('feeStructures', fs.id, { details: fs.name });
      toast.success('Fee structure deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Fee Heads & Structures" subtitle="Internal college fees and external (university / examination) fees, categorised separately" />
      <UrlTabs
        tabs={[
          { id: 'structures', label: 'Fee structures' },
          { id: 'heads', label: 'Fee heads' },
        ]}
      >
        {(t) =>
          t === 'heads' ? (
            <EntityPage
              config={{
                collection: 'feeHeads',
                title: 'Fee heads',
                singular: 'Fee Head',
                module: 'fee-setup',
                fields: [
                  { key: 'code', label: 'Code', required: true, unique: true },
                  { key: 'name', label: 'Name', required: true, unique: true },
                  {
                    key: 'category',
                    label: 'Category',
                    type: 'select',
                    options: ['Internal', 'External'],
                    required: true,
                    filter: true,
                    hint: 'External = collected on behalf of the university / examination board',
                    render: (r) => <Badge>{r.category}</Badge>,
                  },
                  { key: 'remitTo', label: 'Remitted to', hint: 'External fees only, e.g. JNTU Kakinada' },
                  { key: 'oneTime', label: 'First year only', type: 'checkbox' },
                  { key: 'hostelOnly', label: 'Hostellers only', type: 'checkbox' },
                ],
              }}
            />
          ) : (
            <DataTable
              title="Fee structures"
              rows={db.feeStructures.filter((f) => f.academicYearId === ayId)}
              toolbar={
                edit && (
                  <Button size="sm" icon={Plus} onClick={() => setForm(null)}>
                    Add fee structure
                  </Button>
                )
              }
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'program', header: 'Program', value: (r) => labelOf(db, 'programs', r.programId) },
                ...db.feeHeads
                  .filter((h) => !h.hostelOnly)
                  .map((h) => ({
                    key: h.id,
                    header: h.code,
                    value: (r) => r.items.find((i) => i.feeHeadId === h.id)?.amount ?? 0,
                    render: (r) => fmtMoney(r.items.find((i) => i.feeHeadId === h.id)?.amount ?? 0),
                    className: 'text-right',
                  })),
                { key: 'int', header: 'Internal', value: (r) => subtotal(db, r, 'Internal'), render: (r) => fmtMoney(subtotal(db, r, 'Internal')), className: 'text-right' },
                { key: 'ext', header: 'External', value: (r) => subtotal(db, r, 'External'), render: (r) => fmtMoney(subtotal(db, r, 'External')), className: 'text-right' },
                { key: 'total', header: 'Total', value: (r) => subtotal(db, r), render: (r) => <b>{fmtMoney(subtotal(db, r))}</b>, className: 'text-right' },
              ]}
              actions={
                edit
                  ? (r) => (
                      <>
                        <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => setForm(r)} />
                        <Button size="sm" variant="ghost" icon={Trash2} className="danger" title="Delete" onClick={() => del(r)} />
                      </>
                    )
                  : undefined
              }
            />
          )
        }
      </UrlTabs>
      {form !== undefined && <StructureForm fs={form} onClose={() => setForm(undefined)} />}
    </>
  );
}
