import Room from '../models/Room.js';

class RoomRepository {
  async getAllRooms() {
    return await Room.find().populate('currentReservation');
  }

  async findAvailableRooms(roomType, limit) {
    return await Room.find({ type: roomType, status: 'Available' }).limit(limit);
  }

  async findRoomsWithReservation() {
    return await Room.find({ currentReservation: { $ne: null } }).populate('currentReservation');
  }

  // Detach the stay from the rooms it held. Rooms that were merely occupied go
  // back into the sellable pool; Cleaning/Maintenance rooms keep their status
  // so housekeeping is not silently overridden.
  async releaseRooms(roomIds) {
    await Room.updateMany(
      { _id: { $in: roomIds }, status: 'Occupied' },
      { $set: { status: 'Available' } }
    );
    return await Room.updateMany(
      { _id: { $in: roomIds } },
      { $set: { currentReservation: null } }
    );
  }

  async saveRoom(room) {
    return await room.save();
  }
}

export default new RoomRepository();
