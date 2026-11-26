import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function RegisterPage() {
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    idType: 'National ID',
    idNumber: '',
    organizationId: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/auth/directory')
      .then((res) => {
        const orgs = res.data.data?.organizations || [];
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setForm((prev) => ({ ...prev, organizationId: orgs[0]._id }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      addToast('Account created! You can now pre-register visits and verify OTP.', 'success');
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0369a1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 580, width: '100%', padding: 28, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Visitor Self-Registration</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Register once to pre-book visits and access your QR & PDF passes.
            </p>
          </div>
          <Link to="/login" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Login
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Jordan Lee"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jordan@company.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Company / Organization</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Acme Consulting"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Government ID Type</label>
            <select
              className="select"
              value={form.idType}
              onChange={(e) => setForm({ ...form, idType: e.target.value })}
            >
              <option>National ID</option>
              <option>Passport</option>
              <option>Driver License</option>
              <option>Employee Badge</option>
              <option>Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ID Number</label>
            <input
              className="input"
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              placeholder="Optional ID reference"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Target Campus / Organization</label>
            <select
              className="select"
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            >
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 6 characters"
              required
            />
          </div>

          <div className="form-group full" style={{ marginTop: 6 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <UserPlus size={16} /> {busy ? 'Creating Account...' : 'Create Visitor Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
