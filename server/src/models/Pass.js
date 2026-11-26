import mongoose from 'mongoose';

const passSchema = new mongoose.Schema(
  {
    passCode: { type: String, required: true, unique: true, trim: true },
    qrToken: { type: String, required: true, unique: true },
    qrDataUrl: { type: String, required: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    locationCode: { type: String, trim: true, uppercase: true, default: 'MAIN-GATE' },
    locationName: { type: String, trim: true, default: 'Main Reception' },
    purpose: { type: String, trim: true, default: 'Scheduled Visit' },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'checked_in', 'checked_out', 'expired', 'revoked'],
      default: 'active',
    },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    checkInCount: { type: Number, default: 0 },
    lastCheckInAt: { type: Date },
    lastCheckOutAt: { type: Date },
    revokedReason: { type: String, trim: true, default: '' },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'Passes' }
);

passSchema.index({ organization: 1, status: 1 });
passSchema.index({ visitor: 1, createdAt: -1 });

export const Pass = mongoose.model('Pass', passSchema);
