import { useState } from 'react';
import { ClipboardList, UserCheck, CheckCircle2, XCircle, Search, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { STORAGE_ENABLED, openDocument, uploadDocument, validateUpload } from '../../lib/upload';
import { useData } from '../../data/store';
import { labelOf } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { Alert, Button, Field, Modal, PageHeader, Select, StatCard, useConfirm, useToast } from '../../components/ui';
import { SimpleBar } from '../../components/charts';
import { Card } from '../../components/ui';
import { UserPlus, Clock, CheckCheck, GraduationCap } from 'lucide-react';
const DOCS = ['Intermediate Marksheet', 'Transfer Certificate', 'Rank Card', 'Caste Certificate', 'Aadhaar', 'Photographs'];
/**
 * Document checklist: upload each document, open it, and mark it verified.
 * Uploads are saved immediately; ticks are saved with the Save button.
 */
function Checklist({ a, onClose }) {
  const { db, update, can } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const applicant = db.applicants.find((x) => x.id === a.id) ?? a;
  const files = applicant.docFiles ?? {};
  const edit = can('admissions', 'edit');
  const [docs, setDocs] = useState({ ...Object.fromEntries(DOCS.map((d) => [d, false])), ...a.docs });
  const [busy, setBusy] = useState('');

  const upload = async (doc, file) => {
    if (!file) return;
    const v = validateUpload(file);
    if (v) return toast.error(v);
    setBusy(doc);
    try {
      const up = await uploadDocument(file, `admissions/${applicant.appNo}`);
      if (!up.stored) toast.info(`${file.name} is larger than 1.5 MB; in demo mode only its name is recorded.`);
      const next = { ...files, [doc]: { fileName: up.fileName, url: up.url, size: file.size, uploadedAt: new Date().toISOString() } };
      await update('applicants', applicant.id, { docFiles: next }, { audit: 'Document uploaded', details: `${applicant.appNo} · ${doc}` });
      toast.success(`${doc} uploaded.`);
    } catch (e) {
      toast.error(e.message ?? 'Upload failed.');
    } finally {
      setBusy('');
    }
  };
  const removeFile = async (doc) => {
    if (
      !(await confirm({
        title: 'Remove document?',
        message: `Remove the uploaded ${doc} (${files[doc]?.fileName})?`,
        confirmLabel: 'Remove',
      }))
    )
      return;
    const next = { ...files };
    delete next[doc];
    try {
      await update(
        'applicants',
        applicant.id,
        { docFiles: next, docs: { ...docs, [doc]: false } },
        { audit: 'Document removed', details: `${applicant.appNo} · ${doc}` },
      );
      setDocs((d) => ({ ...d, [doc]: false }));
      toast.success(`${doc} removed.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const save = async () => {
    try {
      await update('applicants', applicant.id, { docs }, { audit: 'Documents verified', details: applicant.appNo });
      toast.success('Document checklist saved.');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Documents · ${applicant.name} (${applicant.appNo})`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {edit && <Button onClick={save}>Save verification</Button>}
        </>
      }
    >
      <p className="muted mb-12">
        <b>Step 1:</b> upload each document (PDF or image). <b>Step 2:</b> open it with the eye icon and check it against the original.
        <b> Step 3:</b> tick <b>Verified</b> and click <b>Save verification</b>.
      </p>
      <div className="bordered">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Uploaded file</th>
              <th className="text-right">Actions</th>
              <th className="text-center">Verified</th>
            </tr>
          </thead>
          <tbody>
            {DOCS.map((d) => {
              const f = files[d];
              return (
                <tr key={d}>
                  <td className="strong">{d}</td>
                  <td>
                    {f ? (
                      <span className="row nowrap">
                        <FileText className="icon-16 muted" />
                        <span className="truncate" style={{ maxWidth: 220 }}>
                          {f.fileName}
                        </span>
                      </span>
                    ) : (
                      <span className="xs muted">Not uploaded</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="row end nowrap" style={{ gap: 2 }}>
                      {f?.url && <Button size="sm" variant="ghost" icon={Eye} title="View document" onClick={() => openDocument(f.url)} />}
                      {edit && (
                        <label
                          className={`btn btn-secondary btn-sm ${busy === d ? 'disabled' : ''}`}
                          title={f ? 'Replace file' : 'Upload file'}
                        >
                          <Upload />
                          {busy === d ? 'Uploading…' : f ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            hidden
                            disabled={!!busy}
                            onChange={(e) => {
                              upload(d, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                      {edit && f && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="danger"
                          title="Remove file"
                          onClick={() => removeFile(d)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={!!docs[d]}
                      disabled={!edit}
                      onChange={(e) => setDocs({ ...docs, [d]: e.target.checked })}
                      aria-label={`${d} verified`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="xs muted mt-8">
        {STORAGE_ENABLED
          ? 'Files are stored securely in Firebase Storage.'
          : 'Demo mode: files up to 1.5 MB are stored in this browser; configure Firebase Storage for production.'}
      </p>
    </Modal>
  );
}

function Convert({ a, onClose }) {
  const { db, ayId, create, update, can, notify } = useData();
  const toast = useToast();
  const prog = db.programs.find((p) => p.id === a.programId);
  const sections = db.sections.filter((s) => s.programId === a.programId && s.academicYearId === ayId && s.semesterNo === 1);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const missing = DOCS.filter((d) => d !== 'Caste Certificate' && !a.docs?.[d]);
  const go = async () => {
    if (!sectionId) {
      toast.error('Select a section.');
      return;
    }
    setBusy(true);
    try {
      const sec = db.sections.find((s) => s.id === sectionId);
      const dept = db.departments.find((d) => d.id === prog?.departmentId);
      const year = new Date().getFullYear();
      const count = db.students.filter((s) => s.sectionId === sectionId).length + 1;
      const st = await create(
        'students',
        {
          rollNo: `${String(year).slice(2)}KV1A${String(db.departments.indexOf(dept) + 1).padStart(2, '0')}${String(count + 50).padStart(2, '0')}`,
          name: a.name,
          email: a.email,
          phone: a.phone,
          gender: a.gender,
          dob: a.dob,
          departmentId: prog.departmentId,
          programId: a.programId,
          sectionId,
          semesterNo: sec.semesterNo,
          batch: `${year}-${year + (prog?.durationYears ?? 4)}`,
          admissionYear: year,
          parentName: 'To be updated',
          parentPhone: a.phone,
          category: a.category,
          status: 'Active',
        },
        { audit: 'Admitted', details: `${a.appNo} → ${a.name}` },
      );
      const fs = db.feeStructures.find((f) => f.programId === a.programId && f.academicYearId === ayId);
      if (fs && !can('finance', 'edit'))
        await notify({
          role: 'finance',
          title: 'Fee invoice required',
          message: `New admission ${a.name} (${a.appNo}) needs a fee invoice.`,
          link: '/admin/finance',
        });
      else if (fs)
        await create('invoices', {
          invoiceNo: 'INV-' + Date.now().toString().slice(-7),
          studentId: st.id,
          academicYearId: ayId,
          feeStructureId: fs.id,
          description: fs.name,
          amount: fs.tuition + fs.exam + fs.development + fs.other,
          dueDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
          paid: 0,
          status: 'Unpaid',
        });
      await update('applicants', a.id, { status: 'Admitted', studentId: st.id }, { audit: 'Converted to student' });
      toast.success(`${a.name} admitted as ${st.rollNo}${fs ? '; fee invoice generated' : ''}.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Convert applicant to student"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={UserCheck} onClick={go} loading={busy} disabled={!sections.length}>
            Admit student
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>
          <b>{a.name}</b> · {a.appNo}
          <br />
          <span className="muted">{prog?.name}</span>
        </p>
        {missing.length > 0 && <Alert tone="warning">Missing documents: {missing.join(', ')}. You may still admit provisionally.</Alert>}
        {!sections.length ? (
          <Alert tone="error">
            No first-semester section exists for this program in the selected academic year. Create one in Academic Structure.
          </Alert>
        ) : (
          <Field label="Allocate to section" required>
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {labelOf(db, 'sections', s.id)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <p className="xs muted">A student record is created and, if a fee structure exists, a fee invoice is generated automatically.</p>
      </div>
    </Modal>
  );
}
export default function Admissions() {
  const { db, can, update } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [check, setCheck] = useState(null);
  const [conv, setConv] = useState(null);
  const edit = can('admissions', 'edit');
  const setStatus = async (a, status) => {
    if (
      status === 'Rejected' &&
      !(await confirm({ title: 'Reject application?', message: `Reject ${a.name}'s application (${a.appNo})?`, confirmLabel: 'Reject' }))
    )
      return;
    try {
      await update('applicants', a.id, { status }, { audit: status, details: a.appNo });
      toast.success(`Application ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const byProg = db.programs.map((p) => ({
    program: p.code,
    Applications: db.applicants.filter((a) => a.programId === p.id).length,
    Admitted: db.applicants.filter((a) => a.programId === p.id && a.status === 'Admitted').length,
  }));
  return (
    <>
      <PageHeader title="Admissions" subtitle="Applicants, document verification, program allocation and conversion to student records" />
      <div className="grid cols-4 stats">
        <StatCard label="Applications" value={db.applicants.length} icon={UserPlus} />
        <StatCard
          label="Under review"
          value={db.applicants.filter((a) => a.status === 'Under Review' || a.status === 'Applied').length}
          icon={Clock}
          tone="amber"
        />
        <StatCard label="Approved" value={db.applicants.filter((a) => a.status === 'Approved').length} icon={CheckCheck} tone="blue" />
        <StatCard label="Admitted" value={db.applicants.filter((a) => a.status === 'Admitted').length} icon={GraduationCap} tone="green" />
      </div>
      <Card title="Applications by program" className="mb-16">
        <SimpleBar
          data={byProg}
          x="program"
          bars={[
            { key: 'Applications', label: 'Applications' },
            { key: 'Admitted', label: 'Admitted' },
          ]}
          height={200}
        />
      </Card>
      <EntityPage
        config={{
          collection: 'applicants',
          title: 'Applicants',
          singular: 'Applicant',
          module: 'admissions',
          initialSort: { key: 'appliedOn', dir: 'desc' },
          defaults: () => ({
            appNo: 'ADM27' + String(Date.now()).slice(-5),
            status: 'Applied',
            appliedOn: new Date().toISOString().slice(0, 10),
            docs: {},
          }),
          canEditRow: (r) => r.status !== 'Admitted',
          rowActions: (r) =>
            edit ? (
              <>
                <Button size="sm" variant="ghost" icon={ClipboardList} onClick={() => setCheck(r)} title="Upload & verify documents">
                  Documents
                </Button>
                {r.status === 'Applied' && (
                  <Button size="sm" variant="ghost" icon={Search} onClick={() => setStatus(r, 'Under Review')} title="Start review" />
                )}
                {(r.status === 'Under Review' || r.status === 'Applied') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={CheckCircle2}
                    className="text-green"
                    onClick={() => setStatus(r, 'Approved')}
                    title="Approve"
                  />
                )}
                {(r.status === 'Under Review' || r.status === 'Applied') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={XCircle}
                    className="text-red"
                    onClick={() => setStatus(r, 'Rejected')}
                    title="Reject"
                  />
                )}
                {r.status === 'Approved' && (
                  <Button size="sm" variant="ghost" icon={UserCheck} onClick={() => setConv(r)}>
                    Admit
                  </Button>
                )}
              </>
            ) : null,
          fields: [
            { key: 'appNo', label: 'Application no', required: true, unique: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true, table: false },
            { key: 'phone', label: 'Phone', type: 'tel', required: true, table: false },
            { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true, table: false },
            { key: 'dob', label: 'Date of birth', type: 'date', required: true, table: false },
            { key: 'programId', label: 'Program', type: 'ref', ref: 'programs', required: true, filter: true },
            {
              key: 'entranceExam',
              label: 'Entrance exam',
              type: 'select',
              options: ['EAPCET', 'JEE Main', 'GATE', 'PGECET', 'Management Quota'],
              required: true,
              filter: true,
            },
            { key: 'rank', label: 'Rank', type: 'number', min: 1 },
            { key: 'qualifyingPercent', label: 'Qualifying %', type: 'number', min: 0, max: 100, required: true },
            {
              key: 'category',
              label: 'Category',
              type: 'select',
              options: ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'SC', 'ST', 'EWS'],
              required: true,
              table: false,
            },
            {
              key: 'docsOk',
              label: 'Documents',
              form: false,
              value: (r) =>
                `${Object.keys(r.docFiles ?? {}).length} uploaded · ${Object.values(r.docs ?? {}).filter(Boolean).length}/${DOCS.length} verified`,
            },
            { key: 'appliedOn', label: 'Applied on', type: 'date', required: true },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Applied', 'Under Review', 'Approved', 'Rejected', 'Admitted'],
              form: false,
              filter: true,
            },
          ],
        }}
      />
      {check && <Checklist a={check} onClose={() => setCheck(null)} />}
      {conv && <Convert a={conv} onClose={() => setConv(null)} />}
    </>
  );
}
