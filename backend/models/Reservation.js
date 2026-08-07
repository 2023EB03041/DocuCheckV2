import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    required: true,
    unique: true,
  },
  guests: [{
    name: { type: String, required: true },
    age: { type: Number },
    sex: { type: String, enum: ['Male', 'Female', 'Other', ''] },
    // The type printed on the card that was confirmed, not one picked on a form.
    // Only these two have a record a card can be put to.
    idType: { type: String, enum: ['Aadhaar Card', 'PAN Card'], required: true },
    // A guest only reaches a reservation once their ID has been confirmed
    // against the issuing authority's record, so this has one value. It is kept
    // as a field because the confirmation and the staff screens read it, and
    // because a stay that somehow held anything else would be a bug worth
    // failing on rather than displaying.
    status: { type: String, enum: ['Verified'], default: 'Verified' },
    documentUrl: String,
    documentHash: String,
    verificationDetails: {
      extractedName: String,
      verificationTime: Date,
      remarks: String,
      // Kept for the staff record. Only a government-confirmed document can be
      // stored, so this says which record answered rather than how far we got.
      verificationLevel: { type: String, enum: ['government'], default: 'government' },
      governmentVerified: { type: Boolean, default: true }
    }
  }],
  // The address of the account the stay was booked from. A booking can only be
  // made by a signed-in guest, so this address has always answered a code sent
  // to it — there is no separate flag saying so, because there is no other case.
  email: String,
  phone: String,
  roomType: String,
  roomNumbers: [String],
  // The rate the stay was sold at and how many nights it covers, kept alongside
  // the total so a confirmation can be reproduced exactly as it was priced.
  pricePerNight: Number,
  nights: Number,
  totalPrice: Number,
  checkInDate: {
    type: Date,
    required: true,
  },
  checkOutDate: {
    type: Date,
    required: true,
  }
}, { timestamps: true });

export default mongoose.model('Reservation', reservationSchema);
