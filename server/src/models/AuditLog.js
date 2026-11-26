import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, default: 'System' },
    actorRole: { type: String, default: 'system' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true, collection: 'AuditLogs' }
);

auditLogSchema.index({ organization: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
