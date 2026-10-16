import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Filter, Printer, Search, X } from 'lucide-react';
import { cn, exportCSV, printTable } from '../lib/utils';
import { Button, EmptyState, Select } from './ui';

/**
 * Reusable table: search, sort, filters, pagination, CSV export and print.
 * columns: [{ key, header, value?(row), render?(row), className?, sortable?, exportable? }]
 * filters: [{ key, label, options: [{value,label}], match(row, value) }]
 */
export function DataTable({
  rows,
  columns,
  filters = [],
  title = 'Records',
  rowKey = (r) => r.id,
  actions,
  toolbar,
  onRowClick,
  pageSize: ps = 10,
  emptyTitle,
  emptyMessage,
  emptyAction,
  showInactiveToggle,
  initialSort,
  rowClass,
  compact,
  exportName,
  hideExport,
}) {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [fv, setFv] = useState({});
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ps);
  const [showInactive, setShowInactive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const p = params.get('q');
    if (p !== null) setQ(p);
  }, [params]);
  useEffect(() => setPage(1), [q, fv, showInactive, pageSize]);

  const val = (c, r) => (c.value ? c.value(r) : r[c.key]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (showInactiveToggle && !showInactive ? r.active !== false : true));
    Object.entries(fv).forEach(([k, v]) => {
      if (!v) return;
      const f = filters.find((x) => x.key === k);
      if (f) out = out.filter((r) => f.match(r, v));
    });
    if (needle)
      out = out.filter((r) =>
        columns.some((c) =>
          String(val(c, r) ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      );
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) {
        out = [...out].sort((a, b) => {
          const x = val(c, a),
            y = val(c, b);
          const cmp =
            typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, fv, sort, showInactive, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const visible = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  const exportCols = columns.filter((c) => c.exportable !== false);
  const exportRows = () =>
    filtered.map((r) =>
      exportCols.map((c) => {
        const v = val(c, r);
        return v === null || v === undefined ? '' : v;
      }),
    );
  const activeFilters = Object.values(fv).filter(Boolean).length;
  const nextSort = (key) => {
    const active = sort?.key === key;
    setSort(active && sort.dir === 'asc' ? { key, dir: 'desc' } : active && sort.dir === 'desc' ? null : { key, dir: 'asc' });
  };

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div className="table-search">
          <Search />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search table" />
          {q && (
            <button className="close-btn clear" onClick={() => setQ('')} aria-label="Clear search">
              <X className="icon-16" />
            </button>
          )}
        </div>
        {filters.length > 0 && (
          <Button variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters((s) => !s)}>
            Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        )}
        {showInactiveToggle && (
          <label className="check-row small muted">
            <input type="checkbox" className="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show
            inactive
          </label>
        )}
        <div className="table-actions">
          {toolbar}
          {!hideExport && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={() =>
                  exportCSV(
                    exportName ?? title,
                    exportCols.map((c) => c.header),
                    exportRows(),
                  )
                }
                disabled={!filtered.length}
              >
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Printer}
                onClick={() =>
                  printTable(
                    title,
                    exportCols.map((c) => c.header),
                    exportRows(),
                    `${filtered.length} records`,
                  )
                }
                disabled={!filtered.length}
              >
                Print
              </Button>
            </>
          )}
        </div>
      </div>
      {showFilters && filters.length > 0 && (
        <div className="filters-panel">
          {filters.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">{f.label}</span>
              <Select value={fv[f.key] ?? ''} onChange={(e) => setFv((s) => ({ ...s, [f.key]: e.target.value }))} className="input-sm">
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          {activeFilters > 0 && (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={() => setFv({})}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          title={emptyTitle ?? (q || activeFilters ? 'No matching records' : 'No records yet')}
          message={q || activeFilters ? 'Try adjusting your search or filters.' : emptyMessage}
          action={!q && !activeFilters ? emptyAction : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table className={cn('table', compact && 'compact')}>
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} className={c.className}>
                      {c.sortable !== false ? (
                        <button className="sort-btn" onClick={() => nextSort(c.key)}>
                          {c.header}
                          {active ? sort.dir === 'asc' ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown className="dim" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {actions && <th className="actions-cell">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(onRowClick && 'clickable', r.active === false && 'inactive', rowClass?.(r))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render ? c.render(r) : (val(c, r) ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="row end nowrap" style={{ gap: 2 }}>
                        {actions(r)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="table-footer">
          <span>
            Showing {(cur - 1) * pageSize + 1}–{Math.min(cur * pageSize, filtered.length)} of {filtered.length}
            {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ''}
          </span>
          <div className="pager">
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rows per page">
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page">
              <ChevronLeft />
            </button>
            <span>
              Page {cur} / {pages}
            </span>
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page">
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
