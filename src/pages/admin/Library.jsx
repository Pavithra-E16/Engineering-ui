import { useState } from 'react';
import {
  BookCopy,
  BookOpen,
  ClipboardCheck,
  AlertTriangle,
  Undo2,
  Plus,
  Pencil,
  Trash2,
  IndianRupee,
  XCircle,
  Printer,
} from 'lucide-react';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, StatCard, useConfirm, useToast } from '../../components/ui';
import { addDays, daysBetween, fmtDate, fmtMoney, sum, todayISO } from '../../lib/utils';
function IssueBook({ onClose }) {
  const { db, create, update, settings } = useData();
  const toast = useToast();
  const [f, setF] = useState({
    bookId: '',
    memberType: 'Student',
    memberId: '',
    issueDate: todayISO(),
    dueDate: addDays(todayISO(), settings.libraryLoanDays),
  });
  const [err, setErr] = useState('');
  const book = db.books.find((b) => b.id === f.bookId);
  const save = async () => {
    if (!f.bookId || !f.memberId) return setErr('Book and member are required.');
    if (!book || book.available < 1) return setErr('No copies of this book are available.');
    if (f.dueDate <= f.issueDate) return setErr('Due date must be after the issue date.');
    const open = db.bookIssues.filter((i) => i.memberId === f.memberId && i.status === 'Issued');
    if (open.length >= 4) return setErr('Member already has 4 books issued (limit).');
    if (open.some((i) => i.dueDate < todayISO())) return setErr('Member has overdue books. Return them before issuing new ones.');
    try {
      await create('bookIssues', { ...f, memberType: f.memberType, fine: 0, status: 'Issued' }, { audit: 'Issued', details: book.title });
      await update('books', book.id, { available: book.available - 1 }, { audit: false });
      toast.success(`"${book.title}" issued. Due ${fmtDate(f.dueDate)}.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue book"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Issue</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Book" required>
          <Select value={f.bookId} onChange={(e) => setF({ ...f, bookId: e.target.value })}>
            <option value="">Select…</option>
            {db.books
              .filter((b) => b.active !== false)
              .map((b) => (
                <option key={b.id} value={b.id} disabled={b.available < 1}>
                  {b.title} — {b.available}/{b.copies} available
                </option>
              ))}
          </Select>
        </Field>
        <div className="form-grid">
          <Field label="Member type">
            <Select value={f.memberType} onChange={(e) => setF({ ...f, memberType: e.target.value, memberId: '' })}>
              <option>Student</option>
              <option>Staff</option>
            </Select>
          </Field>
          <Field label="Member" required>
            <Select value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}>
              <option value="">Select…</option>
              {options(db, f.memberType === 'Student' ? 'students' : 'employees').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date">
            <Input
              type="date"
              value={f.issueDate}
              onChange={(e) => setF({ ...f, issueDate: e.target.value, dueDate: addDays(e.target.value, settings.libraryLoanDays) })}
            />
          </Field>
          <Field label="Due date">
            <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
export default function Library() {
  const { db, can, update, remove, settings } = useData();
  const scope = useScope();
  const [dueEdit, setDueEdit] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [issue, setIssue] = useState(false);
  const [fineAct, setFineAct] = useState(null); // { r, kind: collect | waive | adjust, amount, mode, reference, note }
  const edit = can('library', 'edit');
  const today = todayISO();
  const fineFor = (i) => Math.max(0, daysBetween(i.dueDate, i.returnDate ?? today)) * settings.libraryFinePerDay;
  const member = (i) => labelOf(db, i.memberType === 'Student' ? 'students' : 'employees', i.memberId);
  const ret = async (i) => {
    const fine = fineFor(i);
    if (
      !(await confirm({
        title: 'Return book?',
        message: `Return "${labelOf(db, 'books', i.bookId)}" from ${member(i)}?${fine ? ` A late fine of ${fmtMoney(fine)} applies.` : ''}`,
        confirmLabel: 'Return',
        tone: 'primary',
      }))
    )
      return;
    try {
      await update(
        'bookIssues',
        i.id,
        { status: 'Returned', returnDate: today, fine, fineStatus: fine ? 'Unpaid' : undefined },
        { audit: 'Returned' },
      );
      const b = db.books.find((x) => x.id === i.bookId);
      if (b) await update('books', b.id, { available: Math.min(b.copies, b.available + 1) }, { audit: false });
      toast.success(`Book returned${fine ? `. Fine of ${fmtMoney(fine)} is now due — collect it from the Fines tab` : ''}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const saveDue = async () => {
    if (!dueEdit.dueDate || dueEdit.dueDate < dueEdit.issueDate) {
      toast.error('Due date must be on or after the issue date.');
      return;
    }
    try {
      await update(
        'bookIssues',
        dueEdit.id,
        { dueDate: dueEdit.dueDate },
        { audit: 'Due date changed', details: labelOf(db, 'books', dueEdit.bookId) },
      );
      toast.success('Due date updated.');
      setDueEdit(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const delIssue = async (i) => {
    const ok = await confirm({
      title: 'Delete circulation record?',
      message: `Delete the returned record of “${labelOf(db, 'books', i.bookId)}” for ${member(i)}?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await remove('bookIssues', i.id, { details: labelOf(db, 'books', i.bookId) });
      toast.success('Record deleted.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  const issues = scope.personal ? db.bookIssues.filter((i) => scope.linked.includes(i.memberId)) : db.bookIssues;
  const issued = issues.filter((i) => i.status === 'Issued');
  const overdue = issued.filter((i) => i.dueDate < today);
  /** Fine state: Accruing while overdue, then Unpaid -> Paid / Waived after the book is returned. */
  const fineStatusOf = (r) => {
    if (r.status === 'Issued') return r.dueDate < today ? 'Accruing' : null;
    return r.fine > 0 ? (r.fineStatus ?? 'Unpaid') : null;
  };
  const fineRows = issues.filter((r) => fineStatusOf(r));
  const fineTotals = {
    pending: sum(fineRows.filter((r) => fineStatusOf(r) === 'Unpaid').map((r) => r.fine)),
    accruing: sum(fineRows.filter((r) => fineStatusOf(r) === 'Accruing').map((r) => fineFor(r))),
    collected: sum(fineRows.filter((r) => fineStatusOf(r) === 'Paid').map((r) => r.fine)),
    waived: sum(fineRows.filter((r) => fineStatusOf(r) === 'Waived').map((r) => r.fine)),
  };
  const openFine = (r, kind) => setFineAct({ r, kind, amount: r.fine, mode: 'Cash', reference: '', note: '' });
  const printFineReceipt = (r) => {
    const w = window.open('', '_blank', 'width=640,height=640');
    if (!w) return;
    const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    w.document.write(
      '<!doctype html><html><head><title>Library fine receipt</title><style>body{font-family:Poppins,Segoe UI,sans-serif;margin:40px}h1{font-size:18px;margin:0}' +
        'table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}.m{color:#666;font-size:12px}</style></head><body>' +
        '<h1>' +
        esc(settings.institutionName) +
        '</h1><p class="m">Library fine receipt</p><table>' +
        '<tr><td>Receipt no</td><td class="r"><b>' +
        esc(r.fineReceiptNo) +
        '</b></td></tr>' +
        '<tr><td>Date</td><td class="r">' +
        esc(fmtDate(r.finePaidOn)) +
        '</td></tr>' +
        '<tr><td>Member</td><td class="r">' +
        esc(member(r)) +
        '</td></tr>' +
        '<tr><td>Book</td><td class="r">' +
        esc(labelOf(db, 'books', r.bookId)) +
        '</td></tr>' +
        '<tr><td>Due / returned</td><td class="r">' +
        esc(fmtDate(r.dueDate)) +
        ' / ' +
        esc(fmtDate(r.returnDate)) +
        '</td></tr>' +
        '<tr><td>Mode</td><td class="r">' +
        esc(r.fineMode) +
        (r.fineReference ? ' (' + esc(r.fineReference) + ')' : '') +
        '</td></tr>' +
        '<tr><td><b>Fine received</b></td><td class="r"><b>' +
        esc(fmtMoney(r.fine)) +
        '</b></td></tr></table>' +
        '<script>window.onload=()=>window.print()<' +
        '/script></body></html>',
    );
    w.document.close();
  };
  const saveFine = async () => {
    const { r, kind } = fineAct;
    const amount = Number(fineAct.amount);
    try {
      if (kind === 'collect') {
        if (!(amount > 0)) return toast.error('Enter the amount received.');
        if (fineAct.mode !== 'Cash' && !fineAct.reference.trim()) return toast.error('Enter the UPI / transaction reference.');
        const data = {
          fine: amount,
          fineStatus: 'Paid',
          finePaidOn: today,
          fineMode: fineAct.mode,
          fineReference: fineAct.reference.trim(),
          fineReceiptNo: 'LIB-' + Date.now().toString().slice(-7),
        };
        await update('bookIssues', r.id, data, { audit: 'Fine collected', details: member(r) + ' ' + fmtMoney(amount) });
        toast.success('Fine of ' + fmtMoney(amount) + ' collected.');
        printFineReceipt({ ...r, ...data });
      } else if (kind === 'waive') {
        if (!fineAct.note.trim()) return toast.error('Enter the reason for waiving the fine.');
        await update(
          'bookIssues',
          r.id,
          { fineStatus: 'Waived', fineNote: fineAct.note.trim() },
          { audit: 'Fine waived', details: member(r) + ' ' + fmtMoney(r.fine) + ': ' + fineAct.note.trim() },
        );
        toast.success('Fine waived.');
      } else {
        if (!(amount >= 0)) return toast.error('Enter a valid amount.');
        if (!fineAct.note.trim()) return toast.error('Enter the reason for the adjustment.');
        await update(
          'bookIssues',
          r.id,
          { fine: amount, fineStatus: amount ? 'Unpaid' : undefined, fineNote: fineAct.note.trim() },
          { audit: 'Fine adjusted', details: fmtMoney(r.fine) + ' -> ' + fmtMoney(amount) },
        );
        toast.success('Fine amount updated.');
      }
      setFineAct(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const circCols = [
    { key: 'book', header: 'Book', value: (r) => labelOf(db, 'books', r.bookId) },
    ...(scope.personal ? [] : [{ key: 'member', header: 'Member', value: (r) => member(r) }]),
    { key: 'issueDate', header: 'Issued', render: (r) => fmtDate(r.issueDate) },
    {
      key: 'dueDate',
      header: 'Due',
      render: (r) => <span className={r.status === 'Issued' && r.dueDate < today ? 'strong text-red' : ''}>{fmtDate(r.dueDate)}</span>,
    },
    { key: 'returnDate', header: 'Returned', render: (r) => fmtDate(r.returnDate) },
    {
      key: 'fine',
      header: 'Fine',
      value: (r) => (r.status === 'Issued' ? fineFor(r) : r.fine),
      render: (r) => fmtMoney(r.status === 'Issued' ? fineFor(r) : r.fine),
    },
    {
      key: 'fineStatus',
      header: 'Fine status',
      value: (r) => fineStatusOf(r) ?? '',
      render: (r) => (fineStatusOf(r) ? <Badge>{fineStatusOf(r)}</Badge> : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      value: (r) => (r.status === 'Issued' && r.dueDate < today ? 'Overdue' : r.status),
      render: (r) => <Badge>{r.status === 'Issued' && r.dueDate < today ? 'Overdue' : r.status}</Badge>,
    },
  ];
  return (
    <>
      <PageHeader
        title="Library"
        subtitle={`Catalogue, circulation, due dates and overdue fines (₹${settings.libraryFinePerDay}/day, ${settings.libraryLoanDays}-day loan)`}
      />
      <div className="grid cols-4 stats">
        <StatCard label="Titles" value={db.books.length} icon={BookCopy} />
        <StatCard label="Copies" value={sum(db.books.map((b) => b.copies))} icon={BookOpen} tone="blue" />
        <StatCard label={scope.personal ? 'My books issued' : 'Issued'} value={issued.length} icon={ClipboardCheck} tone="violet" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertTriangle} tone={overdue.length ? 'red' : 'green'} />
      </div>
      <UrlTabs
        tabs={[
          { id: 'circulation', label: scope.personal ? 'My books' : 'Circulation' },
          { id: 'catalogue', label: 'Catalogue' },
          { id: 'overdue', label: 'Overdue', count: overdue.length, hidden: scope.personal },
          {
            id: 'fines',
            label: scope.personal ? 'My fines' : 'Fines',
            count: fineRows.filter((r) => ['Unpaid', 'Accruing'].includes(fineStatusOf(r))).length,
          },
        ]}
      >
        {(t) =>
          t === 'catalogue' ? (
            <EntityPage
              config={{
                collection: 'books',
                title: 'Library catalogue',
                singular: 'Book',
                module: 'library',
                beforeSave: (f, existing) => ({
                  ...f,
                  available: existing ? Math.max(0, f.copies - (existing.copies - existing.available)) : f.copies,
                }),
                fields: [
                  { key: 'accessionNo', label: 'Accession no', required: true, unique: true },
                  { key: 'title', label: 'Title', required: true },
                  { key: 'author', label: 'Author', required: true },
                  { key: 'isbn', label: 'ISBN', table: false },
                  { key: 'publisher', label: 'Publisher', table: false },
                  { key: 'category', label: 'Category', required: true, filter: true },
                  { key: 'year', label: 'Year', type: 'number', min: 1900, max: 2100, table: false },
                  { key: 'copies', label: 'Copies', type: 'number', min: 1, required: true },
                  { key: 'available', label: 'Available', type: 'number', form: false },
                  { key: 'rack', label: 'Rack', required: true },
                ],
              }}
            />
          ) : t === 'circulation' ? (
            <DataTable
              title="Circulation"
              rows={issues}
              initialSort={{ key: 'issueDate', dir: 'desc' }}
              columns={circCols}
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'Issued', label: 'Issued' },
                    { value: 'Returned', label: 'Returned' },
                  ],
                  match: (r, v) => r.status === v,
                },
              ]}
              toolbar={
                edit ? (
                  <Button size="sm" icon={Plus} onClick={() => setIssue(true)}>
                    Issue book
                  </Button>
                ) : undefined
              }
              actions={
                edit
                  ? (r) =>
                      r.status === 'Issued' ? (
                        <>
                          <Button size="sm" variant="ghost" icon={Undo2} onClick={() => ret(r)}>
                            Return
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Pencil}
                            title="Change due date / renew"
                            onClick={() => setDueEdit({ ...r })}
                          />
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="danger"
                          title="Delete record"
                          onClick={() => delIssue(r)}
                        />
                      )
                  : undefined
              }
            />
          ) : t === 'fines' ? (
            <>
              <div className="mb-16">
                <Alert tone="info" title="How library fines work">
                  A fine is <b>created automatically</b> — nobody types it in. Each book is lent for <b>{settings.libraryLoanDays} days</b>.
                  For every day a book is kept after its due date the fine grows by <b>{fmtMoney(settings.libraryFinePerDay)} per day</b>{' '}
                  (status <b>Accruing</b>). When the book is returned, the fine is fixed as days late ×{' '}
                  {fmtMoney(settings.libraryFinePerDay)} and becomes <b>Unpaid</b>. The librarian then clicks <b>Collect</b> to record the
                  payment and print a receipt (<b>Paid</b>), or <b>Waive</b> it with a reason. Loan days and the daily rate are set in
                  Settings → OBE &amp; library.
                </Alert>
              </div>
              <div className="grid cols-4 stats">
                <StatCard label="Pending (unpaid)" value={fmtMoney(fineTotals.pending)} icon={AlertTriangle} tone="red" />
                <StatCard label="Accruing (still overdue)" value={fmtMoney(fineTotals.accruing)} icon={ClipboardCheck} tone="amber" />
                <StatCard label="Collected" value={fmtMoney(fineTotals.collected)} icon={IndianRupee} tone="green" />
                <StatCard label="Waived" value={fmtMoney(fineTotals.waived)} icon={XCircle} tone="slate" />
              </div>
              <DataTable
                title="Library fines"
                exportName="library-fines"
                rows={fineRows}
                initialSort={{ key: 'fineStatus', dir: 'desc' }}
                filters={[
                  {
                    key: 'fs',
                    label: 'Fine status',
                    options: ['Accruing', 'Unpaid', 'Paid', 'Waived'].map((v) => ({ value: v, label: v })),
                    match: (r, v) => fineStatusOf(r) === v,
                  },
                ]}
                columns={[
                  { key: 'book', header: 'Book', value: (r) => labelOf(db, 'books', r.bookId) },
                  ...(scope.personal ? [] : [{ key: 'member', header: 'Member', value: (r) => member(r) }]),
                  { key: 'dueDate', header: 'Due', render: (r) => fmtDate(r.dueDate) },
                  { key: 'returnDate', header: 'Returned', render: (r) => fmtDate(r.returnDate) },
                  { key: 'late', header: 'Days late', value: (r) => Math.max(0, daysBetween(r.dueDate, r.returnDate ?? today)) },
                  {
                    key: 'amount',
                    header: 'Fine',
                    value: (r) => (r.status === 'Issued' ? fineFor(r) : r.fine),
                    render: (r) => <b>{fmtMoney(r.status === 'Issued' ? fineFor(r) : r.fine)}</b>,
                  },
                  { key: 'fineStatus', header: 'Status', value: (r) => fineStatusOf(r), render: (r) => <Badge>{fineStatusOf(r)}</Badge> },
                  { key: 'receipt', header: 'Receipt / note', value: (r) => r.fineReceiptNo ?? r.fineNote ?? '' },
                ]}
                actions={
                  edit
                    ? (r) => {
                        const st = fineStatusOf(r);
                        if (st === 'Accruing')
                          return (
                            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => ret(r)}>
                              Return book
                            </Button>
                          );
                        if (st === 'Unpaid')
                          return (
                            <>
                              <Button size="sm" variant="ghost" icon={IndianRupee} className="ok" onClick={() => openFine(r, 'collect')}>
                                Collect
                              </Button>
                              <Button size="sm" variant="ghost" icon={Pencil} title="Adjust amount" onClick={() => openFine(r, 'adjust')} />
                              <Button size="sm" variant="ghost" icon={XCircle} className="bad" onClick={() => openFine(r, 'waive')}>
                                Waive
                              </Button>
                            </>
                          );
                        if (st === 'Paid')
                          return (
                            <Button size="sm" variant="ghost" icon={Printer} title="Print receipt" onClick={() => printFineReceipt(r)} />
                          );
                        return null;
                      }
                    : undefined
                }
              />
            </>
          ) : (
            <DataTable
              title="Overdue books"
              exportName="library-overdue"
              rows={overdue}
              columns={circCols}
              actions={
                edit
                  ? (r) => (
                      <Button size="sm" variant="ghost" icon={Undo2} onClick={() => ret(r)}>
                        Return
                      </Button>
                    )
                  : undefined
              }
            />
          )
        }
      </UrlTabs>
      {issue && <IssueBook onClose={() => setIssue(false)} />}
      <Modal
        open={!!fineAct}
        onClose={() => setFineAct(null)}
        title={
          fineAct?.kind === 'collect' ? 'Collect library fine' : fineAct?.kind === 'waive' ? 'Waive library fine' : 'Adjust fine amount'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFineAct(null)}>
              Cancel
            </Button>
            <Button variant={fineAct?.kind === 'waive' ? 'danger' : 'primary'} onClick={saveFine}>
              {fineAct?.kind === 'collect' ? 'Collect & print receipt' : fineAct?.kind === 'waive' ? 'Waive fine' : 'Save amount'}
            </Button>
          </>
        }
      >
        {fineAct && (
          <div className="stack">
            <p className="muted">
              {member(fineAct.r)} · {labelOf(db, 'books', fineAct.r.bookId)}
              <br />
              {Math.max(0, daysBetween(fineAct.r.dueDate, fineAct.r.returnDate ?? today))} days late ×{' '}
              {fmtMoney(settings.libraryFinePerDay)} = <b>{fmtMoney(fineAct.r.fine)}</b>
            </p>
            {fineAct.kind !== 'waive' && (
              <Field label={fineAct.kind === 'collect' ? 'Amount received (₹)' : 'New fine amount (₹)'} required>
                <Input type="number" min={0} value={fineAct.amount} onChange={(e) => setFineAct({ ...fineAct, amount: e.target.value })} />
              </Field>
            )}
            {fineAct.kind === 'collect' && (
              <div className="form-grid">
                <Field label="Mode" required>
                  <Select value={fineAct.mode} onChange={(e) => setFineAct({ ...fineAct, mode: e.target.value })}>
                    {['Cash', 'UPI', 'Card'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reference">
                  <Input
                    value={fineAct.reference}
                    onChange={(e) => setFineAct({ ...fineAct, reference: e.target.value })}
                    placeholder="UPI / txn no."
                  />
                </Field>
              </div>
            )}
            {fineAct.kind !== 'collect' && (
              <Field label="Reason" required>
                <Input
                  value={fineAct.note}
                  onChange={(e) => setFineAct({ ...fineAct, note: e.target.value })}
                  placeholder={fineAct.kind === 'waive' ? 'e.g. Medical certificate submitted' : 'e.g. Holidays excluded'}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={!!dueEdit}
        onClose={() => setDueEdit(null)}
        title="Change due date"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDueEdit(null)}>
              Cancel
            </Button>
            <Button onClick={saveDue}>Save</Button>
          </>
        }
      >
        {dueEdit && (
          <div className="stack">
            <p className="muted">
              {labelOf(db, 'books', dueEdit.bookId)} · {member(dueEdit)}
            </p>
            <Field label="Due date" required>
              <Input
                type="date"
                value={dueEdit.dueDate}
                min={dueEdit.issueDate}
                onChange={(e) => setDueEdit({ ...dueEdit, dueDate: e.target.value })}
              />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDueEdit({ ...dueEdit, dueDate: addDays(dueEdit.dueDate, settings.libraryLoanDays) })}
            >
              Renew +{settings.libraryLoanDays} days
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
