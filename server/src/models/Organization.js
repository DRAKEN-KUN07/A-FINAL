import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    building: { type: String, trim: true, default: '' },
    gateName: { type: String, trim: true, default: 'Main Gate' },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, unique: true, uppercase: true },
    industry: { type: String, trim: true, default: 'Technology' },
    address: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    requireOtpForCheckIn: { type: Boolean, default: false },
    locations: {
      type: [locationSchema],
      default: [{ name: 'Main Campus', code: 'MAIN-GATE', building: 'Tower A', gateName: 'Main Reception', active: true }],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'Organizations' }
);

export const Organization = mongoose.model('Organization', organizationSchema);
