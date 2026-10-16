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
      return r.code;
    case 'programs':
      return r.code;
    case 'students':
      return `${r.name} (${r.rollNo})`;
    case 'courses':
      return `${r.code} – ${r.name}`;
    case 'sections': {
      const d = db.departments.find((x) => x.id === r.departmentId);
      const ay = db.academicYears.find((x) => x.id === r.academicYearId);
      return `${d?.code ?? ''} Sem ${r.semesterNo} – ${r.name}${ay && !ay.current ? ` (${ay.name})` : ''}`;
    }
    case 'rooms':
      return `${r.code} (${r.type})`;
    case 'academicYears':
      return r.name;
    case 'hostelRooms':
      return `${db.hostels.find((h) => h.id === r.hostelId)?.name.split(' ')[0] ?? ''} #${r.roomNo}`;
    case 'routes':
      return `${r.code} – ${r.name}`;
    case 'vehicles':
      return r.regNo;
    case 'drives':
      return `${db.companies.find((c) => c.id === r.companyId)?.name ?? ''} – ${r.role}`;
    case 'invoices':
      return r.invoiceNo;
    case 'books':
      return r.title;
    case 'courseOutcomes':
      return r.code;
    case 'programOutcomes':
      return r.code;
    case 'curricula':
      return `${db.programs.find((p) => p.id === r.programId)?.code ?? ''} ${r.regulation} v${r.version}`;
    case 'feedbackForms':
      return r.title;
    default:
      return r.name ?? r.title ?? r.code ?? r.id;
  }
}
export const options = (db, col, filter) =>
  db[col]
    .filter((r) => r.active !== false && (!filter || filter(r)))
    .map((r) => ({ value: r.id, label: recordLabel(db, col, r) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
