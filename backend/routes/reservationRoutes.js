import express from 'express';
import reservationController from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireGuest from '../middleware/requireGuest.js';

const router = express.Router();

router.get('/rooms', reservationController.getRooms);
router.post('/', requireGuest, reservationController.createReservation);

router.get('/records', authMiddleware, reservationController.getReservationRecords);
router.get('/', authMiddleware, reservationController.getReservations);

router.get('/:id', reservationController.getReservationById);

export default router;
