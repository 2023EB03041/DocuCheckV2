import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from './models/Room.js';

dotenv.config();

const rooms = [
  { roomNumber: '101', type: 'Standard', pricePerNight: 5000 },
  { roomNumber: '102', type: 'Standard', pricePerNight: 5000 },
  { roomNumber: '201', type: 'Deluxe', pricePerNight: 8000 },
  { roomNumber: '202', type: 'Deluxe', pricePerNight: 8000 },
  { roomNumber: '301', type: 'Ocean View', pricePerNight: 12000 },
  { roomNumber: '401', type: 'Presidential Suite', pricePerNight: 25000 }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Wipe old rooms just in case
    await Room.deleteMany({});
    
    await Room.insertMany(rooms);
    console.log('Seeded rooms successfully!');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
