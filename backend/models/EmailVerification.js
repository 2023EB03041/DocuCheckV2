import mongoose from 'mongoose';

// One record per email address being verified. The code itself is never stored,
// only a keyed hash of it, so a leaked database cannot be used to complete a
// verification. Records clear themselves out once they are no longer useful.
const emailVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Cleared once the code has been used, so the same one cannot be replayed.
  codeHash: {
    type: String,
    default: ''
  },
  expiresAt: {
    type: Date,
    required: true
  },
  // Wrong guesses against the current code. Counted so the code cannot simply
  // be tried a million times before it expires.
  attempts: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  purgeAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    expires: 0
  }
}, { timestamps: true });

export default mongoose.model('EmailVerification', emailVerificationSchema);
