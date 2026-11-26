import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Check,
  Clock,
  Eye,
  QrCode,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { Avatar } from '../components/Avatar';
import { OtpVerifyWidget } from '../components/OtpVerifyWidget';
import { PassDetailModal } from '../components/PassDetailModal';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';

export function DashboardPage() {
  const { user, visitorProfile, refreshMe } = useAuth();
  const { addToast } = useToast();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPass, setSelectedPass] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data.data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleApproval = async (aptId, approve) => {
    try {
      if (approve) {
        await api.patch(`/appointments/${aptId}/approve`, { issuePass: true });
        addToast('Appointment approved and digital pass issued!', 'success');
      } else {
        await api.patch(`/appointments/${aptId}/reject`, { reason: 'Declined from dashboard' });
        addToast('Appointment rejected', 'info');
      }
      loadDashboard();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) {
    return <div className="card card-pad">Loading live dashboard telemetry...</div>;
  }

  if (user?.role === 'visitor') {
    const totals = stats?.totals || {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Welcome, {user.name}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Pre-register visits, complete OTP verification, and download your QR/PDF passes.
            </p>
          </div>
          <Link to="/appointments" className="btn btn-primary">
            <CalendarClock size={16} /> Pre-Register New Visit
          </Link>
        </div>

        <div className="grid-stats">
          <StatCard label="My Appointments" value={totals.totalAppointments} icon={CalendarClock} />
          <StatCard label="Pending Approval" value={totals.pendingAppointments} icon={Clock} accent="#d97706" bg="#fef3c7" />
          <StatCard label="Active Digital Passes" value={totals.activePasses} icon={BadgeCheck} accent="#059669" bg="#d1fae5" />
          <StatCard label="Currently Checked In" value={totals.checkedInNow} icon={ShieldCheck} accent="#4f46e5" bg="#e0e7ff" />
        </div>

        {!visitorProfile?.otpVerified && (
          <OtpVerifyWidget
            defaultIdentifier={user.email}
            visitorId={visitorProfile?._id}
            onVerified={() => {
              refreshMe();
              loadDashboard();
            }}
          />
        )}

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title">My Digital Passes</h3>
                <p className="card-subtitle">Tap View to inspect QR code or download PDF badge</p>
              </div>
              <Link to="/passes" className="btn btn-secondary btn-sm">All Passes</Link>
            </div>
            {(stats?.myPasses || []).length === 0 ? (
              <div className="empty-state">No passes issued yet. Request a visit to get a digital pass.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.myPasses.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div className="mono" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.passCode}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.purpose}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{p.locationName}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge value={p.status} />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          const res = await api.get(`/passes/${p._id}`);
                          setSelectedPass(res.data.data.pass);
                        }}
                      >
                        <Eye size={14} /> View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title">Upcoming & Past Appointments</h3>
                <p className="card-subtitle">Host approval status for your visits</p>
              </div>
              <Link to="/appointments" className="btn btn-secondary btn-sm">Manage</Link>
            </div>
            {(stats?.myAppointments || []).length === 0 ? (
              <div className="empty-state">No scheduled appointments yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.myAppointments.map((apt) => (
                  <div
                    key={apt._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{apt.purpose}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Host: {apt.host?.name} • {new Date(apt.scheduledDate).toLocaleString()}
                      </div>
                    </div>
                    <StatusBadge value={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <PassDetailModal pass={selectedPass} open={Boolean(selectedPass)} onClose={() => setSelectedPass(null)} />
      </div>
    );
  }

  const totals = stats?.totals || {};
  const maxBreakdown = Math.max(1, ...(stats?.statusBreakdown || []).map((s) => s.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Operations Overview</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real-time campus occupancy, pass analytics, and approval queues.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(user?.role === 'admin' || user?.role === 'security') && (
            <Link to="/scanner" className="btn btn-primary">
              <QrCode size={16} /> Launch QR Scanner
            </Link>
          )}
          <Link to="/appointments" className="btn btn-secondary">
            <CalendarClock size={16} /> Invite / Pre-Register
          </Link>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard label="Currently On-Site" value={totals.currentlyCheckedIn} hint="Checked-in visitors" icon={UserCheck} accent="#059669" bg="#d1fae5" />
        <StatCard label="Active Passes" value={totals.activePasses} hint="Valid QR badges" icon={BadgeCheck} accent="#0284c7" bg="#e0f2fe" />
        <StatCard label="Pending Approvals" value={totals.pendingAppointments} hint="Awaiting host review" icon={Clock} accent="#d97706" bg="#fef3c7" />
        <StatCard label="Today Check-Ins" value={totals.todayCheckIns} hint={`${totals.totalCheckLogs || 0} total logs`} icon={Activity} accent="#4f46e5" bg="#e0e7ff" />
        <StatCard label="Registered Visitors" value={totals.totalVisitors} hint="Directory profiles" icon={Users} accent="#0f172a" bg="#e2e8f0" />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">7-Day Gate Traffic</h3>
              <p className="card-subtitle">Daily visitor check-ins vs check-outs</p>
            </div>
          </div>
          <AnalyticsChart dailyTraffic={stats?.dailyTraffic || []} />
        </div>

        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">Pass Status & Campus Distribution</h3>
              <p className="card-subtitle">Breakdown across active gates and locations</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(stats?.statusBreakdown || []).map((item) => (
              <div key={item.status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{item.status.replace(/_/g, ' ')}</span>
                  <span className="mono">{item.count}</span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((item.count / maxBreakdown) * 100)}%`,
                      height: '100%',
                      background: '#0284c7',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}

            {(stats?.locationBreakdown || []).length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {stats.locationBreakdown.map((loc) => (
                  <span key={loc.locationCode} className="badge badge-slate">
                    {loc.locationCode}: {loc.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">Pending Appointment Approvals</h3>
              <p className="card-subtitle">Approve to automatically issue QR pass & notify visitor</p>
            </div>
            <Link to="/appointments" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {(stats?.pendingApprovals || []).length === 0 ? (
            <div className="empty-state">All caught up — no pending visitor approvals.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.pendingApprovals.map((apt) => (
                <div
                  key={apt._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={apt.visitor?.fullName} photoUrl={apt.visitor?.photoUrl} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{apt.visitor?.fullName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {apt.purpose} • Host: {apt.host?.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => handleApproval(apt._id, true)}
                      title="Approve & Issue Pass"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleApproval(apt._id, false)}
                      title="Reject"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Gate Check-In / Check-Out Logs</h3>
              <p className="card-subtitle">Latest verified pass scans across campus gates</p>
            </div>
            <Link to="/reports" className="btn btn-secondary btn-sm">Reports</Link>
          </div>
          {(stats?.recentCheckLogs || []).length === 0 ? (
            <div className="empty-state">No gate check-ins recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.recentCheckLogs.map((log) => (
                <div
                  key={log._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: 10,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={log.visitor?.fullName} photoUrl={log.visitor?.photoUrl} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{log.visitor?.fullName}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        <span className="mono">{log.pass?.passCode}</span> • {log.gate} •{' '}
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <StatusBadge value={log.action} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
