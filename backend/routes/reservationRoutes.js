import express from 'express';
import reservationController from '../controllers/reservationController.js';

const router = express.Router();

router.get('/rooms', reservationController.getRooms);
router.get('/', reservationController.getReservations);
router.get('/:id', reservationController.getReservationById);
router.post('/', reservationController.createReservation);

export default router;
