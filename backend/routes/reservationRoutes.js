import express from 'express';
import reservationController from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireVerifiedEmail from '../middleware/requireVerifiedEmail.js';

const router = express.Router();

// Public: guests browse rooms, create a booking, and fetch their own
// confirmation via the unguessable booking ID (capability URL).
// Booking additionally requires the email on it to have been confirmed, since
// the confirmation and everything after it is sent to that address.
router.get('/rooms', reservationController.getRooms);
router.post('/', requireVerifiedEmail, reservationController.createReservation);

// Staff-only: listing reservations exposes all guests' personal data.
// Both must be declared before '/:id' so they are not swallowed by it.
router.get('/records', authMiddleware, reservationController.getReservationRecords);
router.get('/', authMiddleware, reservationController.getReservations);

router.get('/:id', reservationController.getReservationById);

export default router;
