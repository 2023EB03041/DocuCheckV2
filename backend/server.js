import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import reservationRoutes from './routes/reservationRoutes.js';
import verifyRoutes from './routes/verifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import emailOtpRoutes from './routes/emailOtpRoutes.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined. Set it in the environment before starting.');
  process.exit(1);
}

const app = express();

// Sites a browser may call this API from. The hosted front end and the local
// dev server are allowed by default so the app works without extra setup;
// CORS_ORIGINS replaces the list with its own comma separated entries.
const DEFAULT_ORIGINS = [
  'https://docucheckv2.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(entry => entry.trim())
  .filter(Boolean);

const originAllowList = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;

// Middleware
app.use(cors({
  // A request with no origin is not coming from a browser page — the platform
  // health check and server to server calls — so it is left alone. Anything
  // else is answered without the header a browser needs, which blocks it.
  origin: (origin, callback) => callback(null, !origin || originAllowList.includes(origin)),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight health check (public, no DB) for the hosting platform.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/reservations', reservationRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/email-verification', emailOtpRoutes);

import Room from './models/Room.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import { buildRoomInventory } from './config/roomPricing.js';

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
    // grows an already-seeded DB without touching existing bookings).
    // The tier and its rate are set on every run, not only on insert, so rooms
    // seeded against an older rate card are brought back in line and every room
    // of a tier is priced the same.
    const desiredRooms = buildRoomInventory();

    await Room.bulkWrite(desiredRooms.map((r) => ({
      updateOne: {
        filter: { roomNumber: r.roomNumber },
        update: {
          $set: { type: r.type, pricePerNight: r.pricePerNight },
          $setOnInsert: { status: 'Available' }
        },
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
