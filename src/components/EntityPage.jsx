import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, RotateCcw, Ban, Trash2 } from 'lucide-react';
import { findUsage } from '../data/refs';
import { useData } from '../data/store';
import { useScope } from '../data/scope';
import { labelOf, options as refOptions } from '../data/labels';
import { fmtDate, fmtMoney } from '../lib/utils';
import { DataTable } from './DataTable';
import { Badge, Button, Field, Input, Modal, Select, Textarea, useConfirm, useToast } from './ui';
export function EntityPage({ config }) {
  const { db, can, create, update, deactivate, restore, remove, ayId } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editable = can(config.module, 'edit');
  const allowCreate = editable && config.canCreate !== false;
  const rows = useMemo(() => {
    let r = db[config.collection];
    if (config.ayFiltered) r = r.filter((x) => !x.academicYearId || x.academicYearId === ayId);
    if (config.rowFilter) r = r.filter((x) => config.rowFilter(x, { scope, db, ayId }));
    return r;
  }, [db, config, scope, ayId]);
  const display = (f, row) => {
    if (f.render) return f.render(row, db);
    // Computed columns (no stored field) display their value() result.
    const v = row[f.key] === undefined && f.value ? f.value(row, db) : row[f.key];
    if (v === undefined || v === null || v === '') return '—';
    switch (f.type) {
      case 'ref':
        return labelOf(db, f.ref, v);
      case 'multiref':
        return v.map((id) => labelOf(db, f.ref, id)).join(', ') || '—';
      case 'multiselect':
        return v.map((o) => (f.optionLabel ? f.optionLabel(o) : o)).join(', ') || '—';
      case 'date':
        return fmtDate(v);
      case 'money':
        return fmtMoney(v);
      case 'checkbox':
        return v ? 'Yes' : 'No';
      case 'url':
        return (
          <a href={v} target="_blank" rel="noreferrer">
            {v}
          </a>
        );
    }
    if (f.key === 'status' || f.key === 'priority') return <Badge>{v}</Badge>;
    return String(v);
  };
  const plain = (f, row) => {
    if (f.value) return f.value(row, db);
    const v = row[f.key];
    if (f.type === 'ref') return labelOf(db, f.ref, v);
    if (f.type === 'multiref') return (v ?? []).map((id) => labelOf(db, f.ref, id)).join('; ');
    if (f.type === 'multiselect' || Array.isArray(v)) return (v ?? []).join('; ');
    if (f.type === 'checkbox') return v ? 'Yes' : 'No';
    return v;
  };
  const columns = config.fields
    .filter((f) => f.table !== false)
    .map((f) => ({
      key: f.key,
      header: f.label,
      render: (r) => display(f, r),
      value: (r) => plain(f, r),
      className: f.type === 'number' || f.type === 'money' ? 'text-right' : undefined,
    }));
  const filters = config.fields
    .filter((f) => f.filter)
    .map((f) => ({
      key: f.key,
      label: f.label,
      options:
        f.type === 'ref'
          ? refOptions(db, f.ref)
          : (f.options ?? [...new Set(rows.map((r) => String(r[f.key] ?? '')).filter(Boolean))].sort()).map((o) => ({
              value: String(o),
              label: String(o),
            })),
      match: (r, v) => (f.type === 'multiref' || f.type === 'multiselect' ? (r[f.key] ?? []).includes(v) : String(r[f.key] ?? '') === v),
    }));
  const openNew = () => {
    const init = {};
    config.fields.forEach((f) => {
      if (f.default !== undefined) init[f.key] = typeof f.default === 'function' ? f.default() : f.default;
      else if (f.type === 'multiref' || f.type === 'multiselect') init[f.key] = [];
      else if (f.type === 'checkbox') init[f.key] = false;
    });
    Object.assign(init, config.defaults?.({ ayId, db, scope }));
    setForm(init);
    setErrors({});
    setEditing({});
  };
  const openEdit = (r) => {
    setForm({ ...r });
    setErrors({});
    setEditing(r);
  };
  const validate = () => {
    const e = {};
    config.fields
      .filter((f) => f.form !== false && !f.readOnly)
      .forEach((f) => {
        const v = form[f.key];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
        if (f.required && empty) {
          e[f.key] = `${f.label} is required`;
          return;
        }
        if (empty) return;
        if ((f.type === 'number' || f.type === 'money') && isNaN(Number(v))) e[f.key] = 'Enter a valid number';
        else if (f.min !== undefined && Number(v) < f.min) e[f.key] = `Minimum is ${f.min}`;
        else if (f.max !== undefined && Number(v) > f.max) e[f.key] = `Maximum is ${f.max}`;
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) e[f.key] = 'Enter a valid email address';
        if (f.type === 'tel' && !/^[0-9+\-\s]{7,15}$/.test(v)) e[f.key] = 'Enter a valid phone number';
        if (
          f.unique &&
          db[config.collection].some((r) => r.id !== editing?.id && String(r[f.key]).toLowerCase() === String(v).toLowerCase())
        )
          e[f.key] = `${f.label} already exists`;
        const custom = f.validate?.(v, form, db);
        if (custom) e[f.key] = custom;
      });
    setErrors(e);
    return !Object.keys(e).length;
  };
  const save = async () => {
    if (!validate()) {
      toast.error('Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      let data = {};
      config.fields
        .filter((f) => f.form !== false)
        .forEach((f) => {
          let v = form[f.key];
          if ((f.type === 'number' || f.type === 'money') && v !== '' && v !== undefined) v = Number(v);
          if (v === '') v = undefined;
          data[f.key] = v;
        });
      // keep non-form defaults (e.g. academicYearId) on create
      if (!editing?.id) data = { ...config.defaults?.({ ayId, db, scope }), ...data };
      if (config.beforeSave) data = config.beforeSave(data, editing?.id ? editing : null, db);
      Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
      if (editing?.id) {
        await update(config.collection, editing.id, data);
        await config.afterSave?.({ ...editing, ...data }, false);
        toast.success(`${config.singular} updated successfully.`);
      } else {
        const rec = await create(config.collection, data);
        await config.afterSave?.(rec, true);
        toast.success(`${config.singular} created successfully.`);
      }
      setEditing(null);
    } catch (e) {
      toast.error(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (r) => {
    const deact = r.active !== false;
    const ok = await confirm({
      title: deact ? `Deactivate ${config.singular.toLowerCase()}?` : `Reactivate ${config.singular.toLowerCase()}?`,
      message: deact
        ? 'The record will be hidden from active lists but kept for history and audit. You can reactivate it later.'
        : 'The record will become active again.',
      confirmLabel: deact ? 'Deactivate' : 'Reactivate',
      tone: deact ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      await (deact ? deactivate(config.collection, r.id) : restore(config.collection, r.id));
      toast.success(`${config.singular} ${deact ? 'deactivated' : 'reactivated'}.`);
    } catch (e) {
      toast.error(e?.message ?? 'Action failed');
    }
  };
  const canDelete = (r) => editable && !config.noDelete && (config.canEditRow?.(r) ?? true) && (config.canDeleteRow?.(r) ?? true);
  const del = async (r) => {
    const name = r.name ?? r.title ?? r.code ?? r.invoiceNo ?? r.appNo ?? r.assetId ?? r.regNo ?? config.singular;
    const usage = findUsage(db, config.collection, r.id);
    if (usage.length) {
      const canDeact = !config.noDeactivate && r.active !== false;
      const ok = await confirm({
        title: `Cannot delete ${config.singular.toLowerCase()}`,
        message: `“${name}” is still used by ${usage.join(', ')}. Remove or reassign those first${canDeact ? ', or deactivate this record to keep its history' : ''}.`,
        confirmLabel: canDeact ? 'Deactivate instead' : 'OK',
        cancelLabel: 'Close',
        tone: 'primary',
      });
      if (ok && canDeact) {
        try {
          await deactivate(config.collection, r.id);
          toast.success(`${config.singular} deactivated.`);
        } catch (e) {
          toast.error(e?.message ?? 'Action failed');
        }
      }
      return;
    }
    const ok = await confirm({
      title: `Delete ${config.singular.toLowerCase()}?`,
      message: `“${name}” will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove(config.collection, r.id, { details: String(name) });
      setViewing(null);
      toast.success(`${config.singular} deleted.`);
    } catch (e) {
      toast.error(e?.message ?? 'Delete failed');
    }
  };
  const renderInput = (f) => {
    const v = form[f.key];
    const err = !!errors[f.key];
    const set = (val) => setForm((s) => ({ ...s, [f.key]: val }));
    const dis = f.readOnly;
    const ph = f.placeholder ?? (['date', 'checkbox'].includes(f.type) ? undefined : `Enter ${f.label.toLowerCase()}`);
    switch (f.type) {
      case 'textarea':
        return (
          <Textarea value={Array.isArray(v) ? v.join('\n') : (v ?? '')} onChange={(e) => set(e.target.value)} error={err} disabled={dis} placeholder={ph} />
        );
      case 'select':
        return (
          <Select value={v ?? ''} onChange={(e) => set(e.target.value)} error={err} disabled={dis}>
            <option value="">Select…</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        );
      case 'ref':
        return (
          <Select value={v ?? ''} onChange={(e) => set(e.target.value)} error={err} disabled={dis}>
            <option value="">Select…</option>
            {refOptions(db, f.ref, f.refFilter ? (r) => f.refFilter(r, form, db) : undefined).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        );
      case 'multiref': {
        const opts = refOptions(db, f.ref, f.refFilter ? (r) => f.refFilter(r, form, db) : undefined);
        const sel = v ?? [];
        return (
          <div className={`check-box ${err ? 'error' : ''}`}>
            {opts.map((o) => (
              <label key={o.value} className="check-row">
                <input
                  type="checkbox"
                  checked={sel.includes(o.value)}
                  disabled={dis}
                  onChange={(e) => set(e.target.checked ? [...sel, o.value] : sel.filter((x) => x !== o.value))}
                  className="checkbox"
                />
                {o.label}
              </label>
            ))}
            {!opts.length && <span className="xs muted">No options</span>}
          </div>
        );
      }
      case 'multiselect': {
        const sel = v ?? [];
        return (
          <div className={`check-box two ${err ? 'error' : ''}`}>
            {f.options.map((o) => (
              <label key={o} className="check-row">
                <input
                  type="checkbox"
                  checked={sel.includes(o)}
                  disabled={dis}
                  onChange={(e) => set(e.target.checked ? [...sel, o] : sel.filter((x) => x !== o))}
                  className="checkbox"
                />
                {f.optionLabel ? f.optionLabel(o) : o}
              </label>
            ))}
          </div>
        );
      }
      case 'checkbox':
        return <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} disabled={dis} className="checkbox" />;
      default:
        return (
          <Input
            type={f.type === 'money' ? 'number' : (f.type ?? 'text')}
            value={v ?? ''}
            onChange={(e) => set(e.target.value)}
            error={err}
            min={f.min}
            max={f.max}
            disabled={dis}
            step={f.type === 'number' || f.type === 'money' ? 'any' : undefined}
            placeholder={ph}
          />
        );
    }
  };
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        filters={filters}
        title={config.title}
        showInactiveToggle={!config.noDeactivate}
        initialSort={config.initialSort}
        onRowClick={(r) => setViewing(r)}
        emptyMessage={
          config.emptyMessage ?? (allowCreate ? `Create the first ${config.singular.toLowerCase()} to get started.` : undefined)
        }
        emptyAction={
          allowCreate ? (
            <Button icon={Plus} onClick={openNew}>
              Add {config.singular}
            </Button>
          ) : undefined
        }
        toolbar={
          <>
            {config.toolbar}
            {allowCreate && (
              <Button size="sm" icon={Plus} onClick={openNew}>
                Add {config.singular}
              </Button>
            )}
          </>
        }
        actions={(r) => (
          <>
            {config.rowActions?.(r)}
            <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(r)} aria-label="View" title="View" />
            {editable && (config.canEditRow?.(r) ?? true) && (
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(r)} aria-label="Edit" title="Edit" />
            )}
            {editable && !config.noDeactivate && (config.canEditRow?.(r) ?? true) && (
              <Button
                size="sm"
                variant="ghost"
                icon={r.active === false ? RotateCcw : Ban}
                onClick={() => toggleActive(r)}
                aria-label={r.active === false ? 'Reactivate' : 'Deactivate'}
                title={r.active === false ? 'Reactivate' : 'Deactivate'}
                className={r.active === false ? '' : 'danger'}
              />
            )}
            {canDelete(r) && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => del(r)}
                aria-label="Delete"
                title="Delete"
                className="danger"
              />
            )}
          </>
        )}
      />
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${config.singular}` : `New ${config.singular}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing?.id ? 'Save changes' : `Create ${config.singular}`}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="form-grid"
          noValidate
        >
          {config.fields
            .filter((f) => f.form !== false)
            .map((f) => (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                error={errors[f.key]}
                hint={f.hint}
                className={f.wide || f.type === 'textarea' || f.type === 'multiref' || f.type === 'multiselect' ? 'full' : ''}
              >
                {renderInput(f)}
              </Field>
            ))}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`${config.singular} details`}
        size="lg"
        footer={
          <>
            {viewing && canDelete(viewing) && (
              <Button variant="ghost" icon={Trash2} className="left bad" onClick={() => del(viewing)}>
                Delete
              </Button>
            )}
            {editable && viewing && (config.canEditRow?.(viewing) ?? true) && (
              <Button
                variant="secondary"
                icon={Pencil}
                onClick={() => {
                  openEdit(viewing);
                  setViewing(null);
                }}
              >
                Edit
              </Button>
            )}
            <Button onClick={() => setViewing(null)}>Close</Button>
          </>
        }
      >
        {viewing && (
          <dl className="details">
            {config.fields.map((f) => (
              <div key={f.key} className={f.wide || f.type === 'textarea' ? 'full' : ''}>
                <dt>{f.label}</dt>
                <dd>{display(f, viewing)}</dd>
              </div>
            ))}
            <div>
              <dt>Record status</dt>
              <dd>
                <Badge>{viewing.active === false ? 'Inactive' : 'Active'}</Badge>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{fmtDate(viewing.updatedAt)}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </>
  );
}
