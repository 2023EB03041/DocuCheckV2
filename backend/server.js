import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import reservationRoutes from './routes/reservationRoutes.js';
import verifyRoutes from './routes/verifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined. Set it in the environment before starting.');
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight health check (public, no DB) for the hosting platform.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/reservations', reservationRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

import Room from './models/Room.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';

// Database Connection
const PORT = process.env.PORT || 5000;

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    if (!uri) {
      console.error('FATAL ERROR: MONGO_URI is not defined in .env file.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');
    
    // Seed / top-up room inventory (idempotent: adds only missing rooms, so it
    // grows an already-seeded DB without touching existing rooms/bookings).
    const pad = (n) => String(n).padStart(2, '0');
    const desiredRooms = [];
    for (let i = 1; i <= 12; i++) desiredRooms.push({ roomNumber: `1${pad(i)}`, type: 'Standard', pricePerNight: 12000 });
    for (let i = 1; i <= 10; i++) desiredRooms.push({ roomNumber: `2${pad(i)}`, type: 'Deluxe', pricePerNight: 18000 });
    for (let i = 1; i <= 8; i++)  desiredRooms.push({ roomNumber: `3${pad(i)}`, type: 'Ocean View', pricePerNight: 28000 });
    for (let i = 1; i <= 6; i++)  desiredRooms.push({ roomNumber: `4${pad(i)}`, type: 'Presidential Suite', pricePerNight: 75000 });

    await Room.bulkWrite(desiredRooms.map((r) => ({
      updateOne: {
        filter: { roomNumber: r.roomNumber },
        update: { $setOnInsert: { ...r, status: 'Available' } },
        upsert: true,
      },
    })));
    console.log(`Room inventory ensured: ${desiredRooms.length} rooms.`);

    // Seed default Superuser for PMS Demo
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Seeding default Superuser...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      await User.create({
        name: 'System Admin',
        email: 'admin@lumina.com',
        phone: '9999999999',
        username: 'admin',
        password: hashedPassword,
        role: 'Superuser'
      });
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
  }
};

connectDB();
