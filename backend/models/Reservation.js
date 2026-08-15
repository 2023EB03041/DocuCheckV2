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
    idType: { type: String, enum: ['Aadhaar Card', 'PAN Card'], required: true },
    status: { type: String, enum: ['Verified'], default: 'Verified' },
    documentUrl: String,
    documentHash: String,
    verificationDetails: {
      extractedName: String,
      verificationTime: Date,
      remarks: String,
      verificationLevel: { type: String, enum: ['government'], default: 'government' },
      governmentVerified: { type: Boolean, default: true }
    }
  }],
  email: String,
  phone: String,
  roomType: String,
  roomNumbers: [String],
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
