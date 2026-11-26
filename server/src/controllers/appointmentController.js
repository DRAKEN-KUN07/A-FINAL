import { Appointment } from '../models/Appointment.js';
import { Organization } from '../models/Organization.js';
import { Pass } from '../models/Pass.js';
import { User } from '../models/User.js';
import { Visitor } from '../models/Visitor.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';
import { generateAppointmentCode } from '../services/qrService.js';
import { issuePassRecord } from '../services/passService.js';
import { dispatchEventNotifications } from '../services/notificationService.js';
import { recordAudit } from '../services/auditService.js';

function resolveLocationName(organization, locationCode) {
  const match = organization?.locations?.find((l) => l.code === locationCode);
  return match ? `${match.name}${match.gateName ? ` - ${match.gateName}` : ''}` : 'Main Reception';
}

export const listAppointments = asyncHandler(async (req, res) => {
  const { status, type, search, organizationId, locationCode, from, to } = req.query;
  const filter = {};

  if (req.user.role === 'visitor') {
    const visitorIds = await Visitor.find({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).distinct('_id');
    filter.visitor = { $in: visitorIds };
  } else if (req.user.role === 'employee') {
    filter.$or = [{ host: req.user._id }, { createdBy: req.user._id }];
  } else {
    const orgId = resolveOrganizationScope(req, organizationId);
    if (orgId) filter.organization = orgId;
  }

  if (status && status !== 'all') filter.status = status;
  if (type && type !== 'all') filter.type = type;
  if (locationCode && locationCode !== 'all') filter.locationCode = locationCode.toUpperCase();
  if (from || to) {
    filter.scheduledDate = {};
    if (from) filter.scheduledDate.$gte = new Date(from);
    if (to) filter.scheduledDate.$lte = new Date(to);
  }

  let appointments = await Appointment.find(filter)
    .populate('visitor', 'fullName email phone company photoUrl otpVerified')
    .populate('host', 'name email department designation')
    .populate('organization', 'name code')
    .populate('approvedBy', 'name role')
    .sort({ scheduledDate: -1 })
    .limit(200);

  if (search) {
    const q = search.toLowerCase().trim();
    appointments = appointments.filter(
      (apt) =>
        apt.appointmentCode?.toLowerCase().includes(q) ||
        apt.purpose?.toLowerCase().includes(q) ||
        apt.visitor?.fullName?.toLowerCase().includes(q) ||
        apt.visitor?.company?.toLowerCase().includes(q) ||
        apt.host?.name?.toLowerCase().includes(q)
    );
  }

  const appointmentIds = appointments.map((a) => a._id);
  const passes = await Pass.find({ appointment: { $in: appointmentIds } }).select(
    '_id appointment passCode status validUntil'
  );
  const passByApt = new Map(passes.map((p) => [String(p.appointment), p]));

  const enriched = appointments.map((apt) => ({
    ...apt.toObject(),
    pass: passByApt.get(String(apt._id)) || null,
  }));

  res.json({ success: true, count: enriched.length, data: enriched });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const {
    visitorId,
    visitorDetails,
    hostId,
    organizationId,
    locationCode,
    purpose,
    scheduledDate,
    expectedDurationMinutes = 60,
    type,
    notes,
    autoIssuePass = true,
  } = req.body;

  if (!purpose || !scheduledDate) {
    throw new AppError(400, 'Purpose and scheduledDate are required.');
  }

  let resolvedOrgId =
    req.user.role === 'admin' && organizationId
      ? organizationId
      : req.user.organization?._id || req.user.organization;

  if (req.user.role === 'visitor' && organizationId) {
    resolvedOrgId = organizationId;
  }

  const organization = await Organization.findById(resolvedOrgId);
  if (!organization) {
    throw new AppError(404, 'Organization not found.');
  }

  // Resolve host
  let host = null;
  if (hostId) {
    host = await User.findById(hostId);
  } else if (req.user.role === 'employee' || req.user.role === 'admin') {
    host = req.user;
  }
  if (!host) {
    throw new AppError(400, 'A valid host employee is required.');
  }

  // Resolve or create visitor
  let visitor = null;
  if (visitorId) {
    visitor = await Visitor.findById(visitorId);
  } else if (visitorDetails?.fullName && visitorDetails?.email && visitorDetails?.phone) {
    visitor = await Visitor.findOne({
      email: visitorDetails.email.toLowerCase().trim(),
      organization: organization._id,
    });
    if (!visitor) {
      visitor = await Visitor.create({
        fullName: visitorDetails.fullName.trim(),
        email: visitorDetails.email.toLowerCase().trim(),
        phone: visitorDetails.phone.trim(),
        company: visitorDetails.company?.trim() || 'Independent',
        idType: visitorDetails.idType || 'National ID',
        idNumber: visitorDetails.idNumber?.trim() || '',
        purpose: purpose.trim(),
        organization: organization._id,
        createdBy: req.user._id,
        user: req.user.role === 'visitor' ? req.user._id : undefined,
      });
    }
  } else if (req.user.role === 'visitor') {
    visitor = await Visitor.findOne({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    });
  }

  if (!visitor) {
    throw new AppError(400, 'Visitor ID or full visitor details are required.');
  }
  if (visitor.isBlacklisted) {
    throw new AppError(403, 'Visitor is restricted and cannot schedule appointments.');
  }

  const resolvedType =
    type ||
    (req.user.role === 'employee' || req.user.role === 'admin' ? 'invite' : 'pre_registration');
  const isAutoApproved =
    resolvedType === 'invite' && (req.user.role === 'employee' || req.user.role === 'admin' || req.user.role === 'security');

  const locCode = (locationCode || organization.locations?.[0]?.code || 'MAIN-GATE').toUpperCase();
  const locationName = resolveLocationName(organization, locCode);

  const appointment = await Appointment.create({
    appointmentCode: generateAppointmentCode(),
    visitor: visitor._id,
    host: host._id,
    organization: organization._id,
    locationCode: locCode,
    locationName,
    purpose: purpose.trim(),
    scheduledDate: new Date(scheduledDate),
    expectedDurationMinutes: Number(expectedDurationMinutes) || 60,
    type: resolvedType,
    status: isAutoApproved ? 'approved' : 'pending',
    approvedBy: isAutoApproved ? req.user._id : undefined,
    approvedAt: isAutoApproved ? new Date() : undefined,
    otpVerified: Boolean(visitor.otpVerified),
    notes: notes?.trim() || '',
    createdBy: req.user._id,
  });

  let issuedPass = null;
  if (isAutoApproved) {
    await dispatchEventNotifications({
      eventType: 'APPOINTMENT_INVITE',
      visitor,
      host,
      appointment,
      organization,
    });
    if (autoIssuePass) {
      const start = new Date(appointment.scheduledDate);
      const validFrom = new Date(start.getTime() - 30 * 60 * 1000);
      const validUntil = new Date(start.getTime() + Math.max(appointment.expectedDurationMinutes, 120) * 60 * 1000);
      issuedPass = await issuePassRecord({
        visitor,
        appointment,
        host,
        organization,
        locationCode: locCode,
        locationName,
        purpose: appointment.purpose,
        validFrom,
        validUntil,
        issuedBy: req.user,
        req,
      });
    }
  } else {
    await dispatchEventNotifications({
      eventType: 'APPOINTMENT_PENDING',
      visitor,
      host,
      appointment,
      organization,
    });
  }

  await recordAudit({
    action: isAutoApproved ? 'APPOINTMENT_INVITED' : 'APPOINTMENT_PRE_REGISTERED',
    entityType: 'Appointment',
    entityId: appointment._id,
    req,
    organization: organization._id,
    details: { appointmentCode: appointment.appointmentCode, status: appointment.status },
  });

  const populated = await Appointment.findById(appointment._id)
    .populate('visitor', 'fullName email phone company photoUrl otpVerified')
    .populate('host', 'name email department designation')
    .populate('organization', 'name code');

  res.status(201).json({
    success: true,
    data: populated,
    pass: issuedPass,
  });
});

export const approveAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('visitor')
    .populate('host')
    .populate('organization');

  if (!appointment) {
    throw new AppError(404, 'Appointment not found.');
  }

  if (
    req.user.role === 'employee' &&
    String(appointment.host?._id) !== String(req.user._id)
  ) {
    throw new AppError(403, 'Employees can only approve appointments where they are the host.');
  }

  if (appointment.status === 'approved') {
    throw new AppError(400, 'Appointment is already approved.');
  }

  appointment.status = 'approved';
  appointment.approvedBy = req.user._id;
  appointment.approvedAt = new Date();
  await appointment.save();

  let pass = await Pass.findOne({ appointment: appointment._id });
  const shouldIssuePass = req.body.issuePass !== false;

  if (!pass && shouldIssuePass) {
    const start = new Date(appointment.scheduledDate);
    const validFrom = new Date(Math.min(Date.now(), start.getTime() - 30 * 60 * 1000));
    const validUntil = new Date(
      Math.max(start.getTime(), Date.now()) + Math.max(appointment.expectedDurationMinutes || 120, 240) * 60 * 1000
    );

    pass = await issuePassRecord({
      visitor: appointment.visitor,
      appointment,
      host: appointment.host,
      organization: appointment.organization,
      locationCode: appointment.locationCode,
      locationName: appointment.locationName,
      purpose: appointment.purpose,
      validFrom,
      validUntil,
      issuedBy: req.user,
      req,
    });
  }

  await dispatchEventNotifications({
    eventType: 'APPOINTMENT_APPROVED',
    visitor: appointment.visitor,
    host: appointment.host,
    appointment,
    pass,
    organization: appointment.organization,
  });

  await recordAudit({
    action: 'APPOINTMENT_APPROVED',
    entityType: 'Appointment',
    entityId: appointment._id,
    req,
    organization: appointment.organization?._id,
    details: { appointmentCode: appointment.appointmentCode, passCode: pass?.passCode },
  });

  res.json({ success: true, data: appointment, pass });
});

export const rejectAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('visitor')
    .populate('host')
    .populate('organization');

  if (!appointment) {
    throw new AppError(404, 'Appointment not found.');
  }

  if (
    req.user.role === 'employee' &&
    String(appointment.host?._id) !== String(req.user._id)
  ) {
    throw new AppError(403, 'Employees can only reject their own hosted appointments.');
  }

  appointment.status = 'rejected';
  appointment.rejectionReason = req.body.reason?.trim() || 'Unavailable at requested time';
  await appointment.save();

  await dispatchEventNotifications({
    eventType: 'APPOINTMENT_REJECTED',
    visitor: appointment.visitor,
    host: appointment.host,
    appointment,
    organization: appointment.organization,
  });

  await recordAudit({
    action: 'APPOINTMENT_REJECTED',
    entityType: 'Appointment',
    entityId: appointment._id,
    req,
    organization: appointment.organization?._id,
    details: { appointmentCode: appointment.appointmentCode, reason: appointment.rejectionReason },
  });

  res.json({ success: true, data: appointment });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new AppError(404, 'Appointment not found.');
  }

  appointment.status = 'cancelled';
  await appointment.save();

  await recordAudit({
    action: 'APPOINTMENT_CANCELLED',
    entityType: 'Appointment',
    entityId: appointment._id,
    req,
    organization: appointment.organization,
  });

  res.json({ success: true, data: appointment });
});
