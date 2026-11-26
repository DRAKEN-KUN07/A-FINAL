import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Lock, Mail, QrCode, Shield, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@gatepass.io', desc: 'Orgs, Staff, Analytics' },
  { label: 'Security', email: 'security@gatepass.io', desc: 'QR Gate, Issue Passes' },
  { label: 'Employee', email: 'employee@gatepass.io', desc: 'Invite & Approve' },
  { label: 'Visitor', email: 'visitor@gatepass.io', desc: 'Pre-Register & Pass' },
];

export function LoginPage() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@gatepass.io');
  const [password, setPassword] = useState('Password123!');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(email, password);
      addToast(`Welcome back, ${user.name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setBusy(true);
    try {
      const user = await login(demoEmail, 'Password123!');
      addToast(`Signed in as ${user.name} (${user.role})`, 'success');
      navigate('/dashboard');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0c4a6e 100%)',
        padding: '32px 24px',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
      }}
    >
      <div style={{ maxWidth: 520, color: '#fff', margin: '0 auto', padding: '12px 8px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(56, 189, 248, 0.14)', color: '#7dd3fc', padding: '7px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600 }}>
          <Shield size={16} /> Enterprise Visitor Pass Management
        </div>
        <h1 style={{ fontSize: '2.35rem', lineHeight: 1.15, fontWeight: 800, margin: '18px 0 14px', letterSpacing: '-0.03em' }}>
          Zero-paper visitor passes, QR gate control & live host alerts.
        </h1>
        <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6, marginBottom: 26 }}>
          Pre-register guests, verify identity via OTP, issue HMAC-signed QR & PDF badges, and monitor campus check-ins across multiple locations in real time.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary">
            <UserCheck size={16} /> Visitor Self-Registration
          </Link>
          <Link
            to="/verify"
            className="btn btn-secondary"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <QrCode size={16} /> Verify Pass Code
          </Link>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460, width: '100%', margin: '0 auto', padding: 28, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Sign in to GatePass</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Use your account credentials or pick a seeded demo role below.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="input"
                style={{ paddingLeft: 36 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="input"
                style={{ paddingLeft: 36 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={busy}>
            {busy ? 'Signing in...' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            <KeyRound size={14} /> Instant Demo Role Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => quickLogin(acc.email)}
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '9px 11px',
                  gap: 2,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>{acc.label}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{acc.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          New visitor?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create visitor account
          </Link>
        </div>
      </div>
    </div>
  );
}
