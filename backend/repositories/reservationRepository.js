import Reservation from '../models/Reservation.js';

class ReservationRepository {
  // Stays that have not been checked out of yet: current and upcoming.
  async getActiveReservations(cutoff) {
    return await Reservation.find({ checkOutDate: { $gte: cutoff } }).sort({ checkInDate: 1 });
  }

  // Completed stays, most recently departed first.
  async getPastReservations(cutoff) {
    return await Reservation.find({ checkOutDate: { $lt: cutoff } }).sort({ checkOutDate: -1 });
  }

  async findById(reservationId) {
    return await Reservation.findOne({ reservationId });
  }

  // Every stay booked under one address, newest arrival first. Addresses are
  // stored normalized, so an exact match is enough.
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
