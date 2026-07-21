import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyController from '../controllers/verifyController.js';

const router = express.Router();


// Configure Multer for memory storage (no files saved to disk)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Endpoint to extract details instantly from document for auto-fill
router.post('/extract', upload.single('idDocument'), verifyController.extract);

// Endpoint to upload ID and trigger verification for a specific guest
router.post('/:reservationId/:guestIndex', upload.single('idDocument'), verifyController.verifyGuest);

export default router;
