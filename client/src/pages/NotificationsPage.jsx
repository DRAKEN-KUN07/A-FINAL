import { useCallback, useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/StatusBadge';

export function NotificationsPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [channel, setChannel] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/notifications', {
        params: { channel: channel !== 'all' ? channel : undefined },
      });
      setLogs(res.data.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [channel, addToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Email & SMS Notification Logs</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Audit outbound invites, host approval alerts, OTP verification codes, and gate arrival notices.
          </p>
        </div>
        <select className="select" style={{ width: 160 }} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">All Channels</option>
          <option value="email">Email Only</option>
          <option value="sms">SMS Only</option>
        </select>
      </div>

      <div className="card card-pad">
        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading notification history...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Bell size={28} />
            <div style={{ marginTop: 8 }}>No notification logs yet.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Event</th>
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Status & Provider</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <span className="badge badge-slate">
                        {item.channel === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                        {item.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '0.78rem' }}>{item.eventType}</td>
                    <td style={{ fontWeight: 500 }}>{item.recipient}</td>
                    <td style={{ maxWidth: 380 }}>
                      {item.subject && <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{item.subject}</div>}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.message}</div>
                    </td>
                    <td>
                      <StatusBadge value={item.status} />
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{item.provider}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
