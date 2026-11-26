import { Visitor } from '../models/Visitor.js';
import { Appointment } from '../models/Appointment.js';
import { Pass } from '../models/Pass.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';

export const listVisitors = asyncHandler(async (req, res) => {
  const { search, company, otpVerified, organizationId } = req.query;
  const filter = {};

  if (req.user.role === 'visitor') {
    filter.$or = [{ user: req.user._id }, { email: req.user.email }];
  } else {
    const orgId = resolveOrganizationScope(req, organizationId);
    if (orgId) filter.organization = orgId;
  }

  if (company) {
    filter.company = new RegExp(company.trim(), 'i');
  }
  if (otpVerified === 'true' || otpVerified === 'false') {
    filter.otpVerified = otpVerified === 'true';
  }
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { fullName: regex },
          { email: regex },
          { phone: regex },
          { company: regex },
          { idNumber: regex },
        ],
      },
    ];
  }

  const visitors = await Visitor.find(filter)
    .populate('organization', 'name code')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json({ success: true, count: visitors.length, data: visitors });
});

export const getVisitorById = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id).populate('organization', 'name code');
  if (!visitor) {
    throw new AppError(404, 'Visitor not found.');
  }

  if (
    req.user.role === 'visitor' &&
    String(visitor.user) !== String(req.user._id) &&
    visitor.email !== req.user.email
  ) {
    throw new AppError(403, 'You can only view your own visitor profile.');
  }

  const [appointments, passes] = await Promise.all([
    Appointment.find({ visitor: visitor._id })
      .populate('host', 'name department')
      .sort({ scheduledDate: -1 })
      .limit(10),
    Pass.find({ visitor: visitor._id }).sort({ createdAt: -1 }).limit(10),
  ]);

  res.json({
    success: true,
    data: { visitor, appointments, passes },
  });
});

export const createVisitor = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    company,
    idType,
    idNumber,
    purpose,
    vehicleNumber,
    notes,
    organizationId,
  } = req.body;

  if (!fullName || !email || !phone) {
    throw new AppError(400, 'Visitor fullName, email, and phone are required.');
  }

  const orgId =
    req.user.role === 'admin' && organizationId
      ? organizationId
      : req.user.organization?._id || req.user.organization;

  const photoUrl = req.file ? `/uploads/visitors/${req.file.filename}` : req.body.photoUrl || '';

  const visitor = await Visitor.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    company: company?.trim() || 'Independent',
    idType: idType || 'National ID',
    idNumber: idNumber?.trim() || '',
    photoUrl,
    purpose: purpose?.trim() || '',
    vehicleNumber: vehicleNumber?.trim() || '',
    notes: notes?.trim() || '',
    organization: orgId,
    createdBy: req.user._id,
    user: req.user.role === 'visitor' ? req.user._id : undefined,
  });

  await recordAudit({
    action: 'VISITOR_REGISTERED',
    entityType: 'Visitor',
    entityId: visitor._id,
    req,
    organization: orgId,
    details: { fullName: visitor.fullName, company: visitor.company, hasPhoto: Boolean(photoUrl) },
  });

  const populated = await Visitor.findById(visitor._id).populate('organization', 'name code');
  res.status(201).json({ success: true, data: populated });
});

export const updateVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) {
    throw new AppError(404, 'Visitor not found.');
  }

  if (
    req.user.role === 'visitor' &&
    String(visitor.user) !== String(req.user._id) &&
    visitor.email !== req.user.email
  ) {
    throw new AppError(403, 'Not authorized to update this visitor.');
  }

  const updatable = ['fullName', 'email', 'phone', 'company', 'idType', 'idNumber', 'purpose', 'vehicleNumber', 'notes'];
  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      visitor[field] = req.body[field];
    }
  }
  if (req.file) {
    visitor.photoUrl = `/uploads/visitors/${req.file.filename}`;
  }

  await visitor.save();

  await recordAudit({
    action: 'VISITOR_UPDATED',
    entityType: 'Visitor',
    entityId: visitor._id,
    req,
    organization: visitor.organization,
    details: { fullName: visitor.fullName },
  });

  const populated = await Visitor.findById(visitor._id).populate('organization', 'name code');
  res.json({ success: true, data: populated });
});

export const toggleVisitorBlacklist = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) {
    throw new AppError(404, 'Visitor not found.');
  }

  visitor.isBlacklisted = Boolean(req.body.isBlacklisted ?? !visitor.isBlacklisted);
  await visitor.save();

  await recordAudit({
    action: visitor.isBlacklisted ? 'VISITOR_BLACKLISTED' : 'VISITOR_UNBLACKLISTED',
    entityType: 'Visitor',
    entityId: visitor._id,
    req,
    organization: visitor.organization,
    details: { fullName: visitor.fullName, isBlacklisted: visitor.isBlacklisted },
  });

  res.json({ success: true, data: visitor });
});
