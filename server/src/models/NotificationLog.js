import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'sms'], required: true },
    recipient: { type: String, required: true, trim: true },
    subject: { type: String, trim: true, default: '' },
    message: { type: String, required: true },
    eventType: { type: String, required: true, trim: true },
    status: { type: String, enum: ['sent', 'simulated', 'failed'], default: 'simulated' },
    provider: { type: String, default: 'simulated' },
    errorMessage: { type: String, default: '' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    relatedPass: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass' },
    relatedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  },
  { timestamps: true, collection: 'NotificationLogs' }
);

notificationLogSchema.index({ organization: 1, createdAt: -1 });

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
