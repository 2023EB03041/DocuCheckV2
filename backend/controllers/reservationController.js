import reservationService from '../services/reservationService.js';

class ReservationController {
  async getRooms(req, res) {
    try {
      const rooms = await reservationService.getAllRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getReservations(req, res) {
    try {
      const reservations = await reservationService.getAllReservations();
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getReservationById(req, res) {
    try {
      const reservation = await reservationService.getReservationById(req.params.id);
      res.json(reservation);
    } catch (error) {
      if (error.message === 'Reservation not found') {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  }

  async createReservation(req, res) {
    try {
      const saved = await reservationService.createBooking(req.body);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new ReservationController();
