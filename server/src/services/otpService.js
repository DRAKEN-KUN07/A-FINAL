import crypto from 'crypto';
import { env } from '../config/env.js';
import { OtpToken } from '../models/OtpToken.js';
import { Visitor } from '../models/Visitor.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendNotification } from './notificationService.js';

function hashOtp(identifier, code) {
  return crypto
    .createHash('sha256')
    .update(`${identifier.toLowerCase().trim()}:${code}:${env.jwtSecret}`)
    .digest('hex');
}

export async function issueOtp({ identifier, channel = 'email', purpose = 'visitor_verify', visitorId, organizationId }) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) {
    throw new AppError(400, 'Email or phone identifier is required to request an OTP.');
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpToken.create({
    identifier: normalized,
    channel,
    purpose,
    codeHash: hashOtp(normalized, code),
    expiresAt,
    visitor: visitorId || undefined,
  });

  const log = await sendNotification({
    channel,
    recipient: normalized,
    subject: 'Your GatePass Verification OTP',
    message: `Your 6-digit verification code is ${code}. It expires in 10 minutes.`,
    eventType: 'OTP_VERIFICATION',
    organization: organizationId,
  });

  const exposeDemoOtp = env.nodeEnv !== 'production' || log?.status === 'simulated';

  return {
    identifier: normalized,
    channel,
    purpose,
    expiresAt,
    deliveryStatus: log?.status || 'simulated',
    ...(exposeDemoOtp ? { demoOtp: code } : {}),
  };
}

export async function verifyOtp({ identifier, code, purpose = 'visitor_verify' }) {
  const normalized = String(identifier || '').trim().toLowerCase();
  const submittedCode = String(code || '').trim();

  if (!normalized || !submittedCode) {
    throw new AppError(400, 'Identifier and 6-digit OTP code are required.');
  }

  const tokenDoc = await OtpToken.findOne({
    identifier: normalized,
    purpose,
    verifiedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!tokenDoc) {
    throw new AppError(400, 'No active OTP found or OTP has expired. Please request a new code.');
  }

  if (tokenDoc.attempts >= 5) {
    throw new AppError(429, 'Too many failed OTP attempts. Please request a new code.');
  }

  const expectedHash = hashOtp(normalized, submittedCode);
  if (expectedHash !== tokenDoc.codeHash) {
    tokenDoc.attempts += 1;
    await tokenDoc.save();
    throw new AppError(400, 'Invalid OTP code.');
  }

  tokenDoc.verifiedAt = new Date();
  await tokenDoc.save();

  if (tokenDoc.visitor) {
    await Visitor.findByIdAndUpdate(tokenDoc.visitor, { otpVerified: true });
  } else {
    await Visitor.updateMany(
      { $or: [{ email: normalized }, { phone: normalized }] },
      { otpVerified: true }
    );
  }

  return { verified: true, identifier: normalized, verifiedAt: tokenDoc.verifiedAt };
}
