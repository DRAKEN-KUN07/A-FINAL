import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, trim: true, default: 'Independent' },
    idType: {
      type: String,
      enum: ['National ID', 'Passport', 'Driver License', 'Employee Badge', 'Other'],
      default: 'National ID',
    },
    idNumber: { type: String, trim: true, default: '' },
    photoUrl: { type: String, default: '' },
    purpose: { type: String, trim: true, default: '' },
    vehicleNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    otpVerified: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isBlacklisted: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'Visitors' }
);

visitorSchema.index({ organization: 1, email: 1 });
visitorSchema.index({ fullName: 'text', email: 'text', company: 'text', phone: 'text' });

export const Visitor = mongoose.model('Visitor', visitorSchema);
