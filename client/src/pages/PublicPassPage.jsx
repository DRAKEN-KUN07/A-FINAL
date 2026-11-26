import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, QrCode, Search } from 'lucide-react';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';

export function PublicPassPage() {
  const { passCode: paramCode } = useParams();
  const [passCode, setPassCode] = useState(paramCode || '');
  const [pass, setPass] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (codeToCheck) => {
    if (!codeToCheck?.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/passes/public/${codeToCheck.trim().toUpperCase()}`);
      setPass(res.data.data);
    } catch (err) {
      setPass(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paramCode) lookup(paramCode);
  }, [paramCode, lookup]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '36px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon" style={{ width: 36, height: 36 }}>
              <QrCode size={18} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Public Pass Verification</h1>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Verify any GatePass code instantly
              </p>
            </div>
          </div>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to App
          </Link>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(passCode);
          }}
          className="card card-pad"
          style={{ display: 'flex', gap: 10, marginBottom: 18 }}
        >
          <input
            className="input mono"
            value={passCode}
            onChange={(e) => setPassCode(e.target.value)}
            placeholder="Enter Pass Code (e.g. VP-2026-XXXXXX)"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} /> {loading ? 'Checking...' : 'Verify'}
          </button>
        </form>

        {error && (
          <div className="card card-pad" style={{ borderColor: '#fecdd3', background: '#fff1f2', color: '#be123c' }}>
            {error}
          </div>
        )}

        {pass && (
          <div className="digital-pass-card">
            <div className="digital-pass-banner">
              <div>
                <div style={{ fontSize: '0.72rem', color: '#7dd3fc', fontWeight: 700, textTransform: 'uppercase' }}>
                  Verified Digital Pass
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4 }}>
                  {pass.organization?.name}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{pass.locationName}</div>
              </div>
              <StatusBadge value={pass.status} />
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <Avatar name={pass.visitor?.fullName} photoUrl={pass.visitor?.photoUrl} large />
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {pass.visitor?.fullName}
                    {pass.visitor?.otpVerified && <CheckCircle2 size={16} color="#059669" />}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{pass.visitor?.company}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Host: {pass.host?.name} • <span className="mono">{pass.passCode}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <img
                  src={pass.qrDataUrl}
                  alt={pass.passCode}
                  style={{ width: 170, height: 170, borderRadius: 10, border: '1px solid var(--border)', padding: 6 }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Valid: {new Date(pass.validFrom).toLocaleString()} — {new Date(pass.validUntil).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
