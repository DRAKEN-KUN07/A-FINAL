import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

export function generatePassCode() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VP-${year}-${suffix}`;
}

export function generateAppointmentCode() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APT-${year}-${suffix}`;
}

/**
 * Create an HMAC-SHA256 signed QR token so scanned passes cannot be forged.
 */
export function createSignedQrToken({ passCode, visitorId, organizationId }) {
  const payload = {
    p: passCode,
    v: String(visitorId),
    o: String(organizationId),
    t: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', env.qrSigningSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${sig}`;
}

/**
 * Verify a signed QR token in constant time and decode its payload.
 */
export function verifySignedQrToken(qrToken) {
  if (!qrToken || typeof qrToken !== 'string' || !qrToken.includes('.')) {
    return { valid: false, reason: 'Malformed QR token format' };
  }
  const [encodedPayload, providedSig] = qrToken.split('.');
  if (!encodedPayload || !providedSig) {
    return { valid: false, reason: 'Missing QR token signature' };
  }

  const expectedSig = crypto
    .createHmac('sha256', env.qrSigningSecret)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: 'QR signature verification failed' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Invalid QR payload JSON' };
  }
}

export async function generateQrDataUrl(qrToken) {
  return QRCode.toDataURL(qrToken, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export async function generateQrBuffer(qrToken) {
  return QRCode.toBuffer(qrToken, {
    width: 260,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
