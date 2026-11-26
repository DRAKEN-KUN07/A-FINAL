import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from './errorHandler.js';

export function signJwt(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      organization: user.organization?._id?.toString() || user.organization?.toString(),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    throw new AppError(401, 'Authentication required. Please provide a valid Bearer token.');
  }

  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.id).populate('organization', 'name code locations requireOtpForCheckIn');

  if (!user || !user.isActive) {
    throw new AppError(401, 'User account not found or deactivated.');
  }

  req.user = user;
  next();
});

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(403, `Access denied for role '${req.user.role}'. Required: ${allowedRoles.join(', ')}`)
      );
    }
    return next();
  };
}

/**
 * Resolve organization filter safely: Admins may view all organizations or pick ?organizationId=...;
 * non-admins are always scoped to their own assigned organization.
 */
export function resolveOrganizationScope(req, explicitOrgId) {
  if (req.user.role === 'admin') {
    if (explicitOrgId && explicitOrgId !== 'all') {
      return explicitOrgId;
    }
    return null;
  }
  return req.user.organization?._id || req.user.organization;
}
