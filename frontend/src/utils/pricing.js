export const GST_RATE = 0.18;

export const roomsForGuests = (guestCount) =>
	Math.max(1, Math.ceil((Number(guestCount) || 1) / 2));

export const nightsBetween = (checkInDate, checkOutDate) => {
	if (!checkInDate || !checkOutDate) return 1;
	const start = new Date(checkInDate);
	const end = new Date(checkOutDate);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
	return Math.max(1, Math.round((end - start) / 86400000));
};

export const quoteStay = ({
	pricePerNight,
	guestCount,
	checkInDate,
	checkOutDate,
}) => {
	const rooms = roomsForGuests(guestCount);
	const nights = nightsBetween(checkInDate, checkOutDate);
	const subtotal = (Number(pricePerNight) || 0) * rooms * nights;
	const gst = Math.round(subtotal * GST_RATE);
	return {
		pricePerNight: Number(pricePerNight) || 0,
		rooms,
		nights,
		subtotal,
		gst,
		total: subtotal + gst,
	};
};

export const formatINR = (amount) =>
	`₹${(Number(amount) || 0).toLocaleString("en-IN")}`;
