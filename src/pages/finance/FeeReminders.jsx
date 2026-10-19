import { useMemo, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { useData } from '../../data/store';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { categoryOf, headOf, invBalance } from '../../lib/domain';
import { SMS_TEMPLATES, toParent, useSms } from '../../lib/sms';
import { addDays, fmtDate, fmtDateTime, fmtMoney, sum, todayISO } from '../../lib/utils';

export default function FeeReminders() {
  const { db, ayId, can, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const confirm = useConfirm();
  const edit = can('fee-reminders', 'edit');
  const [f, setF] = useState({ window: 'due', days: String(settings.reminderDaysBefore ?? 7), category: '', head: '', dept: '', year: '' });
  const [skip, setSkip] = useState([]);
  const [busy, setBusy] = useState(false);
  const today = todayISO();
  const lastAlert = useMemo(() => {
    const m = {};
    db.smsLogs.filter((s) => s.type === 'Fee Due').forEach((s) => (m[s.studentId] = !m[s.studentId] || s.sentAt > m[s.studentId] ? s.sentAt : m[s.studentId]));
    return m;
  }, [db.smsLogs]);
  const targets = useMemo(() => {
    const until = addDays(today, Number(f.days) || 0);
    const inv = db.invoices.filter(
      (i) =>
        i.academicYearId === ayId &&
        invBalance(i) > 0 &&
        (f.window === 'all' || (f.window === 'overdue' ? i.dueDate < today : i.dueDate >= today && i.dueDate <= until)) &&
        (!f.category || categoryOf(db, i.feeHeadId) === f.category) &&
        (!f.head || i.feeHeadId === f.head),
    );
    const byStudent = {};
    inv.forEach((i) => (byStudent[i.studentId] ||= []).push(i));
    return Object.entries(byStudent)
      .map(([sid, list]) => {
        const st = db.students.find((s) => s.id === sid);
        const cutoff = list.map((i) => i.dueDate).sort()[0];
        const amount = sum(list.map(invBalance));
        const head = list.length === 1 ? (headOf(db, list[0].feeHeadId)?.name ?? 'Fee') : `Fees (${list.map((i) => headOf(db, i.feeHeadId)?.code).join(', ')})`;
        return { id: sid, st, list, cutoff, amount, head, message: st && SMS_TEMPLATES.feeDue({ st, amount, head, cutoff }, settings) };
      })
      .filter((t) => t.st && t.st.status === 'Active' && (!f.dept || t.st.departmentId === f.dept) && (!f.year || String(t.st.year) === f.year));
  }, [db, ayId, f, today, settings]);
  const chosen = targets.filter((t) => !skip.includes(t.id));
  const send = async () => {
    if (!chosen.length) return;
    const ok = await confirm({
      title: 'Send fee due alerts?',
      message: `Send ${chosen.length} SMS alert(s) to parents for ${fmtMoney(sum(chosen.map((t) => t.amount)))} outstanding?`,
      confirmLabel: 'Send SMS',
      tone: 'primary',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const n = await sms(chosen.map((t) => toParent(t.st, 'Fee Due', t.message)));
      toast.success(`${n} fee due alert(s) sent to parents.`);
      setSkip([]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k, v) => {
    setF({ ...f, [k]: v });
    setSkip([]);
  };
  return (
    <>
      <PageHeader title="Fee Due Alerts" subtitle="SMS alerts to parents whenever fees are due, including the payment cut-off date" />
      <UrlTabs
        tabs={[
          { id: 'send', label: 'Send alerts' },
          { id: 'history', label: 'Alert history', count: db.smsLogs.filter((s) => s.type === 'Fee Due').length },
        ]}
      >
        {(t) =>
          t === 'history' ? (
            <DataTable
              title="Fee due SMS history"
              exportName="fee-due-sms"
              rows={db.smsLogs.filter((s) => s.type === 'Fee Due')}
              initialSort={{ key: 'sentAt', dir: 'desc' }}
              columns={[
                { key: 'sentAt', header: 'Sent', render: (r) => fmtDateTime(r.sentAt) },
                { key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
                { key: 'recipientName', header: 'Parent' },
                { key: 'to', header: 'Mobile' },
                { key: 'message', header: 'Message' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
                { key: 'sentBy', header: 'Sent by' },
              ]}
            />
          ) : (
            <>
              <Card title="Who should receive an alert?" className="mb-16">
                <div className="form-grid cols-3">
                  <Field label="Fees">
                    <Select value={f.window} onChange={(e) => set('window', e.target.value)}>
                      <option value="due">Cut-off date within the next…</option>
                      <option value="overdue">Overdue (cut-off date passed)</option>
                      <option value="all">All outstanding</option>
                    </Select>
                  </Field>
                  {f.window === 'due' && (
                    <Field label="Days">
                      <Input type="number" min={0} max={90} value={f.days} onChange={(e) => set('days', e.target.value)} />
                    </Field>
                  )}
                  <Field label="Category">
                    <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
                      <option value="">Internal & external</option>
                      <option>Internal</option>
                      <option>External</option>
                    </Select>
                  </Field>
                  <Field label="Fee head">
                    <Select value={f.head} onChange={(e) => set('head', e.target.value)}>
                      <option value="">All fee heads</option>
                      {options(db, 'feeHeads').map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Department">
                    <Select value={f.dept} onChange={(e) => set('dept', e.target.value)}>
                      <option value="">All</option>
                      {db.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Year">
                    <Select value={f.year} onChange={(e) => set('year', e.target.value)}>
                      <option value="">All</option>
                      {[1, 2, 3, 4].map((y) => (
                        <option key={y} value={y}>
                          Year {y}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {targets[0] && (
                  <div className="mt-12">
                    <Alert tone="info" title="Message preview">
                      {targets[0].message}
                    </Alert>
                  </div>
                )}
              </Card>
              <DataTable
                title={`${chosen.length} of ${targets.length} parents selected · ${fmtMoney(sum(chosen.map((t) => t.amount)))}`}
                rows={targets}
                initialSort={{ key: 'cutoff', dir: 'asc' }}
                emptyMessage="No outstanding fees match these criteria."
                toolbar={
                  edit && (
                    <Button size="sm" icon={Send} onClick={send} loading={busy} disabled={!chosen.length}>
                      Send {chosen.length} SMS
                    </Button>
                  )
                }
                columns={[
                  {
                    key: 'sel',
                    header: '',
                    sortable: false,
                    exportable: false,
                    render: (r) => (
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`Include ${r.st.name}`}
                        checked={!skip.includes(r.id)}
                        onChange={(e) => setSkip(e.target.checked ? skip.filter((x) => x !== r.id) : [...skip, r.id])}
                      />
                    ),
                  },
                  { key: 'roll', header: 'Roll no', value: (r) => r.st.rollNo },
                  { key: 'name', header: 'Student', value: (r) => r.st.name },
                  { key: 'dept', header: 'Dept / Yr', value: (r) => `${labelOf(db, 'departments', r.st.departmentId)} · ${r.st.year}` },
                  { key: 'parent', header: 'Parent', value: (r) => `${r.st.parentName} (${r.st.parentPhone})` },
                  { key: 'head', header: 'Fees due' },
                  { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => fmtMoney(r.amount), className: 'text-right' },
                  { key: 'cutoff', header: 'Cut-off date', render: (r) => <span className={r.cutoff < today ? 'text-red' : ''}>{fmtDate(r.cutoff)}</span> },
                  { key: 'last', header: 'Last alert', value: (r) => lastAlert[r.id] ?? '', render: (r) => (lastAlert[r.id] ? fmtDateTime(lastAlert[r.id]) : <span className="muted">Never</span>) },
                ]}
              />
              {!edit && (
                <p className="row xs muted mt-8">
                  <BellRing className="icon-14" />
                  Only Accounts & Finance can send fee alerts.
                </p>
              )}
            </>
          )
        }
      </UrlTabs>
    </>
  );
}
