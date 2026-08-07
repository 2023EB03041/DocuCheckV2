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

// A document is checked once, here, before any booking exists. There is no
// second endpoint that attaches an ID to a reservation after the fact — a stay
// is created already carrying its confirmed documents, or not at all.
//
// Open only to a signed-in guest, and that check runs before multer, so a
// request without a session is turned away without its upload being read into
// memory.
router.post('/', requireGuest, upload.single('idDocument'), verifyController.verify);

export default router;
