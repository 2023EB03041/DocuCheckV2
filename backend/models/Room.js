import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['Standard', 'Deluxe', 'Ocean View', 'Presidential Suite'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Cleaning', 'Maintenance'],
    default: 'Available',
  },
  currentReservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null
  },
  pricePerNight: {
    type: Number,
    required: true,
  },
  amenities: [String],
  image: String
}, { timestamps: true });

export default mongoose.model('Room', roomSchema);
