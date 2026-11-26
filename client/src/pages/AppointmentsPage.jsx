import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Check, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { PassDetailModal } from '../components/PassDetailModal';
import { StatusBadge } from '../components/StatusBadge';

export function AppointmentsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultDateTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    visitorMode: user?.role === 'visitor' ? 'self' : 'existing',
    visitorId: '',
    visitorDetails: { fullName: '', email: '', phone: '', company: '' },
    hostId: user?.role === 'employee' ? user._id : '',
    organizationId: user?.organization?._id || '',
    locationCode: user?.locationCode || 'MAIN-GATE',
    purpose: '',
    scheduledDate: defaultDateTime(),
    expectedDurationMinutes: 60,
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptRes, hostRes, orgRes] = await Promise.all([
        api.get('/appointments', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: search || undefined,
          },
        }),
        api.get('/admin/hosts'),
        api.get('/admin/organizations'),
      ]);
      setAppointments(aptRes.data.data || []);
      const hostList = hostRes.data.data || [];
      const orgList = orgRes.data.data || [];
      setHosts(hostList);
      setOrgs(orgList);

      if (user?.role !== 'visitor') {
        const visRes = await api.get('/visitors');
        setVisitors(visRes.data.data || []);
      }

      setForm((prev) => ({
        ...prev,
        hostId: prev.hostId || hostList[0]?._id || '',
        organizationId: prev.organizationId || orgList[0]?._id || '',
      }));
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, user?.role, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeOrg = orgs.find((o) => o._id === form.organizationId) || orgs[0];
  const locations = activeOrg?.locations || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        hostId: form.hostId,
        organizationId: form.organizationId,
        locationCode: form.locationCode,
        purpose: form.purpose,
        scheduledDate: new Date(form.scheduledDate).toISOString(),
        expectedDurationMinutes: Number(form.expectedDurationMinutes),
        notes: form.notes,
        type: user?.role === 'visitor' ? 'pre_registration' : 'invite',
      };
      if (user?.role !== 'visitor') {
        if (form.visitorMode === 'existing') {
          payload.visitorId = form.visitorId;
        } else {
          payload.visitorDetails = form.visitorDetails;
        }
      }

      const res = await api.post('/appointments', payload);
      addToast(
        res.data.pass
          ? `Invitation sent & pass ${res.data.pass.passCode} issued!`
          : 'Pre-registration submitted for host approval!',
        'success'
      );
      setModalOpen(false);
      setForm((prev) => ({ ...prev, purpose: '', notes: '' }));
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') {
        await api.patch(`/appointments/${id}/approve`, { issuePass: true });
        addToast('Approved & digital pass issued!', 'success');
      } else if (action === 'reject') {
        await api.patch(`/appointments/${id}/reject`, { reason: 'Schedule conflict' });
        addToast('Appointment rejected', 'info');
      } else {
        await api.patch(`/appointments/${id}/cancel`);
        addToast('Appointment cancelled', 'info');
      }
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const viewPass = async (passId) => {
    try {
      const res = await api.get(`/passes/${passId}`);
      setSelectedPass(res.data.data.pass);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Appointments & Pre-Registration</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Invite guests, review pre-registrations, trigger email/SMS alerts, and auto-issue QR passes.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <CalendarPlus size={16} />
          {user?.role === 'visitor' ? 'Pre-Register Visit' : 'Invite Visitor'}
        </button>
      </div>

      <div className="card card-pad">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search code, visitor, host, or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">No appointments found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Visitor</th>
                  <th>Host & Location</th>
                  <th>Schedule</th>
                  <th>Type & Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td>
                      <div className="mono" style={{ fontWeight: 700, fontSize: '0.84rem' }}>{apt.appointmentCode}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{apt.purpose}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={apt.visitor?.fullName} photoUrl={apt.visitor?.photoUrl} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{apt.visitor?.fullName}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{apt.visitor?.company}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{apt.host?.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{apt.locationName}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem' }}>{new Date(apt.scheduledDate).toLocaleString()}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{apt.expectedDurationMinutes} mins</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <StatusBadge value={apt.type} />
                        <StatusBadge value={apt.status} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {apt.status === 'pending' && ['admin', 'employee', 'security'].includes(user?.role) && (
                          <>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => handleAction(apt._id, 'approve')}>
                              <Check size={14} /> Approve
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleAction(apt._id, 'reject')}>
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                        {apt.pass && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => viewPass(apt.pass._id)}>
                            Pass: <span className="mono">{apt.pass.passCode}</span>
                          </button>
                        )}
                        {['pending', 'approved'].includes(apt.status) && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAction(apt._id, 'cancel')}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={user?.role === 'visitor' ? 'Pre-Register a Visit' : 'Invite Visitor'}>
        <form onSubmit={handleCreate} className="form-grid">
          {user?.role !== 'visitor' && (
            <>
              <div className="form-group full">
                <label className="form-label">Visitor Selection</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${form.visitorMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm({ ...form, visitorMode: 'existing' })}
                  >
                    Existing Visitor
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${form.visitorMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm({ ...form, visitorMode: 'new' })}
                  >
                    New Guest Details
                  </button>
                </div>
              </div>

              {form.visitorMode === 'existing' ? (
                <div className="form-group full">
                  <label className="form-label">Select Registered Visitor *</label>
                  <select
                    className="select"
                    value={form.visitorId}
                    onChange={(e) => setForm({ ...form, visitorId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose visitor --</option>
                    {visitors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.fullName} ({v.company} • {v.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Guest Full Name *</label>
                    <input
                      className="input"
                      value={form.visitorDetails.fullName}
                      onChange={(e) => setForm({ ...form, visitorDetails: { ...form.visitorDetails, fullName: e.target.value } })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Guest Email *</label>
                    <input
                      type="email"
                      className="input"
                      value={form.visitorDetails.email}
                      onChange={(e) => setForm({ ...form, visitorDetails: { ...form.visitorDetails, email: e.target.value } })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Guest Phone *</label>
                    <input
                      className="input"
                      value={form.visitorDetails.phone}
                      onChange={(e) => setForm({ ...form, visitorDetails: { ...form.visitorDetails, phone: e.target.value } })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input
                      className="input"
                      value={form.visitorDetails.company}
                      onChange={(e) => setForm({ ...form, visitorDetails: { ...form.visitorDetails, company: e.target.value } })}
                    />
                  </div>
                </>
              )}
            </>
          )}

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
            <label className="form-label">Campus Location / Gate</label>
            <select className="select" value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })}>
              {locations.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expected Duration (mins)</label>
            <input
              type="number"
              min={15}
              max={1440}
              className="input"
              value={form.expectedDurationMinutes}
              onChange={(e) => setForm({ ...form, expectedDurationMinutes: e.target.value })}
            />
          </div>

          <div className="form-group full">
            <label className="form-label">Purpose of Visit *</label>
            <input
              className="input"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g., Security Architecture Review"
              required
            />
          </div>

          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea
              className="textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional gate instructions or equipment declaration"
            />
          </div>

          <div className="form-group full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : user?.role === 'visitor' ? 'Submit Pre-Registration' : 'Send Invite & Issue Pass'}
            </button>
          </div>
        </form>
      </Modal>

      <PassDetailModal pass={selectedPass} open={Boolean(selectedPass)} onClose={() => setSelectedPass(null)} />
    </div>
  );
}
