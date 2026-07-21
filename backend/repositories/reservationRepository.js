import Reservation from '../models/Reservation.js';

class ReservationRepository {
  async getAllReservations() {
    return await Reservation.find().sort({ checkInDate: 1 });
  }

  async findById(reservationId) {
    return await Reservation.findOne({ reservationId });
  }

  async findByDocumentHash(documentHash) {
    return await Reservation.findOne({ "guests.documentHash": documentHash });
  }

  async findAllByDocumentHash(documentHash) {
    return await Reservation.find({ "guests.documentHash": documentHash });
  }

  async createReservation(reservationData) {
    const newReservation = new Reservation(reservationData);
    return await newReservation.save();
  }

  async saveReservation(reservation) {
    return await reservation.save();
  }
}

export default new ReservationRepository();
