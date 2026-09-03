import mongoose from 'mongoose';

const firmBusinessAccessSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingFirm',
    required: true,
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  grantedAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

firmBusinessAccessSchema.index(
  { firmId: 1, businessId: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);
firmBusinessAccessSchema.index({ firmId: 1 });
firmBusinessAccessSchema.index({ businessId: 1 });
firmBusinessAccessSchema.index({ revokedAt: 1 });

export const FirmBusinessAccess = mongoose.model('FirmBusinessAccess', firmBusinessAccessSchema);