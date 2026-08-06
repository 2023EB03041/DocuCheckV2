import express from 'express';
import reservationController from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireGuest from '../middleware/requireGuest.js';

const router = express.Router();

// Public: guests browse rooms and fetch their own confirmation via the
// unguessable booking ID (capability URL). Booking itself requires a signed-in
// guest, so every stay is owned by an address that has answered a code sent to
// it — which is also what lets the guest find the stay again later.
router.get('/rooms', reservationController.getRooms);
router.post('/', requireGuest, reservationController.createReservation);

// Staff-only: listing reservations exposes all guests' personal data.
// Both must be declared before '/:id' so they are not swallowed by it.
router.get('/records', authMiddleware, reservationController.getReservationRecords);
router.get('/', authMiddleware, reservationController.getReservations);

router.get('/:id', reservationController.getReservationById);

export default router;
