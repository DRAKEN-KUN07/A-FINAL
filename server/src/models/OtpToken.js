import mongoose from 'mongoose';

const otpTokenSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, trim: true, lowercase: true },
    channel: { type: String, enum: ['email', 'sms'], default: 'email' },
    purpose: {
      type: String,
      enum: ['visitor_verify', 'pass_checkin', 'registration'],
      default: 'visitor_verify',
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor' },
  },
  { timestamps: true, collection: 'OtpTokens' }
);

otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpTokenSchema.index({ identifier: 1, purpose: 1, createdAt: -1 });

export const OtpToken = mongoose.model('OtpToken', otpTokenSchema);
