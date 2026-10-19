import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Search, ShieldAlert, ShieldX } from 'lucide-react';
import { CollegeLogo } from '../../components/CollegeLogo';
import { APP_MODE } from '../../config/firebase';
import { demoVerification } from '../../data/demoBackend';
import { fetchVerification } from '../../data/firestoreBackend';
import { canonical, sha256 } from '../../lib/signature';
import { fmtDate } from '../../lib/utils';
import { Alert, Button, Card, Input } from '../../components/ui';

async function lookup(id) {
  const v = APP_MODE === 'demo' ? await demoVerification(id) : await fetchVerification(id);
  if (!v) return { state: 'missing' };
  // Demo: recompute the SHA-256 fingerprint. Firebase: the record is written only by the server with an HMAC signature.
  const sigOk = APP_MODE === 'demo' ? (await sha256(canonical({ ...v, verificationId: v.id }))) === v.signature : true;
  return { state: v.status === 'Valid' && sigOk ? 'valid' : v.status !== 'Valid' ? 'revoked' : 'tampered', v };
}

/** Certificate authenticity check by verification id (also reached by scanning the QR code). */
export function VerifyPanel({ initialId = '', onSearch }) {
  const [id, setId] = useState(initialId);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (q) => {
    const v = q.trim().toUpperCase();
    if (!v) return;
    setBusy(true);
    try {
      setRes(await lookup(v));
      onSearch?.(v);
    } catch {
      setRes({ state: 'error' });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (initialId) run(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);
  const v = res?.v;
  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          run(id);
        }}
      >
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Verification ID, e.g. KV7XQ2M9PA" aria-label="Verification ID" style={{ maxWidth: 320 }} />
        <Button icon={Search} loading={busy} type="submit">
          Verify
        </Button>
      </form>
      {res?.state === 'missing' && (
        <Alert tone="error" title="Not found">
          No certificate exists with this verification ID. The certificate may be forged — contact the college office.
        </Alert>
      )}
      {res?.state === 'error' && <Alert tone="error">Verification service is unavailable. Please try again.</Alert>}
      {v && (
        <Card>
          <div className="row mb-12">
            {res.state === 'valid' ? (
              <BadgeCheck className="text-green" style={{ width: 36, height: 36 }} />
            ) : res.state === 'revoked' ? (
              <ShieldX className="text-red" style={{ width: 36, height: 36 }} />
            ) : (
              <ShieldAlert className="text-red" style={{ width: 36, height: 36 }} />
            )}
            <div>
              <p className="strong" style={{ fontSize: 18 }}>
                {res.state === 'valid' ? 'Authentic certificate' : res.state === 'revoked' ? 'Certificate revoked' : 'Signature mismatch'}
              </p>
              <p className="xs muted">
                {res.state === 'valid'
                  ? 'Issued and digitally signed by the college.'
                  : res.state === 'revoked'
                    ? 'This certificate was withdrawn by the college and is no longer valid.'
                    : 'The record does not match its digital signature.'}
              </p>
            </div>
          </div>
          <dl className="details">
            {[
              ['Certificate', v.type],
              ['Certificate no', v.certificateNo],
              ['Student', v.studentName],
              ['Roll number', v.rollNo],
              ['Program', v.program],
              ['Issued on', fmtDate(v.issuedOn)],
              ['Signed by', `${v.signatoryName}, ${v.signatoryDesignation}`],
              ['Verification ID', v.id],
            ].map(([k, x]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{x}</dd>
              </div>
            ))}
            <div className="full">
              <dt>Digital signature</dt>
              <dd className="xs" style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {v.signature}
              </dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}

/** Public page (no sign-in): /verify and /verify/:id */
export default function VerifyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Verify Certificate · EduERP';
  }, []);
  return (
    <div className="verify-page">
      <div className="verify-inner">
        <div className="row mb-16">
          <CollegeLogo />
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>Certificate Verification</h1>
            <p className="muted small">Check the authenticity of a certificate issued by the college using its verification ID or QR code.</p>
          </div>
        </div>
        <VerifyPanel initialId={id ?? ''} onSearch={(v) => v !== id && navigate(`/verify/${v}`, { replace: true })} />
        <p className="xs muted mt-16">
          <Link to="/login">Staff / student sign in</Link>
        </p>
      </div>
    </div>
  );
}
