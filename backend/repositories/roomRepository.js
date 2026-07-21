import Room from '../models/Room.js';

class RoomRepository {
  async getAllRooms() {
    return await Room.find().populate('currentReservation');
  }

  async findAvailableRooms(roomType, limit) {
    return await Room.find({ type: roomType, status: 'Available' }).limit(limit);
  }

  async countRooms() {
    return await Room.countDocuments();
  }

  async insertMany(rooms) {
    return await Room.insertMany(rooms);
  }

  async saveRoom(room) {
    return await room.save();
  }
}

export default new RoomRepository();
