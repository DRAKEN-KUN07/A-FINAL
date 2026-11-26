import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['admin', 'security', 'employee', 'visitor'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: USER_ROLES, default: 'visitor' },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    locationCode: { type: String, trim: true, uppercase: true, default: 'MAIN-GATE' },
    isVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    avatarUrl: { type: String, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'Users' }
);

userSchema.index({ organization: 1, role: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model('User', userSchema);
