import { useState } from 'react';
import { CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { options } from '../../data/labels';
import { EntityPage } from '../../components/EntityPage';
import { Alert, Button, Field, Input, Modal, PageHeader, Select, StatCard, useToast } from '../../components/ui';
import { STORAGE_ENABLED, openDocument, uploadDocument, validateUpload } from '../../lib/upload';
import { FolderOpen, Clock, CheckCheck } from 'lucide-react';
const DOC_TYPES = [
  'Syllabus',
  'Lesson Plan',
  'Lecture Notes',
  'Question Paper',
  'Assignment Evidence',
  'CO Attainment Sheet',
  'Lab Manual',
  'Course Report',
  'Other',
];
const CRITERIA = [
  'NBA C2 – Teaching-Learning',
  'NBA C3 – CO & PO Attainment',
  'NBA C4 – Student Performance',
  'NAAC C2 – Teaching-Learning & Evaluation',
  'NAAC C3 – Research & Innovation',
];
function UploadModal({ onClose }) {
  const { user } = useAuth();
  const { db, ayId, create } = useData();
  const scope = useScope();
  const toast = useToast();
  const [f, setF] = useState({ courseId: '', title: '', docType: 'Lecture Notes', criterion: '' });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const courseOpts = options(
    db,
    'courses',
    (c) => scope.courseAllowed(c.id) && db.allocations.some((a) => a.courseId === c.id && a.academicYearId === ayId),
  );
  const submit = async () => {
    setErr('');
    if (!f.courseId || !f.title.trim()) return setErr('Course and title are required.');
    if (!file) return setErr('Choose a file to upload.');
    const v = validateUpload(file);
    if (v) return setErr(v);
    setBusy(true);
    try {
      const c = db.courses.find((x) => x.id === f.courseId);
      const up = await uploadDocument(file, `course-files/${ayId}/${c.code}`);
      await create(
        'courseFiles',
        {
          ...f,
          academicYearId: ayId,
          departmentId: c.departmentId,
          semesterNo: c.semesterNo,
          fileName: up.fileName,
          url: up.url,
          uploadedById: user.employeeId,
          status: 'Pending Review',
          criterion: f.criterion || undefined,
        },
        { audit: 'Uploaded' },
      );
      toast.success(up.stored ? 'Document uploaded.' : 'Document recorded (demo mode: metadata only).');
      onClose();
    } catch (e) {
      setErr(e.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Upload course document"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Upload} onClick={submit} loading={busy}>
            Upload
          </Button>
        </>
      }
    >
      <div className="stack">
        {!STORAGE_ENABLED && (
          <Alert tone="warning">
            Demo mode: files up to 1.5 MB are stored in this browser and can be opened; larger files record the file name only. Configure
            Firebase Storage for production.
          </Alert>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Course" required>
          <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
            <option value="">Select…</option>
            {courseOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-grid">
          <Field label="Title" required>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Document type" required>
            <Select value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })}>
              {DOC_TYPES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Accreditation criterion (optional)">
          <Select value={f.criterion} onChange={(e) => setF({ ...f, criterion: e.target.value })}>
            <option value="">None</option>
            {CRITERIA.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="File" required hint="PDF, Office, image, text or ZIP · max 15 MB">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}
export default function CourseFiles() {
  const { user } = useAuth();
  const { db, ayId, can, update } = useData();
  const toast = useToast();
  const [upload, setUpload] = useState(false);
  const reviewer = ['hod', 'program-coordinator', 'dean', 'iqac'].includes(user.role) && can('course-files', 'edit');
  const rows = db.courseFiles.filter((f) => f.academicYearId === ayId);
  const setStatus = async (r, status) => {
    try {
      await update('courseFiles', r.id, { status }, { audit: status, details: r.title });
      toast.success(`Marked as ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader title="Course Files" subtitle="Course documents, lesson plans, teaching materials and assessment evidence" />
      <div className="grid cols-3 stats">
        <StatCard label="Documents" value={rows.length} icon={FolderOpen} />
        <StatCard label="Approved" value={rows.filter((r) => r.status === 'Approved').length} icon={CheckCheck} tone="green" />
        <StatCard label="Pending review" value={rows.filter((r) => r.status === 'Pending Review').length} icon={Clock} tone="amber" />
      </div>
      <EntityPage
        config={{
          collection: 'courseFiles',
          title: 'Course files',
          singular: 'Course File',
          module: 'course-files',
          ayFiltered: true,
          canCreate: false,
          rowFilter: (r, { scope }) =>
            scope.personal
              ? r.semesterNo === scope.linkedStudent?.semesterNo &&
                r.departmentId === scope.linkedStudent?.departmentId &&
                r.status === 'Approved'
              : scope.courseAllowed(r.courseId),
          toolbar: can('course-files', 'edit') ? (
            <Button size="sm" icon={Upload} onClick={() => setUpload(true)}>
              Upload document
            </Button>
          ) : undefined,
          rowActions: (r) => (
            <>
              {r.url && <Button size="sm" variant="ghost" icon={Download} title="Open document" onClick={() => openDocument(r.url)} />}
              {reviewer && r.status !== 'Approved' && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={CheckCircle2}
                  className="text-green"
                  title="Approve"
                  onClick={() => setStatus(r, 'Approved')}
                />
              )}
              {reviewer && r.status === 'Pending Review' && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  className="text-amber"
                  title="Needs revision"
                  onClick={() => setStatus(r, 'Needs Revision')}
                />
              )}
            </>
          ),
          fields: [
            { key: 'title', label: 'Title', required: true },
            {
              key: 'courseId',
              label: 'Course',
              type: 'ref',
              ref: 'courses',
              required: true,
              value: (r, d) => d.courses.find((c) => c.id === r.courseId)?.code,
            },
            { key: 'departmentId', label: 'Department', type: 'ref', ref: 'departments', filter: true, readOnly: true },
            { key: 'semesterNo', label: 'Semester', type: 'number', filter: true, readOnly: true },
            { key: 'docType', label: 'Type', type: 'select', options: DOC_TYPES, required: true, filter: true },
            { key: 'criterion', label: 'Accreditation criterion', type: 'select', options: CRITERIA, table: false },
            { key: 'fileName', label: 'File', readOnly: true },
            { key: 'uploadedById', label: 'Uploaded by', type: 'ref', ref: 'employees', readOnly: true, table: false },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: ['Pending Review', 'Approved', 'Needs Revision'],
              filter: true,
              form: false,
            },
          ],
        }}
      />
      {upload && <UploadModal onClose={() => setUpload(false)} />}
    </>
  );
}
