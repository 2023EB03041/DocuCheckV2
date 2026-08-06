// Mirrors the rate card the server prices bookings with, so the room list, the
// checkout summary and the confirmation all quote the same figure the server
// stores. The nightly rate itself always comes from the room record, never from
// a number written down here.

export const GST_RATE = 0.18;

// Two guests share a room, so this is how many rooms a party needs.
export const roomsForGuests = (guestCount) => Math.max(1, Math.ceil((Number(guestCount) || 1) / 2));

// Whole nights between the two dates; a stay is charged for at least one night.
export const nightsBetween = (checkInDate, checkOutDate) => {
  if (!checkInDate || !checkOutDate) return 1;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
};

/**
 * What a stay costs: the tier's nightly rate, times the rooms the party needs,
 * times the nights they stay, plus tax.
 */
export const quoteStay = ({ pricePerNight, guestCount, checkInDate, checkOutDate }) => {
  const rooms = roomsForGuests(guestCount);
  const nights = nightsBetween(checkInDate, checkOutDate);
  const subtotal = (Number(pricePerNight) || 0) * rooms * nights;
  const gst = Math.round(subtotal * GST_RATE);
  return { pricePerNight: Number(pricePerNight) || 0, rooms, nights, subtotal, gst, total: subtotal + gst };
};

export const formatINR = (amount) => `₹${(Number(amount) || 0).toLocaleString('en-IN')}`;
