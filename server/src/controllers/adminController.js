import { AuditLog } from '../models/AuditLog.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { Organization } from '../models/Organization.js';
import { User, USER_ROLES } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { resolveOrganizationScope } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';

export const listHosts = asyncHandler(async (req, res) => {
  const filter = { role: { $in: ['employee', 'admin'] }, isActive: true };
  if (req.user.role !== 'admin') {
    filter.organization = req.user.organization?._id || req.user.organization;
  } else if (req.query.organizationId && req.query.organizationId !== 'all') {
    filter.organization = req.query.organizationId;
  }

  const hosts = await User.find(filter)
    .select('name email department designation role organization locationCode')
    .populate('organization', 'name code')
    .sort({ name: 1 });

  res.json({ success: true, data: hosts });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { role, search, organizationId } = req.query;
  const filter = {};

  if (organizationId && organizationId !== 'all') filter.organization = organizationId;
  if (role && role !== 'all') filter.role = role;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { department: regex }];
  }

  const users = await User.find(filter)
    .populate('organization', 'name code')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: users.length, data: users });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'employee', department, designation, organizationId, locationCode } =
    req.body;

  if (!name || !email || !password) {
    throw new AppError(400, 'Name, email, and password are required.');
  }
  if (!USER_ROLES.includes(role)) {
    throw new AppError(400, `Role must be one of: ${USER_ROLES.join(', ')}`);
  }

  const orgId = organizationId || req.user.organization?._id || req.user.organization;
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone: phone?.trim() || '',
    role,
    department: department?.trim() || '',
    designation: designation?.trim() || '',
    organization: orgId,
    locationCode: (locationCode || 'MAIN-GATE').toUpperCase(),
  });

  await recordAudit({
    action: 'STAFF_USER_CREATED',
    entityType: 'User',
    entityId: user._id,
    req,
    organization: orgId,
    details: { email: user.email, role: user.role },
  });

  const populated = await User.findById(user._id).populate('organization', 'name code');
  res.status(201).json({ success: true, data: populated.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  const fields = ['name', 'phone', 'role', 'department', 'designation', 'isActive', 'locationCode', 'organization'];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      user[f] = f === 'organization' ? req.body[f] : req.body[f];
    }
  }
  await user.save();

  await recordAudit({
    action: 'STAFF_USER_UPDATED',
    entityType: 'User',
    entityId: user._id,
    req,
    organization: user.organization,
    details: { role: user.role, isActive: user.isActive },
  });

  const populated = await User.findById(user._id).populate('organization', 'name code');
  res.json({ success: true, data: populated.toSafeJSON() });
});

export const listOrganizations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') {
    filter._id = req.user.organization?._id || req.user.organization;
  }
  const orgs = await Organization.find(filter).sort({ name: 1 });
  res.json({ success: true, data: orgs });
});

export const createOrganization = asyncHandler(async (req, res) => {
  const { name, code, industry, address, contactEmail, contactPhone, requireOtpForCheckIn, locations } = req.body;
  if (!name || !code) {
    throw new AppError(400, 'Organization name and unique code are required.');
  }

  const org = await Organization.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    industry: industry?.trim() || 'Technology',
    address: address?.trim() || '',
    contactEmail: contactEmail?.trim() || '',
    contactPhone: contactPhone?.trim() || '',
    requireOtpForCheckIn: Boolean(requireOtpForCheckIn),
    locations: Array.isArray(locations) && locations.length ? locations : undefined,
  });

  await recordAudit({
    action: 'ORGANIZATION_CREATED',
    entityType: 'Organization',
    entityId: org._id,
    req,
    organization: org._id,
    details: { name: org.name, code: org.code },
  });

  res.status(201).json({ success: true, data: org });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new AppError(404, 'Organization not found.');

  const fields = ['name', 'industry', 'address', 'contactEmail', 'contactPhone', 'requireOtpForCheckIn', 'isActive'];
  for (const f of fields) {
    if (req.body[f] !== undefined) org[f] = req.body[f];
  }
  await org.save();

  res.json({ success: true, data: org });
});

export const addOrganizationLocation = asyncHandler(async (req, res) => {
  const { name, code, building, gateName } = req.body;
  if (!name || !code) {
    throw new AppError(400, 'Location name and code are required.');
  }

  const org = await Organization.findById(req.params.id);
  if (!org) throw new AppError(404, 'Organization not found.');

  const normalizedCode = code.trim().toUpperCase();
  if (org.locations.some((l) => l.code === normalizedCode)) {
    throw new AppError(409, `Location code ${normalizedCode} already exists in this organization.`);
  }

  org.locations.push({
    name: name.trim(),
    code: normalizedCode,
    building: building?.trim() || '',
    gateName: gateName?.trim() || 'Security Gate',
    active: true,
  });
  await org.save();

  await recordAudit({
    action: 'LOCATION_ADDED',
    entityType: 'Organization',
    entityId: org._id,
    req,
    organization: org._id,
    details: { locationCode: normalizedCode, name },
  });

  res.status(201).json({ success: true, data: org });
});

export const listNotificationLogs = asyncHandler(async (req, res) => {
  const filter = {};
  const orgId = resolveOrganizationScope(req, req.query.organizationId);
  if (orgId) filter.organization = orgId;
  if (req.query.channel && req.query.channel !== 'all') filter.channel = req.query.channel;

  const logs = await NotificationLog.find(filter)
    .populate('organization', 'name code')
    .sort({ createdAt: -1 })
    .limit(120);

  res.json({ success: true, count: logs.length, data: logs });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.organizationId && req.query.organizationId !== 'all') {
    filter.organization = req.query.organizationId;
  }

  const logs = await AuditLog.find(filter)
    .populate('organization', 'name code')
    .sort({ createdAt: -1 })
    .limit(150);

  res.json({ success: true, count: logs.length, data: logs });
});
