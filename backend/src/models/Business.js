import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema({
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
  qbExpenseAccountId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
  },
  qbTaxCodeId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
  },
}, {
  timestamps: true,
});

businessSchema.index({ pin: 1 }, { unique: true });
businessSchema.index({ isActive: 1 });

export const Business = mongoose.model('Business', businessSchema);