import { Pass } from '../models/Pass.js';
import { AppError } from '../middleware/errorHandler.js';
import { createSignedQrToken, generatePassCode, generateQrDataUrl } from './qrService.js';
import { dispatchEventNotifications } from './notificationService.js';
import { recordAudit } from './auditService.js';

/**
 * Shared helper to generate a signed QR pass, persist it, notify the visitor, and log an audit entry.
 */
export async function issuePassRecord({
  visitor,
  appointment = null,
  host,
  organization,
  locationCode = 'MAIN-GATE',
  locationName = 'Main Reception',
  purpose = 'Scheduled Visit',
  validFrom,
  validUntil,
  issuedBy,
  req = null,
}) {
  if (!visitor) {
    throw new AppError(404, 'Visitor record is required to issue a pass.');
  }
  if (visitor.isBlacklisted) {
    throw new AppError(403, 'Cannot issue pass: visitor is marked as restricted/blacklisted.');
  }

  const orgId = organization?._id || organization;
  const start = validFrom ? new Date(validFrom) : new Date();
  const durationMs = (appointment?.expectedDurationMinutes || 240) * 60 * 1000;
  const end = validUntil ? new Date(validUntil) : new Date(start.getTime() + durationMs);

  if (end <= start) {
    throw new AppError(400, 'Pass validUntil timestamp must be after validFrom.');
  }

  const passCode = generatePassCode();
  const qrToken = createSignedQrToken({
    passCode,
    visitorId: visitor._id,
    organizationId: orgId,
  });
  const qrDataUrl = await generateQrDataUrl(qrToken);

  const pass = await Pass.create({
    passCode,
    qrToken,
    qrDataUrl,
    visitor: visitor._id,
    appointment: appointment?._id || undefined,
    host: host?._id || host,
    organization: orgId,
    locationCode: String(locationCode || 'MAIN-GATE').toUpperCase(),
    locationName: locationName || 'Main Reception',
    purpose: purpose || appointment?.purpose || visitor.purpose || 'Scheduled Visit',
    validFrom: start,
    validUntil: end,
    status: 'active',
    issuedBy: issuedBy?._id || issuedBy,
  });

  await dispatchEventNotifications({
    eventType: 'PASS_ISSUED',
    visitor,
    host,
    appointment,
    pass,
    organization,
  });

  await recordAudit({
    action: 'PASS_ISSUED',
    entityType: 'Pass',
    entityId: pass._id,
    req,
    user: issuedBy,
    organization: orgId,
    details: { passCode: pass.passCode, visitorName: visitor.fullName, locationCode: pass.locationCode },
  });

  return pass;
}
