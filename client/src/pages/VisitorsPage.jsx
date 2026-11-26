import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { OtpVerifyWidget } from '../components/OtpVerifyWidget';
import { StatusBadge } from '../components/StatusBadge';

export function VisitorsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [otpVisitor, setOtpVisitor] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    idType: 'National ID',
    idNumber: '',
    purpose: '',
    vehicleNumber: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/visitors', { params: { search: search || undefined } });
      setVisitors(res.data.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, addToast]);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      addToast('Webcam unavailable or permission denied. You can upload an image file instead.', 'error');
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      'image/jpeg',
      0.9
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (photoFile) {
        fd.append('photo', photoFile);
      }
      await api.post('/visitors', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast(`Registered visitor ${form.fullName}`, 'success');
      setModalOpen(false);
      stopCamera();
      setForm({
        fullName: '',
        email: '',
        phone: '',
        company: '',
        idType: 'National ID',
        idNumber: '',
        purpose: '',
        vehicleNumber: '',
      });
      setPhotoFile(null);
      setPhotoPreview('');
      fetchVisitors();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlacklist = async (visitor) => {
    try {
      await api.patch(`/visitors/${visitor._id}/blacklist`, {
        isBlacklisted: !visitor.isBlacklisted,
      });
      addToast(
        visitor.isBlacklisted ? `${visitor.fullName} removed from watchlist` : `${visitor.fullName} flagged on watchlist`,
        'info'
      );
      fetchVisitors();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Visitor Directory & Registration</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Register walk-in guests with webcam or photo upload, verify IDs, and manage OTP verification.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Register Visitor
        </button>
      </div>

      <div className="card card-pad">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by name, email, phone, company, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-secondary" onClick={fetchVisitors}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading visitors...</div>
        ) : visitors.length === 0 ? (
          <div className="empty-state">No visitors match your search.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Contact</th>
                  <th>Company & ID</th>
                  <th>OTP Status</th>
                  <th>Campus</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={v.fullName} photoUrl={v.photoUrl} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{v.fullName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {v.purpose || 'General Visit'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{v.email}</div>
                      <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{v.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{v.company}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {v.idType} {v.idNumber ? `• ${v.idNumber}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {v.otpVerified ? (
                          <span className="badge badge-emerald">
                            <CheckCircle2 size={12} /> Verified
                          </span>
                        ) : (
                          <span className="badge badge-amber">Unverified</span>
                        )}
                        {v.isBlacklisted && <StatusBadge value="revoked" />}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-slate">{v.organization?.code || 'ORG'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!v.otpVerified && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setOtpVisitor(v)}
                          >
                            <KeyRound size={13} /> OTP
                          </button>
                        )}
                        {(user?.role === 'admin' || user?.role === 'security') && (
                          <button
                            type="button"
                            className={`btn btn-sm ${v.isBlacklisted ? 'btn-secondary' : 'btn-danger'}`}
                            onClick={() => toggleBlacklist(v)}
                            title={v.isBlacklisted ? 'Remove restriction' : 'Flag visitor'}
                          >
                            <ShieldAlert size={13} /> {v.isBlacklisted ? 'Unflag' : 'Restrict'}
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

      <Modal
        open={modalOpen}
        onClose={() => {
          stopCamera();
          setModalOpen(false);
        }}
        title="Register New Visitor"
        maxWidth={640}
      >
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-group full" style={{ background: 'var(--bg-muted)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
            <label className="form-label">Visitor Photo (Upload or Webcam Capture)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)' }} />
              ) : (
                <Avatar name={form.fullName || 'Visitor'} large />
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={14} /> Upload Image
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
                </label>
                {!cameraActive ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={startCamera}>
                    <Camera size={14} /> Use Webcam
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={captureSnapshot}>
                    Capture Snapshot
                  </button>
                )}
              </div>
            </div>
            {cameraActive && (
              <div style={{ marginTop: 12 }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 220, borderRadius: 10, background: '#0f172a' }} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Company / Organization</label>
            <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">ID Type</label>
            <select className="select" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
              <option>National ID</option>
              <option>Passport</option>
              <option>Driver License</option>
              <option>Employee Badge</option>
              <option>Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ID Number</label>
            <input className="input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Purpose of Visit</label>
            <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Number</label>
            <input className="input" value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} />
          </div>

          <div className="form-group full" style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', flexDirection: 'row', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                stopCamera();
                setModalOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Visitor Profile'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(otpVisitor)} onClose={() => setOtpVisitor(null)} title={`Verify OTP • ${otpVisitor?.fullName || ''}`}>
        {otpVisitor && (
          <OtpVerifyWidget
            defaultIdentifier={otpVisitor.email}
            visitorId={otpVisitor._id}
            onVerified={() => {
              fetchVisitors();
              setTimeout(() => setOtpVisitor(null), 900);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
