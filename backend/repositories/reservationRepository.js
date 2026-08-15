import Reservation from '../models/Reservation.js';

class ReservationRepository {
  async getActiveReservations(cutoff) {
    return await Reservation.find({ checkOutDate: { $gte: cutoff } }).sort({ checkInDate: 1 });
  }

  async getPastReservations(cutoff) {
    return await Reservation.find({ checkOutDate: { $lt: cutoff } }).sort({ checkOutDate: -1 });
  }

  async findById(reservationId) {
    return await Reservation.findOne({ reservationId });
  }

  async findByEmail(email) {
    return await Reservation.find({ email }).sort({ checkInDate: -1 });
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

}

export default new ReservationRepository();
