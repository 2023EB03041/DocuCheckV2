import reservationRepository from '../repositories/reservationRepository.js';
import roomRepository from '../repositories/roomRepository.js';
import { normalizeEmail } from './emailOtpService.js';

// A stay counts as finished once its check-out date is behind us; the guest is
// still in-house on the check-out date itself, so the boundary is midnight today.
const departureCutoff = () => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
};

class ReservationService {
  // Frees rooms whose stay has ended so inventory stops showing a departed
  // guest. Runs before any read of or search over the inventory, which keeps
  // check-out automatic without a scheduled job.
  async releaseExpiredRooms() {
    const cutoff = departureCutoff();
    const heldRooms = await roomRepository.findRoomsWithReservation();
    const expiredRoomIds = heldRooms
      .filter(room => room.currentReservation && new Date(room.currentReservation.checkOutDate) < cutoff)
      .map(room => room._id);

    if (expiredRoomIds.length > 0) {
      await roomRepository.releaseRooms(expiredRoomIds);
    }
    return expiredRoomIds.length;
  }

  async getAllRooms() {
    await this.releaseExpiredRooms();
    return await roomRepository.getAllRooms();
  }

  async getActiveReservations() {
    return await reservationRepository.getActiveReservations(departureCutoff());
  }

  async getPastReservations() {
    return await reservationRepository.getPastReservations(departureCutoff());
  }

  async getReservationById(reservationId) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    return reservation;
  }

  // verifiedEmail is the address the guest confirmed with a one-time code. The
  // booking is written against that address rather than whatever the form sent,
  // so a confirmed code cannot be reused to book under a different email.
  async createBooking(bookingData, verifiedEmail) {
    const { guests, email, phone, roomType, totalPrice, checkInDate, checkOutDate } = bookingData;

    if (!verifiedEmail || normalizeEmail(email) !== verifiedEmail) {
      throw new Error('This booking must use the email address that was verified.');
    }

    const requiredRoomsCount = Math.ceil((guests?.length || 1) / 2);

    // Reclaim departed guests' rooms first so they can be resold immediately.
    await this.releaseExpiredRooms();

    const availableRooms = await roomRepository.findAvailableRooms(roomType, requiredRoomsCount);
    
    if (availableRooms.length < requiredRoomsCount) {
      throw new Error(`Only ${availableRooms.length} rooms available for type ${roomType}, but ${requiredRoomsCount} are required for ${guests.length} guests.`);
    }

    const reservationId = 'LUM-' + Math.floor(100000 + Math.random() * 900000);
    
    const savedReservation = await reservationRepository.createReservation({
      reservationId,
      guests,
      email: verifiedEmail,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phone,
      roomType,
      roomNumbers: availableRooms.map(r => r.roomNumber),
      totalPrice,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate)
    });
    
    // Mark rooms as occupied and link reservation
    for (const room of availableRooms) {
      room.status = 'Occupied';
      room.currentReservation = savedReservation._id;
      await roomRepository.saveRoom(room);
    }

    return savedReservation;
  }
}

export default new ReservationService();
