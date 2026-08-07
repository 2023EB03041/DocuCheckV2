import reservationRepository from '../repositories/reservationRepository.js';
import roomRepository from '../repositories/roomRepository.js';
import { quoteStay } from '../config/roomPricing.js';

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

  // Everything booked under a signed-in guest's address, split by whether the
  // stay is still ahead of them. The document images themselves are not exposed
  // here — the dashboard only reports whether each ID cleared.
  async getReservationsForGuest(email) {
    const cutoff = departureCutoff();
    const stays = await reservationRepository.findByEmail(email);

    const strip = (reservation) => {
      const plain = reservation.toObject();
      plain.guests = (plain.guests || []).map(({ documentUrl, documentHash, ...guest }) => guest);
      return plain;
    };

    return {
      upcoming: stays.filter(r => new Date(r.checkOutDate) >= cutoff).map(strip).reverse(),
      past: stays.filter(r => new Date(r.checkOutDate) < cutoff).map(strip)
    };
  }

  async getReservationById(reservationId) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    return reservation;
  }

  // guestEmail is the address of the signed-in guest, confirmed by a code sent
  // to it when they logged in. The booking is written against that address and
  // not against anything the form sent, so a stay always belongs to the account
  // that made it and shows up on that account's dashboard afterwards.
  async createBooking(bookingData, guestEmail) {
    const { guests, phone, roomType, checkInDate, checkOutDate } = bookingData;

    if (!guestEmail) {
      throw new Error('Please sign in before making a reservation.');
    }

    // The price is worked out here from the rate card rather than taken from the
    // request, so what is stored always matches the published rate for the tier,
    // the number of rooms and the length of the stay.
    const quote = quoteStay({
      roomType,
      guestCount: guests?.length || 1,
      checkInDate,
      checkOutDate
    });

    const requiredRoomsCount = quote.rooms;

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
      email: guestEmail,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phone,
      roomType,
      roomNumbers: availableRooms.map(r => r.roomNumber),
      totalPrice: quote.total,
      pricePerNight: quote.pricePerNight,
      nights: quote.nights,
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
