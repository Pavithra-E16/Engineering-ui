import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, MessageSquareText, RotateCcw, Send, XCircle } from 'lucide-react';
import { APP_MODE } from '../config/firebase';
import { useData } from '../data/store';
import { labelOf } from '../data/labels';
import { DataTable } from '../components/DataTable';
import { UrlTabs } from '../components/TabbedEntities';
import { Alert, Badge, Button, Card, Field, PageHeader, Select, StatCard, Textarea, useConfirm, useToast } from '../components/ui';
import { SMS_TYPES, toParent, useSms } from '../lib/sms';
import { fmtDateTime } from '../lib/utils';

function Compose() {
  const { db, can, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ dept: '', year: '', group: 'all', message: '' });
  const sig = ` -${settings.smsSenderId || settings.shortName}`;
  const targets = useMemo(
    () =>
      db.students.filter(
        (s) =>
          s.status === 'Active' &&
          (!f.dept || s.departmentId === f.dept) &&
          (!f.year || String(s.year) === f.year) &&
          (f.group === 'all' || (f.group === 'hostel' ? s.hosteller : !s.hosteller)),
      ),
    [db.students, f],
  );
  const text = f.message.trim() + (f.message.trim().endsWith(sig.trim()) ? '' : sig);
  const send = async () => {
    if (!f.message.trim()) return toast.error('Type the message.');
    if (!(await confirm({ title: 'Send SMS?', message: `Send this message to ${targets.length} parents?`, confirmLabel: 'Send', tone: 'primary' }))) return;
    try {
      const n = await sms(targets.map((s) => toParent(s, 'General', text)));
      toast.success(`${n} SMS sent.`);
      setF({ ...f, message: '' });
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Card title="Send SMS to parents">
      <div className="form-grid">
        <Field label="Department">
          <Select value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>
            <option value="">All</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Year">
          <Select value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
            <option value="">All</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Students">
          <Select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            <option value="all">All</option>
            <option value="hostel">Hostellers only</option>
            <option value="day">Day scholars only</option>
          </Select>
        </Field>
        <Field label={`Message (${text.length} chars · ${Math.ceil(text.length / 160)} SMS)`} className="full">
          <Textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="e.g. Dear Parent, the college will remain closed on 2 Nov for Diwali." />
        </Field>
      </div>
      <div className="row between mt-12">
        <span className="muted">{targets.length} parents will receive this message.</span>
        {can('sms', 'edit') && (
          <Button icon={Send} onClick={send} disabled={!targets.length}>
            Send SMS
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function Sms() {
  const { db, can } = useData();
  const sms = useSms();
  const toast = useToast();
  const logs = db.smsLogs;
  const by = (s) => logs.filter((l) => l.status === s).length;
  const retry = async (l) => {
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, status: _s, sentAt: _t, ...rest } = l;
      await sms([{ ...rest, retryOf: l.id }]);
      toast.success('SMS re-sent.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="SMS Centre" subtitle="Every SMS sent to parents and students: fee alerts, receipts, admissions, activities, hostel and certificates" />
      <div className="mb-16">
        <Alert tone={APP_MODE === 'demo' ? 'warning' : 'info'}>
          {APP_MODE === 'demo'
            ? 'Demo mode: messages are logged and marked delivered, but no real SMS is sent.'
            : 'Messages are queued here and sent by the sendQueuedSms Cloud Function through the configured SMS provider (DLT-registered sender id and templates).'}
        </Alert>
      </div>
      <div className="grid cols-4 stats">
        <StatCard label="Total messages" value={logs.length} icon={MessageSquareText} />
        <StatCard label="Delivered / sent" value={by('Delivered') + by('Sent')} icon={CheckCircle2} tone="green" />
        <StatCard label="Queued" value={by('Queued')} icon={Clock} tone="amber" />
        <StatCard label="Failed" value={by('Failed')} icon={XCircle} tone="red" />
      </div>
      <UrlTabs
        tabs={[
          { id: 'log', label: 'SMS log' },
          { id: 'compose', label: 'Compose', hidden: !can('sms', 'edit') },
        ]}
      >
        {(t) =>
          t === 'compose' ? (
            <Compose />
          ) : (
            <DataTable
              title="SMS log"
              exportName="sms-log"
              rows={logs}
              initialSort={{ key: 'sentAt', dir: 'desc' }}
              filters={[
                { key: 'type', label: 'Type', options: SMS_TYPES.map((v) => ({ value: v, label: v })), match: (r, v) => r.type === v },
                { key: 'status', label: 'Status', options: ['Queued', 'Sent', 'Delivered', 'Failed'].map((v) => ({ value: v, label: v })), match: (r, v) => r.status === v },
              ]}
              columns={[
                { key: 'sentAt', header: 'Sent', render: (r) => fmtDateTime(r.sentAt) },
                { key: 'type', header: 'Type', render: (r) => <Badge tone="blue">{r.type}</Badge> },
                { key: 'recipientName', header: 'Recipient' },
                { key: 'to', header: 'Mobile' },
                { key: 'student', header: 'Student', value: (r) => (r.studentId ? labelOf(db, 'students', r.studentId) : '') },
                { key: 'message', header: 'Message' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
                { key: 'sentBy', header: 'Sent by' },
              ]}
              actions={can('sms', 'edit') ? (r) => (r.status === 'Failed' ? <Button size="sm" variant="ghost" icon={RotateCcw} title="Retry" onClick={() => retry(r)} /> : null) : undefined}
            />
          )
        }
      </UrlTabs>
    </>
  );
}
