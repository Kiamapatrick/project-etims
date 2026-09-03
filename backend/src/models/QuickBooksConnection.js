import mongoose from 'mongoose';

const quickBooksConnectionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
  },
  realmId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  accessTokenEncrypted: {
    type: String,
    required: true,
  },
  refreshTokenEncrypted: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  },
  syncStatus: {
    type: String,
    enum: ['connected', 'expired', 'error', 'disconnected'],
    default: 'connected',
  },
  errorMessage: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

quickBooksConnectionSchema.index({ businessId: 1 }, { unique: true });
quickBooksConnectionSchema.index({ realmId: 1 });
quickBooksConnectionSchema.index({ syncStatus: 1 });

export const QuickBooksConnection = mongoose.model('QuickBooksConnection', quickBooksConnectionSchema);