import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './StatusBadge';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'security', 'employee', 'visitor'] },
  { to: '/scanner', label: 'QR Scanner & Gate', icon: QrCode, roles: ['admin', 'security'] },
  { to: '/visitors', label: 'Visitors', icon: Users, roles: ['admin', 'security', 'employee'] },
  { to: '/appointments', label: 'Appointments', icon: CalendarClock, roles: ['admin', 'security', 'employee', 'visitor'] },
  { to: '/passes', label: 'Digital Passes', icon: BadgeCheck, roles: ['admin', 'security', 'employee', 'visitor'] },
  { to: '/reports', label: 'Reports & Export', icon: BarChart3, roles: ['admin', 'security', 'employee'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'security', 'employee'] },
  { to: '/admin', label: 'Admin & Orgs', icon: Building2, roles: ['admin'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Shield size={21} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">GatePass VMS</div>
            <div className="brand-subtitle">Digital Access Control</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm mobile-menu-btn"
            style={{ color: '#94a3b8' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>{user?.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{user?.email}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <StatusBadge value={user?.role} />
              <span style={{ fontSize: '0.72rem', color: '#7dd3fc' }}>{user?.organization?.code || 'ORG'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              borderColor: 'rgba(148,163,184,0.2)',
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                {user?.organization?.name || 'GatePass Enterprise'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {user?.department ? `${user.department} • ` : ''}Location: {user?.locationCode || 'MAIN-GATE'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NavLink to="/verify" className="btn btn-secondary btn-sm">
              Public Verify Portal
            </NavLink>
            {(user?.role === 'admin' || user?.role === 'security') && (
              <NavLink to="/scanner" className="btn btn-primary btn-sm">
                <QrCode size={15} /> Open QR Gate
              </NavLink>
            )}
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
