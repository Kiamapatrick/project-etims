import mongoose from 'mongoose';

const oAuthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, {
  timestamps: true,
});

export const OAuthState = mongoose.model('OAuthState', oAuthStateSchema);