import mongoose from 'mongoose';

const receiptFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'select', 'textarea'],
  },
  required: {
    type: Boolean,
    default: false,
  },
  options: {
    type: [String],
    default: [],
  },
  validation: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { _id: false });

const receiptConfigSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
  },
  fields: {
    type: [receiptFieldSchema],
    default: [],
  },
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

receiptConfigSchema.index({ businessId: 1 }, { unique: true });

export const ReceiptConfig = mongoose.model('ReceiptConfig', receiptConfigSchema);