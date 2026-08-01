import express from 'express';
import reservationController from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: guests browse rooms, create a booking, and fetch their own
// confirmation via the unguessable booking ID (capability URL).
router.get('/rooms', reservationController.getRooms);
router.post('/', reservationController.createReservation);

// Staff-only: listing reservations exposes all guests' personal data.
// Both must be declared before '/:id' so they are not swallowed by it.
router.get('/records', authMiddleware, reservationController.getReservationRecords);
router.get('/', authMiddleware, reservationController.getReservations);

router.get('/:id', reservationController.getReservationById);

export default router;
