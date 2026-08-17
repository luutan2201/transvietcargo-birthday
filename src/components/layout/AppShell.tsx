import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../services/auth/permissions';
import { settingsService } from '../../services/settings/settingsService';

const NAV_ITEMS: Array<{ to: string; label: string; icon: string; permission?: Parameters<typeof hasPermission>[1] }> = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/calendar', label: 'Calendar', icon: '⊞', permission: 'customers.view' },
  { to: '/customers', label: 'Customers', icon: '◉', permission: 'customers.view' },
  { to: '/templates', label: 'Templates', icon: '▤', permission: 'templates.view' },
  { to: '/cards', label: 'eCard Generator', icon: '◈', permission: 'card.generate' },
  { to: '/email', label: 'Email Generator', icon: '✉', permission: 'email.generate' },
  { to: '/history', label: 'History', icon: '◷', permission: 'history.view' },
];

const SYSTEM_ITEMS: Array<{ to: string; label: string; icon: string; permission?: Parameters<typeof hasPermission>[1] }> = [
  { to: '/settings', label: 'Settings', icon: '⚙', permission: 'settings.edit' },
  { to: '/admin', label: 'Admin', icon: '⛨', permission: 'admin.access' },
];

export function AppShell() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    settingsService.getAll().then((s) => setLogoDataUrl(s.logoDataUrl));
  }, []);

  if (!session) return null;

  const visibleNav = NAV_ITEMS.filter((item) => !item.permission || hasPermission(session.role, item.permission));
  const visibleSystem = SYSTEM_ITEMS.filter((item) => !item.permission || hasPermission(session.role, item.permission));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 260,
          height: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, var(--color-primary-dark), var(--color-primary))',
          padding: '28px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div style={{ color: '#fff', padding: '0 10px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="Logo" style={{ maxWidth: 44, maxHeight: 44, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 4 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>TC</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>TransViet Cargo</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Email Campaign Studio</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ width: 20, textAlign: 'center', fontSize: 17 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {visibleSystem.length > 0 && (
            <>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.45)', padding: '18px 10px 8px' }}>
                System
              </div>
              {visibleSystem.map((item) => (
                <NavLink key={item.to} to={item.to} style={({ isActive }) => navLinkStyle(isActive)}>
                  <span style={{ width: 20, textAlign: 'center', fontSize: 17 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.10)', borderRadius: 16, padding: '10px 12px', marginTop: 12,
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {initials(session.displayName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.displayName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{session.role}</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            title="Log out"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 16, padding: 4 }}
          >
            ⎋
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '32px 40px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1560 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14,
    textDecoration: 'none', fontSize: 15, fontWeight: 500,
    color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
    background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
    boxShadow: isActive ? 'inset 0 0 0 1px rgba(255,255,255,0.25)' : 'none',
  };
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(-2).map((p) => p[0]?.toUpperCase()).join('');
}
