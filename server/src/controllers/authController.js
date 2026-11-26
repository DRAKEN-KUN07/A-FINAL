import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Visitor } from '../models/Visitor.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { signJwt } from '../middleware/auth.js';
import { issueOtp, verifyOtp } from '../services/otpService.js';
import { recordAudit } from '../services/auditService.js';

export const getPublicDirectory = asyncHandler(async (_req, res) => {
  const organizations = await Organization.find({ isActive: true })
    .select('name code industry address locations requireOtpForCheckIn')
    .sort({ name: 1 });

  const hosts = await User.find({
    role: { $in: ['employee', 'admin'] },
    isActive: true,
  })
    .select('name email department designation organization locationCode')
    .sort({ name: 1 });

  res.json({
    success: true,
    data: { organizations, hosts },
  });
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, company, idType, idNumber, organizationId, locationCode } = req.body;

  if (!name || !email || !password) {
    throw new AppError(400, 'Name, email, and password are required.');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  let organization = null;
  if (organizationId) {
    organization = await Organization.findById(organizationId);
  }
  if (!organization) {
    organization = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  }
  if (!organization) {
    throw new AppError(400, 'No active organization configured in the system.');
  }

  const resolvedLocation =
    locationCode || organization.locations?.[0]?.code || 'MAIN-GATE';

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone: phone?.trim() || '',
    role: 'visitor',
    organization: organization._id,
    locationCode: resolvedLocation,
  });

  const visitor = await Visitor.create({
    fullName: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || 'Not provided',
    company: company?.trim() || 'Independent',
    idType: idType || 'National ID',
    idNumber: idNumber?.trim() || '',
    user: user._id,
    organization: organization._id,
    createdBy: user._id,
  });

  await recordAudit({
    action: 'VISITOR_ACCOUNT_REGISTERED',
    entityType: 'User',
    entityId: user._id,
    req,
    user,
    organization: organization._id,
    details: { email: user.email, visitorId: visitor._id },
  });

  const populatedUser = await User.findById(user._id).populate(
    'organization',
    'name code locations requireOtpForCheckIn'
  );

  const token = signJwt(populatedUser);

  res.status(201).json({
    success: true,
    token,
    user: populatedUser.toSafeJSON(),
    visitor,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+password')
    .populate('organization', 'name code locations requireOtpForCheckIn');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new AppError(403, 'This account has been deactivated. Contact your administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signJwt(user);

  await recordAudit({
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id,
    req,
    user,
    organization: user.organization?._id,
    details: { role: user.role },
  });

  res.json({
    success: true,
    token,
    user: user.toSafeJSON(),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  let visitor = null;
  if (req.user.role === 'visitor') {
    visitor = await Visitor.findOne({
      $or: [{ user: req.user._id }, { email: req.user.email }],
    }).sort({ createdAt: -1 });
  }

  res.json({
    success: true,
    user: req.user.toSafeJSON(),
    visitor,
  });
});

export const requestOtp = asyncHandler(async (req, res) => {
  const { identifier, channel = 'email', purpose = 'visitor_verify', visitorId, organizationId } = req.body;
  const result = await issueOtp({ identifier, channel, purpose, visitorId, organizationId });

  res.json({
    success: true,
    message: `OTP sent via ${result.channel}.`,
    data: result,
  });
});

export const verifyOtpCode = asyncHandler(async (req, res) => {
  const { identifier, code, purpose = 'visitor_verify' } = req.body;
  const result = await verifyOtp({ identifier, code, purpose });

  await recordAudit({
    action: 'OTP_VERIFIED',
    entityType: 'OtpToken',
    req,
    details: { identifier: result.identifier, purpose },
  });

  res.json({
    success: true,
    message: 'OTP verified successfully.',
    data: result,
  });
});
