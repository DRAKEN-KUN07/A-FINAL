import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, ImageUp, LogIn, LogOut, QrCode, ScanLine, StopCircle } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';

export function ScannerPage() {
  const { addToast } = useToast();

  const [tokenOrCode, setTokenOrCode] = useState('');
  const [action, setAction] = useState('auto');
  const [gate, setGate] = useState('Main Reception Desk');
  const [notes, setNotes] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);

  const [lastResult, setLastResult] = useState(null);
  const [activePasses, setActivePasses] = useState([]);
  const [checkLogs, setCheckLogs] = useState([]);

  const [cameraRunning, setCameraRunning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const loadGateData = useCallback(async () => {
    try {
      const [passesRes, logsRes] = await Promise.all([
        api.get('/passes'),
        api.get('/checklogs'),
      ]);
      setActivePasses(
        (passesRes.data.data || []).filter((p) => ['active', 'checked_in'].includes(p.status))
      );
      setCheckLogs(logsRes.data.data || []);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [addToast]);

  useEffect(() => {
    loadGateData();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [loadGateData]);

  const processScan = async (value, scanMethod = 'manual_code', explicitAction = action) => {
    if (!value?.trim()) {
      addToast('Enter or scan a QR token or Pass Code first.', 'error');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        qrToken: value.trim(),
        action: explicitAction,
        gate,
        scanMethod,
        notes,
        ...(otpCode ? { otpCode } : {}),
      };
      const res = await api.post('/checklogs/scan', payload);
      setLastResult(res.data);
      addToast(res.data.message, 'success');
      setTokenOrCode('');
      setNotes('');
      setOtpCode('');
      loadGateData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraRunning(false);
  };

  const startCameraScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraRunning(true);

      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = () => {
          if (!streamRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code?.data) {
              stopCamera();
              setTokenOrCode(code.data);
              processScan(code.data, 'qr_camera', action);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };
        rafRef.current = requestAnimationFrame(scanFrame);
      }, 100);
    } catch {
      addToast('Camera access unavailable. Use QR image upload or manual pass code below.', 'error');
    }
  };

  const handleQrImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);
      if (decoded?.data) {
        setTokenOrCode(decoded.data);
        processScan(decoded.data, 'qr_image', action);
      } else {
        addToast('Could not detect a valid QR code in that image.', 'error');
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Security Gate QR Scanner & Check-In</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Scan visitor QR passes via camera, upload a QR screenshot, or verify pass codes manually.
        </p>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">Scan or Enter Visitor Pass</h3>
              <p className="card-subtitle">HMAC signature and validity window verified server-side</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!cameraRunning ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={startCameraScanner}>
                  <Camera size={14} /> Start Camera
                </button>
              ) : (
                <button type="button" className="btn btn-danger btn-sm" onClick={stopCamera}>
                  <StopCircle size={14} /> Stop Camera
                </button>
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <ImageUp size={14} /> Upload QR Image
                <input type="file" accept="image/*" hidden onChange={handleQrImageUpload} />
              </label>
            </div>
          </div>

          {cameraRunning && (
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <video ref={videoRef} playsInline style={{ width: '100%', maxHeight: 260, borderRadius: 12, background: '#0f172a' }} />
              <div style={{ position: 'absolute', bottom: 10, left: 12, background: 'rgba(15,23,42,0.75)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.76rem' }}>
                Point QR badge at camera...
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              processScan(tokenOrCode, 'manual_code', action);
            }}
            className="form-grid"
          >
            <div className="form-group full">
              <label className="form-label">Pass Code (VP-...) or Signed QR Token</label>
              <div style={{ position: 'relative' }}>
                <QrCode size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                <input
                  className="input mono"
                  style={{ paddingLeft: 36 }}
                  value={tokenOrCode}
                  onChange={(e) => setTokenOrCode(e.target.value)}
                  placeholder="e.g., VP-2026-8F4A2C or paste QR payload"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Gate Action</label>
              <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="auto">Auto Toggle (In / Out)</option>
                <option value="check_in">Force Check-In</option>
                <option value="check_out">Force Check-Out</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Checkpoint / Gate</label>
              <input className="input" value={gate} onChange={(e) => setGate(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Optional Gate Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ID verified, laptop tag #12" />
            </div>

            <div className="form-group">
              <label className="form-label">OTP Code (if org enforces OTP)</label>
              <input className="input mono" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6-digit OTP" />
            </div>

            <div className="form-group full">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <ScanLine size={16} /> {busy ? 'Verifying...' : 'Verify & Log Gate Scan'}
              </button>
            </div>
          </form>

          {lastResult && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <CheckCircle2 size={24} color="#059669" />
              <div>
                <div style={{ fontWeight: 700, color: '#065f46' }}>{lastResult.message}</div>
                <div style={{ fontSize: '0.82rem', color: '#047857' }}>
                  Pass: <span className="mono">{lastResult.data?.pass?.passCode}</span> • Action:{' '}
                  <strong>{lastResult.data?.action?.replace('_', ' ')}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-header">
            <div>
              <h3 className="card-title">Quick-Action Active Passes</h3>
              <p className="card-subtitle">1-click frontdesk check-in or check-out</p>
            </div>
          </div>

          {activePasses.length === 0 ? (
            <div className="empty-state">No active or checked-in passes at this moment.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
              {activePasses.map((p) => {
                const isInside = p.status === 'checked_in';
                return (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.visitor?.fullName} photoUrl={p.visitor?.photoUrl} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.visitor?.fullName}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          <span className="mono">{p.passCode}</span> • {p.locationCode}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge value={p.status} />
                      <button
                        type="button"
                        className={`btn btn-sm ${isInside ? 'btn-secondary' : 'btn-success'}`}
                        disabled={busy}
                        onClick={() =>
                          processScan(p.qrToken, 'quick_action', isInside ? 'check_out' : 'check_in')
                        }
                      >
                        {isInside ? (
                          <>
                            <LogOut size={13} /> Check Out
                          </>
                        ) : (
                          <>
                            <LogIn size={13} /> Check In
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Gate Check-In / Check-Out Audit Trail</h3>
            <p className="card-subtitle">Live records from CheckLogs collection</p>
          </div>
        </div>
        {checkLogs.length === 0 ? (
          <div className="empty-state">No gate logs recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Visitor</th>
                  <th>Pass Code</th>
                  <th>Action</th>
                  <th>Gate & Method</th>
                  <th>Officer</th>
                </tr>
              </thead>
              <tbody>
                {checkLogs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.visitor?.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.visitor?.company}</div>
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>{log.pass?.passCode}</td>
                    <td><StatusBadge value={log.action} /></td>
                    <td>
                      <div>{log.gate}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{log.scanMethod}</div>
                    </td>
                    <td>{log.scannedBy?.name}</td>
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
