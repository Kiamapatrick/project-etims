import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  documentUploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentUpload',
    required: true,
  },
  fileIndex: {
    type: Number,
    required: true,
    min: 0,
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['edited', 'confirmed', 'rejected'],
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

auditLogSchema.index({ documentUploadId: 1, fileIndex: 1, timestamp: -1 });
auditLogSchema.index({ saleId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

auditLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);