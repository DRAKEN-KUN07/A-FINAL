import { useState } from 'react';
import { CheckCircle2, Copy, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

export function PassDetailModal({ pass, open, onClose }) {
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!pass) return null;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/passes/${pass._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `visitor-pass-${pass.passCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast(`Downloaded PDF badge for ${pass.passCode}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} copied to clipboard`, 'success');
    } catch {
      addToast('Copy not supported in this browser context', 'error');
    }
  };

  const publicUrl = `${window.location.origin}/verify/${pass.passCode}`;

  return (
    <Modal open={open} onClose={onClose} title={`Digital Visitor Pass • ${pass.passCode}`} maxWidth={560}>
      <div className="digital-pass-card">
        <div className="digital-pass-banner">
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7dd3fc', fontWeight: 700 }}>
              Official Visitor Badge
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
              {pass.organization?.name || 'GatePass Organization'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 2 }}>
              {pass.locationName || pass.locationCode}
            </div>
          </div>
          <StatusBadge value={pass.status} />
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <Avatar name={pass.visitor?.fullName} photoUrl={pass.visitor?.photoUrl} large />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {pass.visitor?.fullName}
                {pass.visitor?.otpVerified && (
                  <span title="OTP Verified" style={{ color: 'var(--emerald)', display: 'inline-flex' }}>
                    <CheckCircle2 size={17} />
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {pass.visitor?.company || 'Independent Visitor'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 3 }}>
                Host: <strong>{pass.host?.name || 'Reception'}</strong>
                {pass.host?.department ? ` (${pass.host.department})` : ''}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              background: 'var(--bg-muted)',
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border)',
              marginBottom: 12,
              fontSize: '0.82rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>PASS CODE</div>
              <div className="mono" style={{ fontWeight: 700, marginTop: 2 }}>{pass.passCode}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>PURPOSE</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{pass.purpose}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>VALID FROM</div>
              <div style={{ marginTop: 2 }}>{new Date(pass.validFrom).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>VALID UNTIL</div>
              <div style={{ marginTop: 2 }}>{new Date(pass.validUntil).toLocaleString()}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '2px 0' }}>
            {pass.qrDataUrl && (
              <img
                src={pass.qrDataUrl}
                alt={`QR for ${pass.passCode}`}
                style={{
                  width: 124,
                  height: 124,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  padding: 5,
                  background: '#fff',
                }}
              />
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#0284c7" />
              HMAC-SHA256 Signed QR Token • Scan at security gate
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyText(pass.qrToken, 'QR Token')}>
            <Copy size={14} /> Copy QR Token
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyText(publicUrl, 'Public Pass Link')}>
            <ExternalLink size={14} /> Copy Verify Link
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={downloading}>
          <Download size={16} /> {downloading ? 'Generating PDF...' : 'Download PDF Badge'}
        </button>
      </div>
    </Modal>
  );
}
