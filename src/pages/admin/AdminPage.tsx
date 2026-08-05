import { useEffect, useState } from 'react';
import type { Profile, UserRole } from '../../types/entities';
import { authService } from '../../services/auth/authService';

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setProfiles(await authService.listProfiles());
  }
  useEffect(() => { reload(); }, []);

  async function handleCreateUser() {
    setError(null);
    setCreating(true);
    try {
      await authService.createUser({ email, password, displayName, role });
      setEmail(''); setDisplayName(''); setPassword('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(id: string, newRole: UserRole) {
    await authService.updateRole(id, newRole);
    reload();
  }

  return (
    <div>
      <h1>Admin Panel</h1>

      <div className="glass-panel" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Cấp tài khoản cho nhân viên</h3>
        <p style={{ fontSize: 13, marginBottom: 12 }}>Người được cấp chỉ cần đăng nhập bằng email + mật khẩu này — không cần tự đăng ký.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Tên hiển thị" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Mật khẩu (tối thiểu 8 ký tự)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={inputStyle}>
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleCreateUser} disabled={creating} style={{ padding: '10px 16px', border: 'none', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
            {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: 'rgba(20,126,147,0.06)', textAlign: 'left' }}>
              <th style={th}>Tên</th><th style={th}>Email</th><th style={th}>Vai trò</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{p.displayName}</td>
                <td style={td}>{p.email}</td>
                <td style={td}>
                  <select value={p.role} onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)} style={{ padding: 6 }}>
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 14px' };
const inputStyle: React.CSSProperties = { minWidth: 160 };
