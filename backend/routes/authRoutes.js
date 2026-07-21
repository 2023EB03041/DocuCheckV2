import express from 'express';
import authController from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authorize from '../middleware/authorize.js';

const router = express.Router();

router.post('/login', authController.login);
// Only an authenticated Superuser may create staff accounts.
router.post('/register', authMiddleware, authorize('Superuser'), authController.register);

export default router;
