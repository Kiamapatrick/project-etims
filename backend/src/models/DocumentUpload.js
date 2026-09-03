import mongoose from 'mongoose';

const uploadFileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  storedName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  s3Key: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'extracted', 'needs_review', 'confirmed', 'failed'],
    default: 'pending',
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: null,
  },
  errorMessage: {
    type: String,
    default: null,
  },
}, { _id: false });

const documentUploadSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  batchId: {
    type: String,
    required: true,
    trim: true,
  },
  files: {
    type: [uploadFileSchema],
    default: [],
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'partial', 'failed'],
    default: 'pending',
  },
  totalFiles: {
    type: Number,
    required: true,
    min: 1,
  },
  processedFiles: {
    type: Number,
    default: 0,
  },
  s3Keys: {
    type: [String],
    default: [],
  },
  processingStartedAt: {
    type: Date,
    default: null,
  },
  processingCompletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

documentUploadSchema.index({ businessId: 1, createdAt: -1 });
documentUploadSchema.index({ uploadedBy: 1, createdAt: -1 });
documentUploadSchema.index({ batchId: 1 });
documentUploadSchema.index({ status: 1 });

export const DocumentUpload = mongoose.model('DocumentUpload', documentUploadSchema);