import reservationRepository from '../repositories/reservationRepository.js';
import roomRepository from '../repositories/roomRepository.js';

class ReservationService {
  async getAllRooms() {
    return await roomRepository.getAllRooms();
  }

  async getAllReservations() {
    return await reservationRepository.getAllReservations();
  }

  async getReservationById(reservationId) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    return reservation;
  }

  async createBooking(bookingData) {
    const { guests, email, phone, roomType, totalPrice, checkInDate, checkOutDate } = bookingData;
    
    const requiredRoomsCount = Math.ceil((guests?.length || 1) / 2);

    const availableRooms = await roomRepository.findAvailableRooms(roomType, requiredRoomsCount);
    
    if (availableRooms.length < requiredRoomsCount) {
      throw new Error(`Only ${availableRooms.length} rooms available for type ${roomType}, but ${requiredRoomsCount} are required for ${guests.length} guests.`);
    }

    const reservationId = 'LUM-' + Math.floor(100000 + Math.random() * 900000);
    
    const savedReservation = await reservationRepository.createReservation({
      reservationId,
      guests,
      email,
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
