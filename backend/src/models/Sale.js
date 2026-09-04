import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  vatRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  vatAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  cuin: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null,
  },
  qrCode: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null,
  },
  saleDate: {
    type: Date,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  vatAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  sellerName: {
    type: String,
    trim: true,
    maxlength: 255,
    default: null,
  },
  sellerPin: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null,
  },
  quickbooksId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null,
  },
  syncedAt: {
    type: Date,
    default: null,
  },
  lineItems: {
    type: [lineItemSchema],
    default: [],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'At least one line item is required',
    },
  },
  source: {
    type: String,
    required: true,
    enum: ['upload', 'pos'],
  },
  documentUploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentUpload',
    default: null,
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

saleSchema.index({ businessId: 1, saleDate: -1 });
saleSchema.index({ cuin: 1 });
saleSchema.index({ confirmedBy: 1 });
saleSchema.index({ confirmedAt: 1 });

export const Sale = mongoose.model('Sale', saleSchema);