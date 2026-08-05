import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { APP_NAME } from '../../config/constants';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: 40, width: 380 }}>
        <h1 style={{ color: 'var(--color-primary)', fontSize: 20, marginBottom: 24 }}>{APP_NAME}</h1>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </label>
          <label style={{ display: 'block', marginBottom: 16 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={buttonStyle}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
          Chưa có tài khoản? Liên hệ Admin để được cấp quyền truy cập.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
