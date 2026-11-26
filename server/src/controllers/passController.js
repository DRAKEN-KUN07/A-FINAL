import { Appointment } from '../models/Appointment.js';
import { CheckLog } from '../models/CheckLog.js';
import { Organization } from '../models/Organization.js';
import { Pass } from '../models/Pass.js';
import { User } from '../models/User.js';
import { Visitor } from '../models/Visitor.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';
import { issuePassRecord } from '../services/passService.js';
import { generatePassPdfBuffer } from '../services/pdfService.js';
import { recordAudit } from '../services/auditService.js';

export const listPasses = asyncHandler(async (req, res) => {
  const { status, search, organizationId, locationCode, from, to } = req.query;
  const filter = {};

  if (req.user.role === 'visitor') {
    const visitorIds = await Visitor.find({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).distinct('_id');
    filter.visitor = { $in: visitorIds };
  } else if (req.user.role === 'employee') {
    filter.host = req.user._id;
  } else {
    const orgId = resolveOrganizationScope(req, organizationId);
    if (orgId) filter.organization = orgId;
  }

  if (status && status !== 'all') filter.status = status;
  if (locationCode && locationCode !== 'all') filter.locationCode = locationCode.toUpperCase();
  if (from || to) {
    filter.validFrom = {};
    if (from) filter.validFrom.$gte = new Date(from);
    if (to) filter.validFrom.$lte = new Date(to);
  }

  let passes = await Pass.find(filter)
    .populate('visitor', 'fullName email phone company idType idNumber photoUrl otpVerified')
    .populate('host', 'name email department')
    .populate('organization', 'name code')
    .populate('issuedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(200);

  if (search) {
    const q = search.toLowerCase().trim();
    passes = passes.filter(
      (p) =>
        p.passCode?.toLowerCase().includes(q) ||
        p.purpose?.toLowerCase().includes(q) ||
        p.visitor?.fullName?.toLowerCase().includes(q) ||
        p.visitor?.company?.toLowerCase().includes(q) ||
        p.host?.name?.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: passes.length, data: passes });
});

function assertPassAccess(req, pass) {
  if (req.user.role === 'admin') return;
  const userOrgId = String(req.user.organization?._id || req.user.organization || '');
  const passOrgId = String(pass.organization?._id || pass.organization || '');

  if (req.user.role === 'visitor') {
    const isOwner =
      String(pass.visitor?.user || '') === String(req.user._id) ||
      pass.visitor?.email === req.user.email;
    if (!isOwner) {
      throw new AppError(403, 'Not authorized to access this pass.');
    }
    return;
  }

  if (userOrgId && passOrgId && userOrgId !== passOrgId) {
    throw new AppError(403, 'Pass belongs to a different organization.');
  }

  if (req.user.role === 'employee' && String(pass.host?._id || pass.host) !== String(req.user._id)) {
    throw new AppError(403, 'Employees can only access passes for their own hosted visitors.');
  }
}

export const getPassById = asyncHandler(async (req, res) => {
  const pass = await Pass.findById(req.params.id)
    .populate('visitor')
    .populate('host', 'name email department designation phone')
    .populate('organization', 'name code address locations')
    .populate('issuedBy', 'name role')
    .populate('appointment', 'appointmentCode scheduledDate status');

  if (!pass) {
    throw new AppError(404, 'Visitor pass not found.');
  }

  assertPassAccess(req, pass);

  const checkLogs = await CheckLog.find({ pass: pass._id })
    .populate('scannedBy', 'name role')
    .sort({ timestamp: -1 });

  res.json({ success: true, data: { pass, checkLogs } });
});

export const getPublicPassPreview = asyncHandler(async (req, res) => {
  const pass = await Pass.findOne({ passCode: req.params.passCode.toUpperCase() })
    .populate('visitor', 'fullName company photoUrl otpVerified')
    .populate('host', 'name department')
    .populate('organization', 'name code address');

  if (!pass) {
    throw new AppError(404, 'Pass not found.');
  }

  res.json({
    success: true,
    data: {
      passCode: pass.passCode,
      status: pass.status,
      purpose: pass.purpose,
      locationCode: pass.locationCode,
      locationName: pass.locationName,
      validFrom: pass.validFrom,
      validUntil: pass.validUntil,
      qrDataUrl: pass.qrDataUrl,
      visitor: pass.visitor,
      host: pass.host,
      organization: pass.organization,
    },
  });
});

export const createPass = asyncHandler(async (req, res) => {
  const {
    visitorId,
    appointmentId,
    hostId,
    locationCode,
    purpose,
    validFrom,
    validUntil,
    validHours = 8,
  } = req.body;

  let appointment = null;
  if (appointmentId) {
    appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new AppError(404, 'Referenced appointment not found.');
  }

  const resolvedVisitorId = visitorId || appointment?.visitor;
  const visitor = await Visitor.findById(resolvedVisitorId);
  if (!visitor) {
    throw new AppError(404, 'Visitor not found.');
  }

  const orgId = appointment?.organization || visitor.organization || req.user.organization?._id || req.user.organization;
  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new AppError(404, 'Organization not found.');
  }

  const resolvedHostId = hostId || appointment?.host || req.user._id;
  const host = await User.findById(resolvedHostId);

  const locCode = (locationCode || appointment?.locationCode || organization.locations?.[0]?.code || 'MAIN-GATE').toUpperCase();
  const locObj = organization.locations?.find((l) => l.code === locCode);
  const locationName = locObj ? `${locObj.name} - ${locObj.gateName}` : appointment?.locationName || 'Main Reception';

  const start = validFrom ? new Date(validFrom) : new Date();
  const end = validUntil
    ? new Date(validUntil)
    : new Date(start.getTime() + Number(validHours) * 60 * 60 * 1000);

  const pass = await issuePassRecord({
    visitor,
    appointment,
    host,
    organization,
    locationCode: locCode,
    locationName,
    purpose: purpose || appointment?.purpose || visitor.purpose || 'General Visit',
    validFrom: start,
    validUntil: end,
    issuedBy: req.user,
    req,
  });

  if (appointment && appointment.status === 'pending') {
    appointment.status = 'approved';
    appointment.approvedBy = req.user._id;
    appointment.approvedAt = new Date();
    await appointment.save();
  }

  const populated = await Pass.findById(pass._id)
    .populate('visitor', 'fullName email phone company photoUrl otpVerified')
    .populate('host', 'name email department')
    .populate('organization', 'name code')
    .populate('issuedBy', 'name role');

  res.status(201).json({ success: true, data: populated });
});

export const downloadPassPdf = asyncHandler(async (req, res) => {
  const pass = await Pass.findById(req.params.id)
    .populate('visitor')
    .populate('host', 'name department')
    .populate('organization', 'name code')
    .populate('issuedBy', 'name role');

  if (!pass) {
    throw new AppError(404, 'Visitor pass not found.');
  }

  assertPassAccess(req, pass);

  const pdfBuffer = await generatePassPdfBuffer(pass);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="visitor-pass-${pass.passCode}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

export const revokePass = asyncHandler(async (req, res) => {
  const pass = await Pass.findById(req.params.id);
  if (!pass) {
    throw new AppError(404, 'Visitor pass not found.');
  }

  if (req.user.role === 'employee' && String(pass.host) !== String(req.user._id)) {
    throw new AppError(403, 'Employees can only revoke passes for their own visitors.');
  }

  pass.status = 'revoked';
  pass.revokedReason = req.body.reason?.trim() || 'Revoked by security/host';
  pass.revokedBy = req.user._id;
  await pass.save();

  await recordAudit({
    action: 'PASS_REVOKED',
    entityType: 'Pass',
    entityId: pass._id,
    req,
    organization: pass.organization,
    details: { passCode: pass.passCode, reason: pass.revokedReason },
  });

  res.json({ success: true, data: pass });
});
