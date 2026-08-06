import express from 'express';
import multer from 'multer';
import verifyController from '../controllers/verifyController.js';
import requireGuest from '../middleware/requireGuest.js';

const router = express.Router();


// Configure Multer for memory storage (no files saved to disk)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Both endpoints take an identity document, so they are open only to a signed-in
// guest. That check runs before multer, so a request without a session is turned
// away without its upload being read into memory.

// Endpoint to extract details instantly from document for auto-fill
router.post('/extract', requireGuest, upload.single('idDocument'), verifyController.extract);

// Endpoint to upload ID and trigger verification for a specific guest
router.post('/:reservationId/:guestIndex', requireGuest, upload.single('idDocument'), verifyController.verifyGuest);

export default router;
