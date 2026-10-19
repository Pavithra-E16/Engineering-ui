import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, UserMinus, Users, BedDouble } from 'lucide-react';
import { useData } from '../../data/store';
import { EntityPage } from '../../components/EntityPage';
import { Alert, Button, Field, Input, Modal, PageHeader, Select, StatCard, useToast } from '../../components/ui';
import { ADMISSION_SOURCES, CATEGORIES, DISCOUNT_REASONS, QUOTAS, REFERENCE_TYPES, SCHOLARSHIP_SCHEMES, STUDENT_STATUSES, ledger } from '../../lib/domain';
import { SMS_TEMPLATES, maskPhone, toParent, useSms } from '../../lib/sms';
import { fmtMoney, todayISO } from '../../lib/utils';
import { useAuth } from '../../auth/AuthProvider';

/** Relieve a student (transfer / discontinuation / completion): records date, reason and checks dues. */
export function Relieve({ st, onClose }) {
  const { db, update, settings } = useData();
  const sms = useSms();
  const toast = useToast();
  const [f, setF] = useState({ status: 'Relieved', relievedOn: todayISO(), relievingReason: '' });
  const [err, setErr] = useState('');
  const dues = ledger(db, st.id).balance;
  const save = async () => {
    if (!f.relievingReason.trim()) return setErr('Enter the reason for relieving.');
    try {
      await update('students', st.id, { ...f, relievingReason: f.relievingReason.trim(), hosteller: false }, { audit: f.status, details: `${st.rollNo} – ${f.relievingReason}` });
      const alloc = db.hostelAllocations.find((a) => a.studentId === st.id && a.status === 'Allocated');
      if (alloc) await update('hostelAllocations', alloc.id, { status: 'Vacated', toDate: f.relievedOn }, { audit: 'Vacated' }).catch(() => {});
      await sms([toParent(st, 'Student Activity', SMS_TEMPLATES.relieved({ st, date: f.relievedOn }, settings))]);
      toast.success(`${st.name} marked as ${f.status.toLowerCase()}.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Relieve · ${st.name} (${st.rollNo})`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" icon={LogOut} onClick={save}>
            Relieve student
          </Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        {dues > 0 && <Alert tone="warning">Outstanding fee of {fmtMoney(dues)} — collect or record before issuing the Transfer Certificate.</Alert>}
        <Field label="New status">
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STUDENT_STATUSES.filter((s) => s !== 'Active').map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Relieving date">
          <Input type="date" value={f.relievedOn} onChange={(e) => setF({ ...f, relievedOn: e.target.value })} />
        </Field>
        <Field label="Reason" required>
          <Input value={f.relievingReason} onChange={(e) => setF({ ...f, relievingReason: e.target.value })} placeholder="e.g. Transfer to another college" />
        </Field>
      </div>
    </Modal>
  );
}

export default function Students() {
  const { db, can } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [relieve, setRelieve] = useState(null);
  const edit = can('students', 'edit');
  // Data privacy: only roles that contact parents see full mobile numbers.
  const fullContact = ['principal', 'admin', 'finance', 'admission', 'warden'].includes(user?.role);
  const s = db.students;
  return (
    <>
      <PageHeader title="Students" subtitle="Complete student details: admission, fees, scholarships, discounts, activities and relieving" />
      <div className="grid cols-4 stats">
        <StatCard label="Active students" value={s.filter((x) => x.status === 'Active').length} icon={Users} />
        <StatCard label="Hostellers" value={s.filter((x) => x.status === 'Active' && x.hosteller).length} icon={BedDouble} tone="violet" />
        <StatCard label="With scholarship" value={s.filter((x) => x.status === 'Active' && x.scholarshipScheme).length} icon={GraduationCap} tone="green" />
        <StatCard label="Relieved / left" value={s.filter((x) => x.status !== 'Active').length} icon={UserMinus} tone="slate" />
      </div>
      <EntityPage
        config={{
          collection: 'students',
          title: 'Student records',
          singular: 'Student',
          module: 'students',
          initialSort: { key: 'rollNo', dir: 'asc' },
          defaults: () => ({ status: 'Active', year: 1, quota: 'Convener', admissionDate: todayISO() }),
          beforeSave: (f) => ({ ...f, year: Number(f.year), admissionYear: f.admissionDate ? Number(f.admissionDate.slice(0, 4)) : f.admissionYear }),
          rowActions: (r) => (
            <>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/students/${r.id}`)}>
                Profile
              </Button>
              {edit && r.status === 'Active' && <Button size="sm" variant="ghost" icon={LogOut} className="danger" title="Relieve student" onClick={() => setRelieve(r)} />}
            </>
          ),
          fields: [
            { key: 'rollNo', label: 'Roll no', required: true, unique: true },
            { key: 'admissionNo', label: 'Admission no', required: true, unique: true, table: false },
            { key: 'name', label: 'Name', required: true },
            { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true, table: false },
            { key: 'dob', label: 'Date of birth', type: 'date', table: false },
            { key: 'phone', label: 'Student mobile', type: 'tel', table: false },
            { key: 'email', label: 'Email', type: 'email', table: false },
            { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
            { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, table: false, refFilter: (p, f) => !f.departmentId || p.departmentId === f.departmentId },
            { key: 'year', label: 'Year', type: 'select', options: [1, 2, 3, 4], required: true, filter: true },
            { key: 'batch', label: 'Batch', table: false },
            { key: 'admissionDate', label: 'Admission date', type: 'date', table: false },
            { key: 'quota', label: 'Quota', type: 'select', options: QUOTAS, table: false },
            { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, table: false },
            { key: 'parentName', label: 'Parent / guardian', required: true },
            {
              key: 'parentPhone',
              label: 'Parent mobile (SMS)',
              type: 'tel',
              required: true,
              render: (r) => (fullContact ? r.parentPhone : maskPhone(r.parentPhone)),
            },
            { key: 'address', label: 'Address', wide: true, table: false },
            { key: 'admissionSource', label: 'Admission source', type: 'select', options: ADMISSION_SOURCES, filter: true, table: false },
            { key: 'referenceBy', label: 'Referred by', table: false },
            { key: 'referenceType', label: 'Reference type', type: 'select', options: REFERENCE_TYPES, table: false },
            { key: 'scholarshipScheme', label: 'Scholarship', type: 'select', options: SCHOLARSHIP_SCHEMES, table: false, filter: true },
            { key: 'scholarshipAmount', label: 'Scholarship amount / yr', type: 'money', min: 0, table: false },
            { key: 'discountReason', label: 'Discount', type: 'select', options: DISCOUNT_REASONS, table: false },
            { key: 'discountAmount', label: 'Discount amount / yr', type: 'money', min: 0, table: false },
            { key: 'hosteller', label: 'Hosteller', type: 'checkbox', filter: false },
            { key: 'status', label: 'Status', type: 'select', options: STUDENT_STATUSES, required: true, filter: true },
            { key: 'relievedOn', label: 'Relieved on', type: 'date', table: false },
            { key: 'relievingReason', label: 'Relieving reason', table: false },
          ],
        }}
      />
      {relieve && <Relieve st={relieve} onClose={() => setRelieve(null)} />}
    </>
  );
}
