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
    idType: { type: String, enum: ['Aadhaar Card', 'Driving License', 'PAN Card', 'None'], default: 'None' },
    status: { type: String, enum: ['Pending', 'Verified', 'Failed'], default: 'Pending' },
    documentUrl: String,
    documentHash: String,
    verificationDetails: {
      extractedName: String,
      confidenceScore: Number,
      verificationTime: Date,
      remarks: String
    }
  }],
  email: String,
  phone: String,
  roomType: String,
  roomNumbers: [String],
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
