const BASE_RATE = 5000;
const RATE_STEP = 5000;

// Twenty rooms
const ROOM_TIERS = [
  { type: 'Standard',           floor: 1, roomCount: 8 },
  { type: 'Deluxe',             floor: 2, roomCount: 6 },
  { type: 'Ocean View',         floor: 3, roomCount: 4 },
  { type: 'Presidential Suite', floor: 4, roomCount: 2 }
].map((tier, index) => ({ ...tier, pricePerNight: BASE_RATE + index * RATE_STEP }));

// Tax added on top of the room charge
export const GST_RATE = 0.18;

// Two guests share a room
export const roomsForGuests = (guestCount) => Math.max(1, Math.ceil((Number(guestCount) || 1) / 2));

const priceForType = (type) =>
  ROOM_TIERS.find(tier => tier.type === type)?.pricePerNight ?? null;

export const nightsBetween = (checkInDate, checkOutDate) => {
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
};

// Works out what a stay costs
export const quoteStay = ({ roomType, guestCount, checkInDate, checkOutDate }) => {
  const pricePerNight = priceForType(roomType);
  if (pricePerNight === null) {
    throw new Error(`Unknown room type: ${roomType}`);
  }

  const rooms = roomsForGuests(guestCount);
  const nights = nightsBetween(checkInDate, checkOutDate);
  const subtotal = pricePerNight * rooms * nights;
  const gst = Math.round(subtotal * GST_RATE);

  return { pricePerNight, rooms, nights, subtotal, gst, total: subtotal + gst };
};

// The rooms this property sells
export const buildRoomInventory = () => {
  const pad = (n) => String(n).padStart(2, '0');
  return ROOM_TIERS.flatMap(tier =>
    Array.from({ length: tier.roomCount }, (_, i) => ({
      roomNumber: `${tier.floor}${pad(i + 1)}`,
      type: tier.type,
      pricePerNight: tier.pricePerNight
    }))
  );
};
