/** Human-readable label for a record in any collection. */
export function labelOf(db, col, id) {
  if (!id) return '—';
  const r = db[col].find((x) => x.id === id);
  if (!r) return '—';
  return recordLabel(db, col, r);
}
export function recordLabel(db, col, r) {
  switch (col) {
    case 'departments':
    case 'programs':
      return r.code;
    case 'students':
      return `${r.name} (${r.rollNo})`;
    case 'employees':
      return `${r.name} (${r.empNo})`;
    case 'academicYears':
      return r.name;
    case 'feeHeads':
      return `${r.name} (${r.category})`;
    case 'hostelRooms':
      return `${db.hostels.find((h) => h.id === r.hostelId)?.name.split(' ')[0] ?? ''} #${r.roomNo}`;
    case 'invoices':
      return r.invoiceNo;
    default:
      return r.name ?? r.title ?? r.code ?? r.id;
  }
}
export const options = (db, col, filter) =>
  db[col]
    .filter((r) => r.active !== false && (!filter || filter(r)))
    .map((r) => ({ value: r.id, label: recordLabel(db, col, r) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
