import { AuditLog } from '../models/AuditLog.js';

export async function recordAudit({
  action,
  entityType,
  entityId = '',
  req = null,
  user = null,
  organization = null,
  details = {},
}) {
  try {
    const actor = user || req?.user;
    await AuditLog.create({
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      actor: actor?._id || undefined,
      actorName: actor?.name || 'System',
      actorRole: actor?.role || 'system',
      organization: organization?._id || organization || actor?.organization?._id || actor?.organization || undefined,
      details,
      ipAddress: req?.ip || '',
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[AuditLog] Failed to persist audit entry:', err.message);
    }
  }
}
