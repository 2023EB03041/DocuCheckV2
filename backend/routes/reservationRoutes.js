import express from 'express';
import reservationController from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: guests browse rooms, create a booking, and fetch their own
// confirmation via the unguessable booking ID (capability URL).
router.get('/rooms', reservationController.getRooms);
router.post('/', reservationController.createReservation);
router.get('/:id', reservationController.getReservationById);

// Staff-only: listing every reservation exposes all guests' personal data.
router.get('/', authMiddleware, reservationController.getReservations);

export default router;
