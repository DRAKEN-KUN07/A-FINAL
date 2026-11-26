import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    appointmentCode: { type: String, required: true, unique: true, trim: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    locationCode: { type: String, trim: true, uppercase: true, default: 'MAIN-GATE' },
    locationName: { type: String, trim: true, default: 'Main Reception' },
    purpose: { type: String, required: true, trim: true },
    scheduledDate: { type: Date, required: true },
    expectedDurationMinutes: { type: Number, default: 60, min: 15, max: 1440 },
    type: {
      type: String,
      enum: ['invite', 'pre_registration', 'walk_in'],
      default: 'pre_registration',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true, default: '' },
    otpVerified: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'Appointments' }
);

appointmentSchema.index({ organization: 1, status: 1, scheduledDate: 1 });
appointmentSchema.index({ host: 1, scheduledDate: -1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
