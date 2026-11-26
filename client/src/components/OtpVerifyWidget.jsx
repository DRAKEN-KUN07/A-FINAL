import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export function OtpVerifyWidget({ defaultIdentifier = '', visitorId = '', onVerified }) {
  const { addToast } = useToast();
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [channel, setChannel] = useState('email');
  const [code, setCode] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [step, setStep] = useState('request');
  const [busy, setBusy] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/auth/otp/request', {
        identifier,
        channel,
        purpose: 'visitor_verify',
        visitorId: visitorId || undefined,
      });
      setDemoOtp(res.data.data.demoOtp || '');
      setStep('verify');
      addToast(`OTP dispatched via ${channel}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/otp/verify', {
        identifier,
        code,
        purpose: 'visitor_verify',
      });
      addToast('OTP verified successfully!', 'success');
      setStep('done');
      if (onVerified) onVerified();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad" style={{ background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <KeyRound size={18} color="#0284c7" />
        <strong style={{ fontSize: '0.94rem' }}>OTP Identity Verification</strong>
      </div>

      {step === 'done' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--emerald)', fontWeight: 600 }}>
          <ShieldCheck size={18} /> Verified for {identifier}
        </div>
      ) : step === 'request' ? (
        <form onSubmit={handleRequest} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 180 }}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or phone number"
            required
          />
          <select
            className="select"
            style={{ width: 110 }}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {demoOtp && (
            <div
              style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '0.82rem',
              }}
            >
              Demo Mode OTP for <strong>{identifier}</strong>:{' '}
              <span className="mono" style={{ fontWeight: 700 }}>{demoOtp}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 150 }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              required
            />
            <button type="submit" className="btn btn-success btn-sm" disabled={busy}>
              {busy ? 'Verifying...' : 'Verify Code'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep('request')}>
              Resend
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
