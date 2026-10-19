import { useState } from 'react';
import { Database, Lock, RotateCcw, Save, UploadCloud } from 'lucide-react';
import { useData } from '../../data/store';
import { seedFirestore } from '../../data/firestoreBackend';
import { generateSeed } from '../../data/seed';
import { EntityPage } from '../../components/EntityPage';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Button, Card, Field, Input, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { SESSION_TIMEOUT_MIN } from '../../config/firebase';

function General() {
  const { settings, db, update, mode, resetDemo, can } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(settings)));
  const [saving, setSaving] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const edit = can('settings', 'edit');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const num = (k) => (e) => set(k, Number(e.target.value));
  const save = async () => {
    if (!f.institutionName?.trim()) return toast.error('Institution name is required.');
    if (!f.signatoryName?.trim()) return toast.error('Certificate signatory is required.');
    if (f.smsSenderId && !/^[A-Z]{6}$/.test(f.smsSenderId)) return toast.error('SMS sender id must be 6 capital letters (DLT header).');
    setSaving(true);
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, active: _a, ...rest } = f;
      await update('settings', settings.id, rest, { audit: 'Updated', details: 'Institution settings' });
      toast.success('Settings saved.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const doReset = async () => {
    if (await confirm({ title: 'Reset demo data?', message: 'All changes made in this browser will be discarded and the synthetic dataset regenerated.', confirmLabel: 'Reset data' })) await resetDemo();
  };
  const doSeed = async () => {
    if (!(await confirm({ title: 'Seed Firestore?', message: 'Writes the synthetic dataset (except users and audit logs) into Firestore. Use only on an empty development project.', confirmLabel: 'Seed database', tone: 'primary' })))
      return;
    try {
      await seedFirestore(generateSeed(), (m) => setSeedMsg(m));
      toast.success('Firestore seeded.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      {edit && (
        <div className="row end mb-12">
          <Button icon={Save} onClick={save} loading={saving}>
            Save settings
          </Button>
        </div>
      )}
      <fieldset disabled={!edit} className="grid cols-2">
        <Card title="Institution">
          <div className="form-grid">
            <Field label="Institution name" required className="full">
              <Input value={f.institutionName ?? ''} onChange={(e) => set('institutionName', e.target.value)} />
            </Field>
            <Field label="Short name">
              <Input value={f.shortName ?? ''} onChange={(e) => set('shortName', e.target.value)} />
            </Field>
            <Field label="Current academic year">
              <Select value={f.currentAcademicYearId} onChange={(e) => set('currentAcademicYearId', e.target.value)}>
                {db.academicYears.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Address" className="full">
              <Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Affiliation / approvals" className="full">
              <Input value={f.affiliation ?? ''} onChange={(e) => set('affiliation', e.target.value)} />
            </Field>
            <Field label="Affiliating university" className="full" hint="Receives university and examination fees">
              <Input value={f.universityName ?? ''} onChange={(e) => set('universityName', e.target.value)} />
            </Field>
          </div>
        </Card>
        <Card title="Accounts & payments">
          <div className="form-grid">
            <Field label="Books opened on">
              <Input type="date" value={f.openingDate ?? ''} onChange={(e) => set('openingDate', e.target.value)} />
            </Field>
            <span />
            <Field label="Opening cash balance (₹)">
              <Input type="number" value={f.openingCash ?? 0} onChange={num('openingCash')} />
            </Field>
            <Field label="Opening bank balance (₹)">
              <Input type="number" value={f.openingBank ?? 0} onChange={num('openingBank')} />
            </Field>
            <Field label="Payment gateway">
              <Select value={f.paymentGateway ?? 'Razorpay'} onChange={(e) => set('paymentGateway', e.target.value)}>
                <option>Razorpay</option>
              </Select>
            </Field>
            <Field label="Online payments for students">
              <label className="check-row">
                <input type="checkbox" className="checkbox" checked={!!f.gatewayEnabled} onChange={(e) => set('gatewayEnabled', e.target.checked)} />
                Enabled
              </label>
            </Field>
          </div>
        </Card>
        <Card title="SMS alerts">
          <div className="form-grid">
            <Field label="Sender id (DLT header)" hint="6 capital letters, e.g. KVCENG">
              <Input value={f.smsSenderId ?? ''} onChange={(e) => set('smsSenderId', e.target.value.toUpperCase())} maxLength={6} />
            </Field>
            <Field label="Fee alert: days before cut-off">
              <Input type="number" min={0} max={60} value={f.reminderDaysBefore ?? 7} onChange={num('reminderDaysBefore')} />
            </Field>
          </div>
        </Card>
        <Card title="Certificates & hostel">
          <div className="form-grid">
            <Field label="Authorised signatory" required>
              <Input value={f.signatoryName ?? ''} onChange={(e) => set('signatoryName', e.target.value)} />
            </Field>
            <Field label="Designation">
              <Input value={f.signatoryDesignation ?? ''} onChange={(e) => set('signatoryDesignation', e.target.value)} />
            </Field>
            <Field label="Hostel return time" hint="Returns after this time are marked late">
              <Input type="time" value={f.hostelReturnTime ?? '19:00'} onChange={(e) => set('hostelReturnTime', e.target.value)} />
            </Field>
          </div>
        </Card>
      </fieldset>
      <Card
        title={
          <span className="row">
            <Lock className="icon-16" />
            Data privacy & security
          </span>
        }
        className="mt-16"
      >
        <ul className="stack tight small">
          <li>Every user has an individual login; the Principal, Accounts, Admin, Staff, Warden and Student roles each see only their permitted modules.</li>
          <li>Students can read only their own record, fees, hostel leave and certificates — enforced by the data layer and by Firestore security rules on the server.</li>
          <li>Parent mobile numbers are masked for roles that do not contact parents; salaries are visible only to Accounts, Admin and the Principal.</li>
          <li>Passwords are never stored in plain text ({mode === 'demo' ? 'PBKDF2-SHA256 hashes in demo mode' : 'Firebase Authentication'}); repeated failed sign-ins lock the account temporarily.</li>
          <li>Sessions end after {SESSION_TIMEOUT_MIN} minutes of inactivity, and sign-out clears cached data from the browser.</li>
          <li>Creates, edits, approvals, payments, certificate downloads and sign-ins are written to an append-only audit log.</li>
          <li>Payments are confirmed only by the server after the gateway signature is verified; certificates carry a server-side digital signature.</li>
        </ul>
      </Card>
      {edit && (
        <Card title="Data management" className="mt-16">
          {mode === 'demo' ? (
            <div className="row between">
              <Alert tone="warning">Demo mode: data is stored in this browser (IndexedDB). Resetting regenerates the synthetic dataset.</Alert>
              <Button variant="danger" icon={RotateCcw} onClick={doReset}>
                Reset demo data
              </Button>
            </div>
          ) : (
            <div className="row">
              <Button variant="secondary" icon={UploadCloud} onClick={doSeed}>
                Seed Firestore with demo data
              </Button>
              <span className="xs muted">{seedMsg}</span>
            </div>
          )}
          <p className="row mt-12 xs muted">
            <Database className="icon-14" />
            Backend: {mode === 'demo' ? 'Demo (browser IndexedDB)' : 'Cloud Firestore'}
          </p>
        </Card>
      )}
    </>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Institution Settings" subtitle="Institution profile, accounts, SMS, certificates, departments, programs and academic years" />
      <UrlTabs
        tabs={[
          { id: 'general', label: 'General' },
          { id: 'departments', label: 'Departments' },
          { id: 'programs', label: 'Programs' },
          { id: 'years', label: 'Academic years' },
        ]}
      >
        {(t) =>
          t === 'departments' ? (
            <EntityPage
              config={{
                collection: 'departments',
                title: 'Departments',
                singular: 'Department',
                module: 'settings',
                fields: [
                  { key: 'code', label: 'Code', required: true, unique: true },
                  { key: 'name', label: 'Name', required: true, unique: true },
                ],
              }}
            />
          ) : t === 'programs' ? (
            <EntityPage
              config={{
                collection: 'programs',
                title: 'Programs',
                singular: 'Program',
                module: 'settings',
                fields: [
                  { key: 'code', label: 'Code', required: true, unique: true },
                  { key: 'name', label: 'Name', required: true },
                  { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', required: true, filter: true },
                  { key: 'durationYears', label: 'Duration (years)', type: 'number', min: 1, max: 6, required: true },
                  { key: 'intake', label: 'Intake', type: 'number', min: 1 },
                ],
              }}
            />
          ) : t === 'years' ? (
            <EntityPage
              config={{
                collection: 'academicYears',
                title: 'Academic years',
                singular: 'Academic Year',
                module: 'settings',
                fields: [
                  { key: 'name', label: 'Name', required: true, unique: true, hint: 'e.g. 2027-28' },
                  { key: 'startDate', label: 'Start', type: 'date', required: true },
                  { key: 'endDate', label: 'End', type: 'date', required: true, validate: (v, f) => (v <= f.startDate ? 'End must be after start' : undefined) },
                  { key: 'current', label: 'Current', type: 'checkbox' },
                ],
              }}
            />
          ) : (
            <General />
          )
        }
      </UrlTabs>
    </>
  );
}
