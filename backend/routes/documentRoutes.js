import express from 'express';
import documentController from '../controllers/documentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Get document by ID. Requires authentication token.
router.get('/:id', authMiddleware, documentController.getDocument);

export default router;
