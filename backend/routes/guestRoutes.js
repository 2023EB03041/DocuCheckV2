import express from 'express';
import guestController from '../controllers/guestController.js';
import requireGuest from '../middleware/requireGuest.js';

const router = express.Router();

// Signing in is a two-step exchange with a code emailed to the address. This is
// also where an address is verified, so a guest who reaches the booking form is
// already known to be reachable at the address their confirmation will go to.
router.post('/login/request', guestController.requestLoginCode);
router.post('/login/verify', guestController.confirmLoginCode);

// The guest's own account: who they are signed in as, and their stays.
router.get('/session', requireGuest, guestController.getSession);
router.get('/reservations', requireGuest, guestController.getMyReservations);

export default router;
