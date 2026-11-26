import { useCallback, useEffect, useState } from 'react';
import { Building2, MapPinPlus, ShieldAlert, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';

export function AdminPage() {
  const { addToast } = useToast();

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [userModal, setUserModal] = useState(false);
  const [orgModal, setOrgModal] = useState(false);
  const [locTargetOrg, setLocTargetOrg] = useState(null);

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: 'Password123!',
    phone: '',
    role: 'employee',
    department: '',
    designation: '',
    organizationId: '',
  });
  const [orgForm, setOrgForm] = useState({
    name: '',
    code: '',
    industry: 'Technology',
    address: '',
    requireOtpForCheckIn: false,
  });
  const [locForm, setLocForm] = useState({ name: '', code: '', building: '', gateName: '' });

  const loadAll = useCallback(async () => {
    try {
      const [uRes, oRes, aRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/organizations'),
        api.get('/admin/audit-logs'),
      ]);
      setUsers(uRes.data.data || []);
      const orgList = oRes.data.data || [];
      setOrgs(orgList);
      setAuditLogs(aRes.data.data || []);
      if (orgList.length > 0) {
        setUserForm((prev) => ({ ...prev, organizationId: prev.organizationId || orgList[0]._id }));
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', userForm);
      addToast(`Created ${userForm.role} account for ${userForm.name}`, 'success');
      setUserModal(false);
      setUserForm((prev) => ({ ...prev, name: '', email: '', phone: '', department: '', designation: '' }));
      loadAll();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const toggleUserActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      addToast(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`, 'info');
      loadAll();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/organizations', orgForm);
      addToast(`Created organization ${orgForm.name}`, 'success');
      setOrgModal(false);
      setOrgForm({ name: '', code: '', industry: 'Technology', address: '', requireOtpForCheckIn: false });
      loadAll();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/organizations/${locTargetOrg._id}/locations`, locForm);
      addToast(`Added gate location ${locForm.name}`, 'success');
      setLocTargetOrg(null);
      setLocForm({ name: '', code: '', building: '', gateName: '' });
      loadAll();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const toggleOrgOtp = async (org) => {
    try {
      await api.patch(`/admin/organizations/${org._id}`, {
        requireOtpForCheckIn: !org.requireOtpForCheckIn,
      });
      addToast(`Updated OTP policy for ${org.name}`, 'success');
      loadAll();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Administration, Multi-Org & Audit Logs</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Manage staff roles, organizations, campus gates, OTP security policies, and system audit trails.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => setUserModal(true)}>
            <UserPlus size={16} /> Add Staff / User
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setOrgModal(true)}>
            <Building2 size={16} /> Add Organization
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')}>
          Staff & Users ({users.length})
        </button>
        <button type="button" className={`btn ${tab === 'orgs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('orgs')}>
          Organizations & Gates ({orgs.length})
        </button>
        <button type="button" className={`btn ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('audit')}>
          Security Audit Logs ({auditLogs.length})
        </button>
      </div>

      {tab === 'users' && (
        <div className="card card-pad">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td><StatusBadge value={u.role} /></td>
                    <td>{u.organization?.name || 'N/A'}</td>
                    <td>{u.department || '—'}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-emerald' : 'badge-rose'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleUserActive(u)}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orgs' && (
        <div className="grid-2">
          {orgs.map((org) => (
            <div key={org._id} className="card card-pad">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{org.name}</h3>
                  <p className="card-subtitle">
                    Code: <span className="mono">{org.code}</span> • {org.industry}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLocTargetOrg(org)}>
                  <MapPinPlus size={14} /> Add Gate
                </button>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                {org.address || 'No street address recorded'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Require OTP Verification on Check-In</span>
                <button
                  type="button"
                  className={`btn btn-sm ${org.requireOtpForCheckIn ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => toggleOrgOtp(org)}
                >
                  {org.requireOtpForCheckIn ? 'Enforced' : 'Optional'}
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                CAMPUS LOCATIONS / GATES ({org.locations?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(org.locations || []).map((loc) => (
                  <div key={loc.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span><strong>{loc.name}</strong> ({loc.gateName})</span>
                    <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{loc.code}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card card-pad">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((a) => (
                  <tr key={a._id}>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="mono" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <ShieldAlert size={13} color="#0284c7" /> {a.action}
                      </span>
                    </td>
                    <td>
                      <div>{a.actorName}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{a.actorRole}</div>
                    </td>
                    <td>{a.entityType}</td>
                    <td className="mono" style={{ fontSize: '0.74rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(a.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Create Staff or User Account">
        <form onSubmit={handleCreateUser} className="form-grid">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="input" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="input" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="select" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="employee">Employee / Host</option>
              <option value="security">Security / Frontdesk</option>
              <option value="admin">Admin</option>
              <option value="visitor">Visitor</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Organization *</label>
            <select className="select" value={userForm.organizationId} onChange={(e) => setUserForm({ ...userForm, organizationId: e.target.value })}>
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="input" value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <input className="input" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          </div>
          <div className="form-group full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setUserModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Account</button>
          </div>
        </form>
      </Modal>

      <Modal open={orgModal} onClose={() => setOrgModal(false)} title="Create New Organization">
        <form onSubmit={handleCreateOrg} className="form-grid">
          <div className="form-group">
            <label className="form-label">Organization Name *</label>
            <input className="input" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Short Code *</label>
            <input className="input mono" value={orgForm.code} onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })} placeholder="e.g., VERTEX" required />
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <input className="input" value={orgForm.industry} onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="input" value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} />
          </div>
          <div className="form-group full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOrgModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Organization</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(locTargetOrg)} onClose={() => setLocTargetOrg(null)} title={`Add Gate Location • ${locTargetOrg?.name || ''}`}>
        <form onSubmit={handleAddLocation} className="form-grid">
          <div className="form-group">
            <label className="form-label">Location Name *</label>
            <input className="input" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="South Annex" required />
          </div>
          <div className="form-group">
            <label className="form-label">Location Code *</label>
            <input className="input mono" value={locForm.code} onChange={(e) => setLocForm({ ...locForm, code: e.target.value })} placeholder="SOUTH-GATE" required />
          </div>
          <div className="form-group">
            <label className="form-label">Building</label>
            <input className="input" value={locForm.building} onChange={(e) => setLocForm({ ...locForm, building: e.target.value })} placeholder="Block C" />
          </div>
          <div className="form-group">
            <label className="form-label">Gate Desk Name</label>
            <input className="input" value={locForm.gateName} onChange={(e) => setLocForm({ ...locForm, gateName: e.target.value })} placeholder="Lobby Turnstile" />
          </div>
          <div className="form-group full" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setLocTargetOrg(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Location</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
