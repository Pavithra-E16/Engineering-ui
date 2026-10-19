import { useState } from 'react';
import { Award, Ban, CheckCircle2, Clock, Download, FilePlus2, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { DataTable } from '../../components/DataTable';
import { UrlTabs } from '../../components/TabbedEntities';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, useConfirm, useToast } from '../../components/ui';
import { CERT_TYPES, ledger } from '../../lib/domain';
import { CERT_APPROVERS } from '../../lib/roles';
import { canonical, certificateContext, newVerificationId, openCertificate, sha256 } from '../../lib/certificates';
import { SMS_TEMPLATES, useSms } from '../../lib/sms';
import { fmtDate, fmtDateTime, nowISO, todayISO } from '../../lib/utils';
import { VerifyPanel } from './Verify';

/** New certificate request. The roll number is checked against the student's record before it is accepted. */
function RequestForm({ onClose }) {
  const { db, create } = useData();
  const scope = useScope();
  const toast = useToast();
  const [f, setF] = useState({ studentId: scope.linkedStudent?.id ?? '', rollNo: '', type: CERT_TYPES[0], purpose: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    const st = db.students.find((s) => s.id === f.studentId);
    if (!st) return setErr('Select the student.');
    if (f.rollNo.trim().toUpperCase() !== st.rollNo.toUpperCase()) return setErr('Roll number does not match the student record. Please check and re-enter it.');
    if (!f.purpose.trim()) return setErr('State the purpose of the certificate.');
    if (db.certificates.some((c) => c.studentId === st.id && c.type === f.type && c.status === 'Pending')) return setErr(`A ${f.type} request is already pending.`);
    if (f.type === 'Transfer Certificate' && st.status === 'Active') return setErr('A Transfer Certificate is issued only after the student is relieved.');
    try {
      await create('certificates', {
        requestNo: 'CR-' + Date.now().toString().slice(-7),
        studentId: st.id,
        rollNo: st.rollNo,
        type: f.type,
        purpose: f.purpose.trim(),
        requestedOn: todayISO(),
        status: 'Pending',
      });
      toast.success('Request submitted. You will be notified when it is authorised.');
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Request a certificate"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Submit request</Button>
        </>
      }
    >
      <div className="stack">
        {err && <Alert tone="error">{err}</Alert>}
        {!scope.personal && (
          <Field label="Student" required>
            <Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
              <option value="">Select…</option>
              {options(db, 'students').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Roll number" required hint="Enter the roll number exactly as on the ID card; it is validated against the college record">
          <Input value={f.rollNo} onChange={(e) => setF({ ...f, rollNo: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Certificate" required>
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {CERT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Purpose" required>
          <Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Bank education loan" />
        </Field>
      </div>
    </Modal>
  );
}

function Reject({ c, onClose }) {
  const { user } = useAuth();
  const { update } = useData();
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const go = async () => {
    if (!remarks.trim()) return toast.error('Enter the reason for rejection.');
    try {
      await update('certificates', c.id, { status: 'Rejected', remarks: remarks.trim(), reviewedBy: user.role, reviewedByName: user.name, reviewedAt: nowISO() }, { audit: 'Certificate rejected', details: c.requestNo });
      toast.success('Request rejected.');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reject ${c.requestNo}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={go}>
            Reject
          </Button>
        </>
      }
    >
      <Field label="Reason (shown to the student)" required>
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function Certificates() {
  const { user } = useAuth();
  const { db, ayId, can, update, create, settings, mode } = useData();
  const scope = useScope();
  const sms = useSms();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null);
  const approver = CERT_APPROVERS.includes(user?.role);
  const stu = (id) => db.students.find((s) => s.id === id);
  const downloads = (c) => db.certificateDownloads.filter((d) => d.certificateId === c.id);
  const rollOk = (c) => stu(c.studentId)?.rollNo?.toUpperCase() === c.rollNo?.toUpperCase();

  /** Admin authorisation: assigns certificate no + verification id and applies the digital signature. */
  const approve = async (c) => {
    const st = stu(c.studentId);
    if (!st || !rollOk(c)) return toast.error('Roll number validation failed — reject this request.');
    const dues = ledger(db, st.id).balance;
    const ok = await confirm({
      title: `Authorise ${c.type}?`,
      message: `${st.name} (${st.rollNo}). The certificate will be digitally signed by ${settings.signatoryName}, ${settings.signatoryDesignation}.${dues > 0 ? ` Note: ${dues.toLocaleString('en-IN')} rupees fee outstanding.` : ''}`,
      confirmLabel: 'Authorise & sign',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      const seq = String(db.certificates.filter((x) => x.certificateNo).length + 1).padStart(4, '0');
      const payload = {
        certificateNo: `${settings.shortName ?? 'COL'}/CERT/${todayISO().slice(0, 4)}/${seq}`,
        verificationId: newVerificationId((settings.shortName ?? 'KV').slice(0, 2).toUpperCase()),
        type: c.type,
        studentName: st.name,
        rollNo: st.rollNo,
        issuedOn: todayISO(),
        signatoryName: settings.signatoryName,
        signatoryDesignation: settings.signatoryDesignation,
      };
      // Firebase: the onCertificateApproved Cloud Function replaces this with an HMAC made with a server secret.
      const signature = mode === 'demo' ? await sha256(canonical(payload)) : 'pending-server-signature';
      const { studentName, ...certFields } = payload;
      void studentName;
      await update(
        'certificates',
        c.id,
        { ...certFields, status: 'Approved', signature, reviewedBy: user.role, reviewedByName: user.name, reviewedAt: nowISO() },
        { audit: 'Certificate authorised', details: `${c.requestNo} · ${payload.certificateNo}` },
      );
      await create(
        'certificateVerifications',
        {
          id: payload.verificationId,
          certificateId: c.id,
          studentId: st.id,
          ...payload,
          program: db.programs.find((p) => p.id === st.programId)?.name ?? '',
          signature,
          status: 'Valid',
        },
        { audit: false },
      );
      if (st.phone) await sms([{ to: st.phone, recipientName: st.name, studentId: st.id, type: 'Certificate', message: SMS_TEMPLATES.certificate({ st, type: c.type }, settings) }]);
      toast.success(`${c.type} authorised and digitally signed (${payload.verificationId}).`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const revoke = async (c) => {
    if (!(await confirm({ title: 'Revoke certificate?', message: `${c.certificateNo} will show as REVOKED to anyone who verifies it. This cannot be undone.`, confirmLabel: 'Revoke' }))) return;
    try {
      await update('certificates', c.id, { status: 'Revoked' }, { audit: 'Certificate revoked', details: c.certificateNo });
      await update('certificateVerifications', c.verificationId, { status: 'Revoked' }, { audit: false });
      toast.success('Certificate revoked.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  /** Every download is written to the audit trail before the certificate opens. */
  const download = async (c) => {
    try {
      const st = stu(c.studentId);
      await create('certificateDownloads', { certificateId: c.id, studentId: c.studentId, userId: user.id, userName: user.name, role: user.role, at: nowISO() }, { audit: false });
      await openCertificate(c, st, certificateContext(db, st, ayId), settings);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const all = db.certificates;
  const by = (s) => all.filter((c) => c.status === s);
  const cols = [
    { key: 'requestNo', header: 'Request' },
    ...(scope.personal ? [] : [{ key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) }]),
    { key: 'type', header: 'Certificate' },
    { key: 'purpose', header: 'Purpose' },
    { key: 'requestedOn', header: 'Requested', render: (r) => fmtDate(r.requestedOn) },
  ];
  const issuedCols = [
    ...cols,
    { key: 'certificateNo', header: 'Certificate no' },
    { key: 'verificationId', header: 'Verification ID' },
    { key: 'issuedOn', header: 'Issued', render: (r) => fmtDate(r.issuedOn) },
    { key: 'downloads', header: 'Downloads', value: (r) => downloads(r).length, className: 'text-right' },
    {
      key: 'last',
      header: 'Last downloaded',
      value: (r) => downloads(r).map((d) => d.at).sort().pop() ?? '',
      render: (r) => fmtDateTime(downloads(r).map((d) => d.at).sort().pop()),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
  ];
  if (scope.personal)
    return (
      <>
        <PageHeader
          title="My Certificates"
          subtitle="Request certificates, track authorisation and download signed copies"
          actions={
            <Button icon={FilePlus2} onClick={() => setModal({ kind: 'request' })}>
              Request certificate
            </Button>
          }
        />
        <div className="mb-16">
          <Alert tone="info">
            Requests are validated against your roll number and authorised by the college administration. Approved certificates carry the
            Principal's digital signature and a QR code anyone can scan to verify them. Every download is recorded.
          </Alert>
        </div>
        <DataTable
          title="My certificate requests"
          rows={all}
          initialSort={{ key: 'requestedOn', dir: 'desc' }}
          columns={[...issuedCols, { key: 'remarks', header: 'Remarks' }]}
          actions={(r) =>
            r.status === 'Approved' ? (
              <Button size="sm" icon={Download} onClick={() => download(r)}>
                Download
              </Button>
            ) : null
          }
        />
        {modal?.kind === 'request' && <RequestForm onClose={() => setModal(null)} />}
      </>
    );
  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle="Requests validated by roll number, admin authorisation, digitally signed certificates, download audit trail and verification"
        actions={
          can('certificates', 'edit') && (
            <Button icon={FilePlus2} onClick={() => setModal({ kind: 'request' })}>
              New request
            </Button>
          )
        }
      />
      <div className="grid cols-4 stats">
        <StatCard label="Awaiting authorisation" value={by('Pending').length} icon={Clock} tone="amber" />
        <StatCard label="Issued" value={by('Approved').length} icon={Award} tone="green" />
        <StatCard label="Rejected / revoked" value={by('Rejected').length + by('Revoked').length} icon={XCircle} tone="red" />
        <StatCard label="Downloads" value={db.certificateDownloads.length} icon={Download} tone="blue" />
      </div>
      <UrlTabs
        tabs={[
          { id: 'pending', label: 'Pending authorisation', count: by('Pending').length },
          { id: 'issued', label: 'Issued certificates' },
          { id: 'all', label: 'All requests' },
          { id: 'audit', label: 'Download audit trail' },
          { id: 'verify', label: 'Verify' },
        ]}
      >
        {(t) => {
          switch (t) {
            case 'pending':
              return (
                <>
                  {!approver && (
                    <div className="mb-12">
                      <Alert tone="info">Only the Principal or an Administrator can authorise certificates.</Alert>
                    </div>
                  )}
                  <DataTable
                    title="Pending requests"
                    rows={by('Pending')}
                    initialSort={{ key: 'requestedOn', dir: 'asc' }}
                    emptyMessage="No requests are waiting for authorisation."
                    columns={[
                      ...cols,
                      { key: 'rollNo', header: 'Roll no entered' },
                      {
                        key: 'check',
                        header: 'Roll no check',
                        value: (r) => (rollOk(r) ? 'Matched' : 'Mismatch'),
                        render: (r) => (rollOk(r) ? <Badge tone="green">✓ Matched</Badge> : <Badge tone="red">✗ Mismatch</Badge>),
                      },
                      { key: 'stStatus', header: 'Student status', value: (r) => stu(r.studentId)?.status },
                      { key: 'dues', header: 'Fee dues', value: (r) => ledger(db, r.studentId).balance, render: (r) => (ledger(db, r.studentId).balance ? <span className="text-red">Yes</span> : 'Nil') },
                    ]}
                    actions={
                      approver
                        ? (r) => (
                            <>
                              <Button size="sm" variant="ghost" icon={CheckCircle2} className="ok" onClick={() => approve(r)} disabled={!rollOk(r)}>
                                Authorise
                              </Button>
                              <Button size="sm" variant="ghost" icon={XCircle} className="bad" onClick={() => setModal({ kind: 'reject', c: r })}>
                                Reject
                              </Button>
                            </>
                          )
                        : undefined
                    }
                  />
                </>
              );
            case 'issued':
              return (
                <DataTable
                  title="Issued certificates"
                  exportName="issued-certificates"
                  rows={all.filter((c) => c.status === 'Approved' || c.status === 'Revoked')}
                  initialSort={{ key: 'issuedOn', dir: 'desc' }}
                  filters={[{ key: 'type', label: 'Certificate', options: CERT_TYPES.map((v) => ({ value: v, label: v })), match: (r, v) => r.type === v }]}
                  columns={[...issuedCols, { key: 'reviewedByName', header: 'Authorised by' }]}
                  actions={(r) => (
                    <>
                      {r.status === 'Approved' && <Button size="sm" variant="ghost" icon={Download} title="Download / print" onClick={() => download(r)} />}
                      {approver && r.status === 'Approved' && <Button size="sm" variant="ghost" icon={Ban} className="danger" title="Revoke" onClick={() => revoke(r)} />}
                    </>
                  )}
                />
              );
            case 'audit':
              return (
                <DataTable
                  title="Certificate download audit trail"
                  exportName="certificate-downloads"
                  rows={db.certificateDownloads}
                  initialSort={{ key: 'at', dir: 'desc' }}
                  columns={[
                    { key: 'at', header: 'Date & time', render: (r) => fmtDateTime(r.at) },
                    { key: 'cert', header: 'Certificate', value: (r) => all.find((c) => c.id === r.certificateId)?.certificateNo },
                    { key: 'type', header: 'Type', value: (r) => all.find((c) => c.id === r.certificateId)?.type },
                    { key: 'student', header: 'Student', value: (r) => labelOf(db, 'students', r.studentId) },
                    { key: 'userName', header: 'Downloaded by' },
                    { key: 'role', header: 'Role' },
                    { key: 'count', header: 'Download #', value: (r) => db.certificateDownloads.filter((d) => d.certificateId === r.certificateId && d.at <= r.at).length, className: 'text-right' },
                  ]}
                />
              );
            case 'verify':
              return (
                <>
                  <p className="row muted mb-12">
                    <ShieldCheck className="icon-16" />
                    Enter a verification ID or scan the QR code on a certificate. The public page is <code>/verify</code> — no sign-in needed.
                  </p>
                  <VerifyPanel />
                </>
              );
            default:
              return (
                <DataTable
                  title="All certificate requests"
                  exportName="certificate-requests"
                  rows={all}
                  initialSort={{ key: 'requestedOn', dir: 'desc' }}
                  filters={[
                    { key: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected', 'Revoked'].map((v) => ({ value: v, label: v })), match: (r, v) => r.status === v },
                    { key: 'type', label: 'Certificate', options: CERT_TYPES.map((v) => ({ value: v, label: v })), match: (r, v) => r.type === v },
                  ]}
                  columns={[...cols, { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'reviewedByName', header: 'Reviewed by' }, { key: 'remarks', header: 'Remarks' }]}
                />
              );
          }
        }}
      </UrlTabs>
      {modal?.kind === 'request' && <RequestForm onClose={() => setModal(null)} />}
      {modal?.kind === 'reject' && <Reject c={modal.c} onClose={() => setModal(null)} />}
    </>
  );
}
