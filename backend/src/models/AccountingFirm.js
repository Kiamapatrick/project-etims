import mongoose from 'mongoose';

const accountingFirmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  pin: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 20,
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 255,
  },
  contactPhone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

accountingFirmSchema.index({ pin: 1 }, { unique: true });
accountingFirmSchema.index({ isActive: 1 });

export const AccountingFirm = mongoose.model('AccountingFirm', accountingFirmSchema);