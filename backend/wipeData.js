import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reservation from './models/Reservation.js';
import IdDocument from './models/IdDocument.js';
import Room from './models/Room.js';

dotenv.config();

async function clearData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    await Reservation.deleteMany({});
    console.log('Cleared all reservations');
    
    await IdDocument.deleteMany({});
    console.log('Cleared all ID documents');
    
    // Also reset room status back to available
    await Room.updateMany({}, { status: 'Available' });
    console.log('Reset all rooms to Available');
    
    console.log('Database successfully wiped!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearData();
