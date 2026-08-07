import reservationRepository from '../repositories/reservationRepository.js';
import roomRepository from '../repositories/roomRepository.js';
import documentPassService from './documentPassService.js';
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
  //
  // Every guest must present a pass showing their ID was already confirmed
  // against the issuing authority's record. A stay therefore cannot exist with
  // an unverified guest on it — there is no state in which a booking is made
  // first and the documents sorted out afterwards.
  async createBooking(bookingData, guestEmail) {
    const { guests, phone, roomType, checkInDate, checkOutDate } = bookingData;

    if (!guestEmail) {
      throw new Error('Please sign in before making a reservation.');
    }

    const verifiedGuests = this.readGuestPasses(guests, guestEmail);

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
      guests: verifiedGuests,
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

  /**
   * Turns each guest's pass into the record stored against the stay. The name,
   * age, sex and document type all come out of the pass rather than out of the
   * request, so what is stored is what the authority confirmed and not what the
   * browser typed. A guest without a valid pass stops the whole booking.
   */
  readGuestPasses(guests, guestEmail) {
    if (!Array.isArray(guests) || guests.length === 0) {
      throw new Error('Please add at least one guest before making a reservation.');
    }

    const seenDocuments = new Set();

    return guests.map((guest, index) => {
      const pass = documentPassService.readPass(guest?.documentPass, guestEmail);

      if (!pass) {
        throw new Error(
          `Guest ${index + 1} has no confirmed ID document. Please upload an ID for every guest and wait for it to be confirmed before booking.`
        );
      }

      if (seenDocuments.has(pass.documentHash)) {
        throw new Error('Each guest must have their own ID document.');
      }
      seenDocuments.add(pass.documentHash);

      return {
        name: pass.name,
        age: pass.age,
        sex: pass.sex,
        idType: pass.idType,
        // The pass is only ever issued for a document the issuing authority
        // confirmed, so there is no other standing a stored guest can have.
        status: 'Verified',
        documentHash: pass.documentHash,
        documentUrl: `/api/documents/${pass.documentId}`,
        verificationDetails: {
          extractedName: (pass.name || '').substring(0, 50),
          verificationTime: new Date(),
          remarks: pass.remarks,
          verificationLevel: 'government',
          governmentVerified: true
        }
      };
    });
  }
}

export default new ReservationService();
