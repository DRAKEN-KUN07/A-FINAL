import { Appointment } from '../models/Appointment.js';
import { CheckLog } from '../models/CheckLog.js';
import { Pass } from '../models/Pass.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';
import { verifySignedQrToken } from '../services/qrService.js';
import { verifyOtp } from '../services/otpService.js';
import { dispatchEventNotifications } from '../services/notificationService.js';
import { recordAudit } from '../services/auditService.js';

export const listCheckLogs = asyncHandler(async (req, res) => {
  const { action, search, organizationId, locationCode, from, to } = req.query;
  const filter = {};

  if (req.user.role === 'employee') {
    filter.host = req.user._id;
  } else if (req.user.role !== 'visitor') {
    const orgId = resolveOrganizationScope(req, organizationId);
    if (orgId) filter.organization = orgId;
  } else {
    throw new AppError(403, 'Visitors cannot browse facility check logs.');
  }

  if (action && action !== 'all') filter.action = action;
  if (locationCode && locationCode !== 'all') filter.locationCode = locationCode.toUpperCase();
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  let logs = await CheckLog.find(filter)
    .populate('pass', 'passCode status locationName')
    .populate('visitor', 'fullName email phone company photoUrl')
    .populate('host', 'name department')
    .populate('scannedBy', 'name role')
    .populate('organization', 'name code')
    .sort({ timestamp: -1 })
    .limit(250);

  if (search) {
    const q = search.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        l.pass?.passCode?.toLowerCase().includes(q) ||
        l.visitor?.fullName?.toLowerCase().includes(q) ||
        l.visitor?.company?.toLowerCase().includes(q) ||
        l.gate?.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: logs.length, data: logs });
});

export const scanAndProcessPass = asyncHandler(async (req, res) => {
  const {
    qrToken,
    passCode,
    action = 'auto',
    gate,
    scanMethod = 'manual_code',
    notes = '',
    otpCode,
  } = req.body;

  if (!qrToken && !passCode) {
    throw new AppError(400, 'Please provide a QR token or pass code to scan.');
  }

  let pass = null;

  if (qrToken) {
    const trimmed = qrToken.trim();
    if (trimmed.startsWith('VP-')) {
      pass = await Pass.findOne({ passCode: trimmed.toUpperCase() })
        .populate('visitor')
        .populate('host')
        .populate('organization');
    } else {
      const verification = verifySignedQrToken(trimmed);
      if (!verification.valid) {
        throw new AppError(400, `Invalid QR code: ${verification.reason}`);
      }
      pass = await Pass.findOne({ qrToken: trimmed })
        .populate('visitor')
        .populate('host')
        .populate('organization');
    }
  } else {
    pass = await Pass.findOne({ passCode: passCode.trim().toUpperCase() })
      .populate('visitor')
      .populate('host')
      .populate('organization');
  }

  if (!pass) {
    throw new AppError(404, 'Visitor pass not found.');
  }

  if (
    req.user.role !== 'admin' &&
    String(pass.organization?._id || pass.organization) !==
      String(req.user.organization?._id || req.user.organization)
  ) {
    throw new AppError(403, 'Pass belongs to a different organization.');
  }

  if (pass.visitor?.isBlacklisted) {
    throw new AppError(403, 'Security Alert: Visitor is blacklisted and cannot check in.');
  }
  if (pass.status === 'revoked') {
    throw new AppError(400, `Pass ${pass.passCode} has been revoked (${pass.revokedReason || 'No reason provided'}).`);
  }

  const now = new Date();
  if (now > new Date(pass.validUntil) && pass.status !== 'checked_in') {
    pass.status = 'expired';
    await pass.save();
    throw new AppError(400, `Pass ${pass.passCode} expired on ${new Date(pass.validUntil).toLocaleString()}.`);
  }

  const earlyGraceMs = 60 * 60 * 1000;
  if (now.getTime() < new Date(pass.validFrom).getTime() - earlyGraceMs) {
    throw new AppError(
      400,
      `Pass ${pass.passCode} is not active yet. Valid from ${new Date(pass.validFrom).toLocaleString()}.`
    );
  }

  const resolvedAction =
    action === 'auto' ? (pass.status === 'checked_in' ? 'check_out' : 'check_in') : action;

  if (!['check_in', 'check_out'].includes(resolvedAction)) {
    throw new AppError(400, 'Action must be check_in, check_out, or auto.');
  }

  if (resolvedAction === 'check_in' && pass.status === 'checked_in') {
    throw new AppError(400, `Visitor ${pass.visitor?.fullName} is already checked in.`);
  }
  if (resolvedAction === 'check_out' && pass.status !== 'checked_in') {
    throw new AppError(400, `Cannot check out: Visitor ${pass.visitor?.fullName} is not currently checked in.`);
  }

  // Optional org-level OTP check on first check-in
  if (
    resolvedAction === 'check_in' &&
    pass.organization?.requireOtpForCheckIn &&
    !pass.visitor?.otpVerified
  ) {
    if (!otpCode) {
      throw new AppError(400, 'This organization requires OTP verification before check-in. Please provide otpCode.');
    }
    await verifyOtp({
      identifier: pass.visitor.email,
      code: otpCode,
      purpose: 'visitor_verify',
    });
  }

  if (resolvedAction === 'check_in') {
    pass.status = 'checked_in';
    pass.checkInCount += 1;
    pass.lastCheckInAt = now;
  } else {
    pass.status = 'checked_out';
    pass.lastCheckOutAt = now;
    if (pass.appointment) {
      await Appointment.findByIdAndUpdate(pass.appointment, { status: 'completed' });
    }
  }
  await pass.save();

  const checkLog = await CheckLog.create({
    pass: pass._id,
    visitor: pass.visitor._id,
    host: pass.host?._id,
    organization: pass.organization._id,
    locationCode: pass.locationCode,
    gate: gate?.trim() || pass.locationName || 'Main Reception',
    action: resolvedAction,
    scanMethod,
    scannedBy: req.user._id,
    timestamp: now,
    notes: notes.trim(),
  });

  if (resolvedAction === 'check_in') {
    await dispatchEventNotifications({
      eventType: 'VISITOR_CHECKED_IN',
      visitor: pass.visitor,
      host: pass.host,
      pass,
      organization: pass.organization,
    });
  }

  await recordAudit({
    action: resolvedAction === 'check_in' ? 'VISITOR_CHECKED_IN' : 'VISITOR_CHECKED_OUT',
    entityType: 'CheckLog',
    entityId: checkLog._id,
    req,
    organization: pass.organization?._id,
    details: {
      passCode: pass.passCode,
      visitorName: pass.visitor?.fullName,
      gate: checkLog.gate,
      scanMethod,
    },
  });

  const populatedLog = await CheckLog.findById(checkLog._id)
    .populate('pass', 'passCode status validUntil locationName')
    .populate('visitor', 'fullName email phone company photoUrl')
    .populate('host', 'name department')
    .populate('scannedBy', 'name role');

  res.status(201).json({
    success: true,
    message:
      resolvedAction === 'check_in'
        ? `${pass.visitor?.fullName} checked in successfully.`
        : `${pass.visitor?.fullName} checked out successfully.`,
    data: {
      action: resolvedAction,
      pass,
      checkLog: populatedLog,
    },
  });
});
