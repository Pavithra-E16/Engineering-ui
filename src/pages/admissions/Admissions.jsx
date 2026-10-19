import { useMemo, useState } from 'react';
import { CalendarClock, CheckCheck, ClipboardPen, GraduationCap, PhoneCall, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useData } from '../../data/store';
import { labelOf } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, useConfirm, useToast } from '../../components/ui';
import { ShareBars, SimpleBar } from '../../components/charts';
import { ADMISSION_SOURCES, CATEGORIES, ENQUIRY_STAGES, QUOTAS, REFERENCE_TYPES, headOf, invStatus, sourceGroup } from '../../lib/domain';
import { SMS_TEMPLATES, toParent, useSms } from '../../lib/sms';
import { addDays, pct, todayISO } from '../../lib/utils';

function FollowUp({ e, onClose }) {
  const { update } = useData();
  const toast = useToast();
  const [f, setF] = useState({ followUpDate: e.followUpDate ?? addDays(todayISO(), 3), notes: e.notes ?? '' });
  const save = async () => {
    try {
      await update('enquiries', e.id, { stage: 'Follow-up', ...f }, { audit: 'Follow-up scheduled', details: e.enquiryNo });
      toast.success('Follow-up scheduled.');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Follow-up · ${e.name}`}
      size="sm"
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
        <p className="muted">
          {e.phone} · {e.source}
        </p>
        <Field label="Next follow-up date">
          <Input type="date" value={f.followUpDate} onChange={(x) => setF({ ...f, followUpDate: x.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function Register({ e, onClose }) {
  const { update, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const [f, setF] = useState({ registrationNo: 'REG-' + Date.now().toString().slice(-6), registeredOn: todayISO(), registrationFee: '1000' });
  const save = async () => {
    try {
      await update('enquiries', e.id, { stage: 'Registered', ...f, registrationFee: Number(f.registrationFee) || 0 }, { audit: 'Registered', details: e.enquiryNo });
      await sms([{ to: e.phone, recipientName: e.name, type: 'Admission', message: SMS_TEMPLATES.registered({ name: e.name, regNo: f.registrationNo }, settings) }]);
      toast.success(`${e.name} registered; confirmation SMS sent.`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Register · ${e.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Confirm registration</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Registration no" required>
          <Input value={f.registrationNo} onChange={(x) => setF({ ...f, registrationNo: x.target.value })} />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.registeredOn} onChange={(x) => setF({ ...f, registeredOn: x.target.value })} />
        </Field>
        <Field label="Registration fee (₹)">
          <Input type="number" min={0} value={f.registrationFee} onChange={(x) => setF({ ...f, registrationFee: x.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** Admit a registered candidate: create the student record, raise fee demands and notify the parent. */
function Admit({ e, onClose }) {
  const { db, ayId, create, update, can, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const prog = db.programs.find((p) => p.id === e.programId);
  const [f, setF] = useState({
    gender: e.gender ?? 'Male',
    dob: e.dob ?? '',
    email: e.email ?? '',
    parentName: e.parentName ?? '',
    parentPhone: e.parentPhone ?? e.phone,
    address: '',
    category: e.category ?? 'OC',
    quota: e.entranceExam === 'Management Quota' ? 'Management' : e.entranceExam?.startsWith('ECET') ? 'Lateral Entry' : 'Convener',
    admissionDate: todayISO(),
    scholarshipScheme: '',
    scholarshipAmount: '',
    discountReason: '',
    discountAmount: '',
    hosteller: false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const go = async () => {
    if (!f.parentName.trim() || !/^[0-9+\-\s]{7,15}$/.test(f.parentPhone)) return setErr('Parent name and a valid parent mobile number are required.');
    if (!f.dob) return setErr('Date of birth is required.');
    setBusy(true);
    try {
      const year = Number(f.admissionDate.slice(0, 4));
      const deptIdx = db.departments.findIndex((d) => d.id === prog.departmentId) + 1;
      const lateral = f.quota === 'Lateral Entry';
      const n = db.students.filter((s) => s.programId === prog.id && s.admissionYear === year).length + 1;
      const st = await create(
        'students',
        {
          rollNo: `${String(year).slice(2)}KV${lateral ? '5A' : '1A'}${String(deptIdx).padStart(2, '0')}${String(n).padStart(2, '0')}`,
          admissionNo: `ADM${year}${Date.now().toString().slice(-4)}`,
          name: e.name,
          phone: e.phone,
          email: f.email || undefined,
          gender: f.gender,
          dob: f.dob,
          parentName: f.parentName.trim(),
          parentRelation: 'Father',
          parentPhone: f.parentPhone,
          address: f.address || undefined,
          departmentId: prog.departmentId,
          programId: prog.id,
          year: lateral ? 2 : 1,
          batch: `${year}-${year + 4}`,
          admissionYear: year,
          admissionDate: f.admissionDate,
          category: f.category,
          quota: f.quota,
          admissionSource: e.source,
          referenceBy: e.referenceBy,
          referenceType: e.referenceType,
          enquiryId: e.id,
          scholarshipScheme: f.scholarshipScheme || undefined,
          scholarshipAmount: Number(f.scholarshipAmount) || undefined,
          discountReason: f.discountReason || undefined,
          discountAmount: Number(f.discountAmount) || undefined,
          hosteller: f.hosteller,
          status: 'Active',
        },
        { audit: 'Admitted', details: `${e.enquiryNo} → ${e.name}` },
      );
      // Fee demands from the program's fee structure (if Finance has set one up).
      const fs = db.feeStructures.find((x) => x.programId === prog.id && x.academicYearId === ayId);
      let raised = 0;
      if (fs && can('fees', 'edit')) {
        for (const it of fs.items.filter((i) => !headOf(db, i.feeHeadId)?.oneTime || !lateral)) {
          const tuition = headOf(db, it.feeHeadId)?.code === 'TUI';
          const inv = {
            invoiceNo: `FD-${Date.now().toString().slice(-6)}-${raised + 1}`,
            studentId: st.id,
            academicYearId: ayId,
            feeStructureId: fs.id,
            feeHeadId: it.feeHeadId,
            description: headOf(db, it.feeHeadId)?.name,
            amount: it.amount,
            discount: tuition ? Math.min(Number(f.discountAmount) || 0, it.amount) : 0,
            scholarship: tuition ? Math.min(Number(f.scholarshipAmount) || 0, it.amount) : 0,
            concessionNote: [f.scholarshipScheme, f.discountReason].filter(Boolean).join(' · ') || undefined,
            dueDate: addDays(todayISO(), 30),
            paid: 0,
          };
          await create('invoices', { ...inv, status: invStatus(inv) }, { audit: false });
          raised++;
        }
      }
      await update('enquiries', e.id, { stage: 'Admitted', studentId: st.id }, { audit: false });
      await sms([toParent(st, 'Admission', SMS_TEMPLATES.admitted({ st, program: prog.name }, settings))]);
      toast.success(`${e.name} admitted as ${st.rollNo}${raised ? `; ${raised} fee demands raised` : '; Finance will raise the fee demands'}. SMS sent to parent.`);
      onClose();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Admit · ${e.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={UserCheck} onClick={go} loading={busy}>
            Admit student
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          {prog?.name} · Source: <b>{e.source}</b>
          {e.referenceBy && ` (ref. ${e.referenceBy})`} · Registration {e.registrationNo ?? '—'}
        </p>
        {err && <Alert tone="error">{err}</Alert>}
        <div className="form-grid">
          <Field label="Gender" required>
            <Select value={f.gender} onChange={(x) => set('gender', x.target.value)}>
              <option>Male</option>
              <option>Female</option>
            </Select>
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" value={f.dob} onChange={(x) => set('dob', x.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={(x) => set('email', x.target.value)} />
          </Field>
          <Field label="Admission date">
            <Input type="date" value={f.admissionDate} onChange={(x) => set('admissionDate', x.target.value)} />
          </Field>
          <Field label="Parent / guardian name" required>
            <Input value={f.parentName} onChange={(x) => set('parentName', x.target.value)} />
          </Field>
          <Field label="Parent mobile (for SMS)" required>
            <Input value={f.parentPhone} onChange={(x) => set('parentPhone', x.target.value)} />
          </Field>
          <Field label="Address" className="full">
            <Input value={f.address} onChange={(x) => set('address', x.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={f.category} onChange={(x) => set('category', x.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quota">
            <Select value={f.quota} onChange={(x) => set('quota', x.target.value)}>
              {QUOTAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Scholarship scheme">
            <Input value={f.scholarshipScheme} onChange={(x) => set('scholarshipScheme', x.target.value)} placeholder="e.g. Vidya Deevena" />
          </Field>
          <Field label="Scholarship amount (₹)">
            <Input type="number" min={0} value={f.scholarshipAmount} onChange={(x) => set('scholarshipAmount', x.target.value)} />
          </Field>
          <Field label="Discount reason">
            <Input value={f.discountReason} onChange={(x) => set('discountReason', x.target.value)} placeholder="e.g. Sibling concession" />
          </Field>
          <Field label="Discount amount (₹)">
            <Input type="number" min={0} value={f.discountAmount} onChange={(x) => set('discountAmount', x.target.value)} />
          </Field>
          <Field label="Hostel">
            <label className="check-row">
              <input type="checkbox" className="checkbox" checked={f.hosteller} onChange={(x) => set('hosteller', x.target.checked)} />
              Requires hostel accommodation
            </label>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Sources() {
  const { db } = useData();
  const [basis, setBasis] = useState('cycle');
  const data = useMemo(() => {
    const enq = db.enquiries;
    const stu = basis === 'all' ? db.students : db.students.filter((s) => s.admissionYear === 2026 || enq.some((e) => e.studentId === s.id));
    return ADMISSION_SOURCES.map((src) => {
      const e = enq.filter((x) => x.source === src);
      const adm = basis === 'all' ? stu.filter((s) => s.admissionSource === src).length : e.filter((x) => x.stage === 'Admitted').length;
      return { id: src, source: src, group: sourceGroup(src), enquiries: e.length, registered: e.filter((x) => x.stage === 'Registered' || x.stage === 'Admitted').length, admitted: adm };
    });
  }, [db, basis]);
  const groups = Object.values(
    data.reduce((a, r) => {
      a[r.group] ||= { label: r.group, value: 0 };
      a[r.group].value += r.admitted;
      return a;
    }, {}),
  ).sort((a, b) => b.value - a.value);
  const refs = REFERENCE_TYPES.map((t) => ({
    id: t,
    type: t,
    admitted: (basis === 'all' ? db.students : db.students.filter((s) => s.admissionYear === 2026)).filter((s) => s.admissionSource === 'Reference' && s.referenceType === t).length,
  }));
  return (
    <>
      <Card className="mb-16">
        <div className="row between">
          <p className="muted">Where admissions come from — for the publicity team to plan campaigns.</p>
          <Select value={basis} onChange={(x) => setBasis(x.target.value)} aria-label="Basis">
            <option value="cycle">Current admission cycle (enquiries)</option>
            <option value="all">All enrolled students (every batch)</option>
          </Select>
        </div>
      </Card>
      <div className="grid cols-2 mb-16">
        <Card title="Admissions by source">
          <SimpleBar data={data.map((d) => ({ ...d, source: d.source.replace('Social Media – ', 'SM–') }))} x="source" bars={basis === 'all' ? [{ key: 'admitted', label: 'Admitted' }] : [{ key: 'enquiries', label: 'Enquiries' }, { key: 'admitted', label: 'Admitted' }]} height={260} />
        </Card>
        <Card title="Share of admissions by channel">
          <ShareBars items={groups} />
        </Card>
      </div>
      <DataTable
        title="Source-wise conversion"
        exportName="admission-sources"
        rows={data}
        hideExport={false}
        columns={[
          { key: 'source', header: 'Source' },
          { key: 'group', header: 'Channel' },
          ...(basis === 'all' ? [] : [{ key: 'enquiries', header: 'Enquiries', className: 'text-right' }, { key: 'registered', header: 'Registered', className: 'text-right' }]),
          { key: 'admitted', header: 'Admitted', className: 'text-right' },
          ...(basis === 'all' ? [] : [{ key: 'conv', header: 'Conversion', value: (r) => pct(r.admitted, r.enquiries), render: (r) => `${pct(r.admitted, r.enquiries)}%`, className: 'text-right' }]),
        ]}
      />
      <div className="mt-16">
        <DataTable title="Admissions through references" rows={refs} hideExport columns={[{ key: 'type', header: 'Referred by' }, { key: 'admitted', header: 'Admitted', className: 'text-right' }]} />
      </div>
    </>
  );
}

export default function Admissions() {
  const { db, can, update, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null);
  const edit = can('admissions', 'edit');
  const e = db.enquiries;
  const by = (s) => e.filter((x) => x.stage === s).length;
  const dueFollow = e.filter((x) => (x.stage === 'Enquiry' || x.stage === 'Follow-up') && x.followUpDate && x.followUpDate <= addDays(todayISO(), 2));
  const drop = async (x) => {
    if (!(await confirm({ title: 'Mark as not interested?', message: `Close the enquiry from ${x.name}?`, confirmLabel: 'Close enquiry' }))) return;
    try {
      await update('enquiries', x.id, { stage: 'Not Interested' }, { audit: 'Closed enquiry', details: x.enquiryNo });
      toast.success('Enquiry closed.');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const actions = (r) =>
    edit ? (
      <>
        {(r.stage === 'Enquiry' || r.stage === 'Follow-up') && (
          <>
            <Button size="sm" variant="ghost" icon={PhoneCall} title="Schedule follow-up" onClick={() => setModal({ kind: 'follow', e: r })} />
            <Button size="sm" variant="ghost" icon={ClipboardPen} title="Register" onClick={() => setModal({ kind: 'register', e: r })} />
          </>
        )}
        {(r.stage === 'Registered' || r.stage === 'Follow-up' || r.stage === 'Enquiry') && can('students', 'edit') && (
          <Button size="sm" variant="ghost" icon={UserCheck} onClick={() => setModal({ kind: 'admit', e: r })}>
            Admit
          </Button>
        )}
        {r.stage !== 'Admitted' && r.stage !== 'Not Interested' && <Button size="sm" variant="ghost" icon={UserX} className="danger" title="Not interested" onClick={() => drop(r)} />}
      </>
    ) : null;
  const config = (extra = {}) => ({
    collection: 'enquiries',
    title: 'Enquiries',
    singular: 'Enquiry',
    module: 'admissions',
    noDeactivate: true,
    initialSort: { key: 'date', dir: 'desc' },
    defaults: () => ({ enquiryNo: 'ENQ-' + Date.now().toString().slice(-6), date: todayISO(), stage: 'Enquiry' }),
    canEditRow: (r) => r.stage !== 'Admitted',
    afterSave: async (rec, isNew) => {
      if (isNew && rec.phone)
        await sms([{ to: rec.phone, recipientName: rec.name, type: 'Admission', message: SMS_TEMPLATES.enquiry({ name: rec.name, program: labelOf(db, 'programs', rec.programId) }, settings) }]);
    },
    rowActions: actions,
    fields: [
      { key: 'enquiryNo', label: 'Enquiry no', required: true, unique: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'name', label: 'Candidate', required: true },
      { key: 'phone', label: 'Mobile', type: 'tel', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], table: false },
      { key: 'parentName', label: 'Parent name', table: false },
      { key: 'parentPhone', label: 'Parent mobile', type: 'tel', table: false },
      { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, filter: true },
      { key: 'source', label: 'Admission source', type: 'select', options: ADMISSION_SOURCES, required: true, filter: true },
      { key: 'referenceBy', label: 'Referred by (name)', table: false, hint: 'For Reference source' },
      { key: 'referenceType', label: 'Reference type', type: 'select', options: REFERENCE_TYPES, table: false },
      { key: 'counsellor', label: 'Counsellor', table: false },
      { key: 'entranceExam', label: 'Entrance exam', type: 'select', options: ['EAPCET', 'JEE Main', 'ECET (Lateral Entry)', 'Management Quota'], table: false },
      { key: 'rank', label: 'Rank', type: 'number', min: 1, table: false },
      { key: 'qualifyingPercent', label: 'Qualifying %', type: 'number', min: 0, max: 100, table: false },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, table: false },
      { key: 'followUpDate', label: 'Follow-up', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', table: false },
      { key: 'registrationNo', label: 'Registration no', form: false, table: false },
      { key: 'stage', label: 'Stage', type: 'select', options: ENQUIRY_STAGES, form: false, filter: true, render: (r) => <Badge>{r.stage}</Badge> },
    ],
    ...extra,
  });
  return (
    <>
      <PageHeader title="Enquiries & Admissions" subtitle="Student lifecycle from enquiry and registration to admission, with admission sources for the publicity team" />
      <div className="grid cols-4 stats">
        <StatCard label="Enquiries" value={e.length} icon={UserPlus} hint={`${by('Enquiry') + by('Follow-up')} open`} />
        <StatCard label="Registered" value={by('Registered')} icon={ClipboardPen} tone="violet" />
        <StatCard label="Admitted" value={by('Admitted')} icon={GraduationCap} tone="green" hint={`${pct(by('Admitted'), e.length)}% conversion`} />
        <StatCard label="Follow-ups due" value={dueFollow.length} icon={CalendarClock} tone={dueFollow.length ? 'amber' : 'green'} hint="Today and next 2 days" />
      </div>
      <UrlTabs
        tabs={[
          { id: 'enquiries', label: 'All enquiries' },
          { id: 'followups', label: 'Follow-ups due', count: dueFollow.length },
          { id: 'registered', label: 'Registered', count: by('Registered') },
          { id: 'sources', label: 'Admission sources' },
        ]}
      >
        {(t) =>
          t === 'sources' ? (
            <Sources />
          ) : t === 'followups' ? (
            <EntityPage config={config({ title: 'Follow-ups due', rowFilter: (r) => dueFollow.some((x) => x.id === r.id), initialSort: { key: 'followUpDate', dir: 'asc' } })} />
          ) : t === 'registered' ? (
            <EntityPage config={config({ title: 'Registered candidates (awaiting admission)', rowFilter: (r) => r.stage === 'Registered' })} />
          ) : (
            <EntityPage config={config()} />
          )
        }
      </UrlTabs>
      {!edit && (
        <p className="row xs muted mt-8">
          <CheckCheck className="icon-14" />
          View only.
        </p>
      )}
      {modal?.kind === 'follow' && <FollowUp e={modal.e} onClose={() => setModal(null)} />}
      {modal?.kind === 'register' && <Register e={modal.e} onClose={() => setModal(null)} />}
      {modal?.kind === 'admit' && <Admit e={modal.e} onClose={() => setModal(null)} />}
    </>
  );
}
