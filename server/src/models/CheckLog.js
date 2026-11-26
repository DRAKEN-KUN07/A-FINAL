import mongoose from 'mongoose';

const checkLogSchema = new mongoose.Schema(
  {
    pass: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass', required: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    locationCode: { type: String, trim: true, uppercase: true, default: 'MAIN-GATE' },
    gate: { type: String, trim: true, default: 'Main Reception' },
    action: { type: String, enum: ['check_in', 'check_out'], required: true },
    scanMethod: {
      type: String,
      enum: ['qr_camera', 'qr_image', 'manual_code', 'quick_action'],
      default: 'manual_code',
    },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true, collection: 'CheckLogs' }
);

checkLogSchema.index({ organization: 1, timestamp: -1 });
checkLogSchema.index({ pass: 1, timestamp: -1 });

export const CheckLog = mongoose.model('CheckLog', checkLogSchema);
