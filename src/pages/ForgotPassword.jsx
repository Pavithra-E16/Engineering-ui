import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Alert } from '../components/ui';
import { AuthShell } from './AuthShell';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      setMsg(await resetPassword(email));
    } catch (err) {
      setError(err?.message ?? 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-title">
        <h2 style={{ fontSize: 30 }}>Reset password</h2>
        <p>We'll email you a secure reset link</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        <div className="auth-field">
          <label htmlFor="fp-email">Email Id</label>
          <div className="auth-input">
            <Mail />
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@college.edu"
            />
          </div>
        </div>
        <button type="submit" className="auth-btn" disabled={loading}>
          {loading && <Loader2 className="spin" />}SEND RESET LINK
        </button>
        <p className="auth-foot">
          <Link to="/login" className="row" style={{ justifyContent: 'center', gap: 4 }}>
            <ArrowLeft className="icon-14" />
            Back to Sign In
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
