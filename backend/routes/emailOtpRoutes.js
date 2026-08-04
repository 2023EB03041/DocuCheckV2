import express from 'express';
import emailOtpController from '../controllers/emailOtpController.js';

const router = express.Router();

// Send a one-time code to the address the guest entered.
router.post('/send', emailOtpController.sendCode);

// Check the code and return proof the address was confirmed.
router.post('/confirm', emailOtpController.confirmCode);

export default router;
