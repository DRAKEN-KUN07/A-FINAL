import { useCallback, useEffect, useState } from 'react';
import { BadgePlus, Ban, Eye, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { PassDetailModal } from '../components/PassDetailModal';
import { StatusBadge } from '../components/StatusBadge';

export function PassesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [passes, setPasses] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedPass, setSelectedPass] = useState(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    visitorId: '',
    hostId: '',
    locationCode: user?.locationCode || 'MAIN-GATE',
    purpose: 'Walk-In Official Visit',
    validHours: 8,
  });

  const canIssue = ['admin', 'security', 'employee'].includes(user?.role);

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/passes', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        },
      });
      setPasses(res.data.data || []);

      if (canIssue) {
        const [visRes, hostRes, orgRes] = await Promise.all([
          api.get('/visitors'),
          api.get('/admin/hosts'),
          api.get('/admin/organizations'),
        ]);
        const vList = visRes.data.data || [];
        const hList = hostRes.data.data || [];
        setVisitors(vList);
        setHosts(hList);
        setOrgs(orgRes.data.data || []);
        setForm((prev) => ({
          ...prev,
          visitorId: prev.visitorId || vList[0]?._id || '',
          hostId: prev.hostId || hList[0]?._id || '',
        }));
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, canIssue, addToast]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  const handleIssue = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/passes', form);
      addToast(`Issued pass ${res.data.data.passCode}`, 'success');
      setIssueOpen(false);
      setSelectedPass(res.data.data);
      fetchPasses();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (pass) => {
    try {
      await api.patch(`/passes/${pass._id}/revoke`, { reason: 'Revoked via Pass Manager' });
      addToast(`Revoked pass ${pass.passCode}`, 'info');
      fetchPasses();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const locations = orgs.flatMap((o) => o.locations || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Digital Visitor Passes</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            View QR badges, download printable PDF passes, or issue/revoke visitor access.
          </p>
        </div>
        {canIssue && (
          <button type="button" className="btn btn-primary" onClick={() => setIssueOpen(true)}>
            <BadgePlus size={16} /> Issue New Pass
          </button>
        )}
      </div>

      <div className="card card-pad">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search pass code, visitor, host, or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading digital passes...</div>
        ) : passes.length === 0 ? (
          <div className="empty-state">No passes found matching the current filter.</div>
        ) : (
          <div className="grid-3">
            {passes.map((pass) => (
              <div key={pass._id} className="digital-pass-card">
                <div className="digital-pass-banner" style={{ padding: '14px 16px' }}>
                  <div>
                    <div className="mono" style={{ fontSize: '0.92rem', fontWeight: 700, color: '#7dd3fc' }}>
                      {pass.passCode}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginTop: 2 }}>
                      {pass.locationName}
                    </div>
                  </div>
                  <StatusBadge value={pass.status} />
                </div>

                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar name={pass.visitor?.fullName} photoUrl={pass.visitor?.photoUrl} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pass.visitor?.fullName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {pass.visitor?.company} • Host: {pass.host?.name}
                      </div>
                    </div>
                    {pass.qrDataUrl && (
                      <img
                        src={pass.qrDataUrl}
                        alt={pass.passCode}
                        style={{ width: 54, height: 54, borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    <div><strong>Purpose:</strong> {pass.purpose}</div>
                    <div><strong>Valid Until:</strong> {new Date(pass.validUntil).toLocaleString()}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setSelectedPass(pass)}>
                      <Eye size={14} /> QR & PDF Badge
                    </button>
                    {canIssue && ['active', 'checked_in'].includes(pass.status) && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRevoke(pass)} title="Revoke Pass">
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue New Visitor Pass">
        <form onSubmit={handleIssue} className="form-grid">
          <div className="form-group full">
            <label className="form-label">Visitor *</label>
            <select className="select" value={form.visitorId} onChange={(e) => setForm({ ...form, visitorId: e.target.value })} required>
              {visitors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.fullName} ({v.company})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Host Employee *</label>
            <select className="select" value={form.hostId} onChange={(e) => setForm({ ...form, hostId: e.target.value })} required>
              {hosts.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.department || h.role})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Campus Gate / Location</label>
            <select className="select" value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })}>
              {locations.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Validity Duration (Hours)</label>
            <input
              type="number"
              min={1}
              max={168}
              className="input"
              value={form.validHours}
              onChange={(e) => setForm({ ...form, validHours: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Purpose *</label>
            <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required />
          </div>
          <div className="form-group full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIssueOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Generating QR...' : 'Issue QR Pass'}
            </button>
          </div>
        </form>
      </Modal>

      <PassDetailModal pass={selectedPass} open={Boolean(selectedPass)} onClose={() => setSelectedPass(null)} />
    </div>
  );
}
