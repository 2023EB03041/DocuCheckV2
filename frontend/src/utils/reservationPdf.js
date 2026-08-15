import { jsPDF } from "jspdf";
import { GST_RATE, nightsBetween, roomsForGuests } from "./pricing";

const NAVY = [26, 54, 93];
const GOLD = [212, 175, 55];

const inr = (amount) => `INR ${(Number(amount) || 0).toLocaleString("en-IN")}`;

const chargesFor = (reservation) => {
	const rooms =
		(reservation.roomNumbers || []).length ||
		roomsForGuests(reservation.guests?.length);
	const nights =
		reservation.nights ||
		nightsBetween(reservation.checkInDate, reservation.checkOutDate);
	const total = Number(reservation.totalPrice) || 0;
	const subtotal = reservation.pricePerNight
		? reservation.pricePerNight * rooms * nights
		: Math.round(total / (1 + GST_RATE));
	const rate =
		reservation.pricePerNight ||
		(rooms && nights ? Math.round(subtotal / (rooms * nights)) : 0);

	return { rooms, nights, rate, subtotal, gst: total - subtotal, total };
};

const buildReservationPdf = (reservation) => {
	const doc = new jsPDF();
	const { rooms, nights, rate, subtotal, gst, total } = chargesFor(reservation);

	doc.setFillColor(...NAVY);
	doc.rect(0, 0, 210, 40, "F");

	doc.setFontSize(24);
	doc.setTextColor(255, 255, 255);
	doc.text("LUMINA RESORT & SPA", 105, 20, null, null, "center");

	doc.setFontSize(11);
	doc.setTextColor(...GOLD);
	doc.text("LUXURY LIVING AT ITS FINEST", 105, 30, null, null, "center");

	doc.setFontSize(16);
	doc.setTextColor(...NAVY);
	doc.text("Booking Confirmation", 20, 55);
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.5);
	doc.line(20, 58, 190, 58);

	doc.setFontSize(10);
	doc.setTextColor(50, 50, 50);

	const field = (label, value, labelX, valueX, y) => {
		doc.setFont(undefined, "bold");
		doc.text(label, labelX, y);
		doc.setFont(undefined, "normal");
		doc.text(String(value), valueX, y);
	};

	field("Confirmation ID:", reservation.reservationId, 20, 55, 70);
	field("Room Type:", reservation.roomType || "-", 20, 55, 80);
	field(
		"Room Numbers:",
		(reservation.roomNumbers || []).join(", ") || "Assigned at check-in",
		20,
		55,
		90,
	);
	field("Booked By:", reservation.email || "-", 20, 55, 100);

	field(
		"Check-In:",
		new Date(reservation.checkInDate).toLocaleDateString(),
		115,
		145,
		70,
	);
	field(
		"Check-Out:",
		new Date(reservation.checkOutDate).toLocaleDateString(),
		115,
		145,
		80,
	);
	field("Nights:", nights, 115, 145, 90);
	field("Guests:", reservation.guests?.length || 0, 115, 145, 100);

	// Charges, shown exactly as they were quoted at checkout.
	doc.setFontSize(14);
	doc.setTextColor(...NAVY);
	doc.setFont(undefined, "normal");
	doc.text("Charges", 20, 118);
	doc.line(20, 121, 190, 121);

	doc.setFontSize(10);
	doc.setTextColor(50, 50, 50);
	doc.text(`${inr(rate)} x ${rooms} room(s) x ${nights} night(s)`, 25, 131);
	doc.text(inr(subtotal), 190, 131, null, null, "right");

	doc.text(`GST (${Math.round(GST_RATE * 100)}%)`, 25, 138);
	doc.text(inr(gst), 190, 138, null, null, "right");

	doc.setFont(undefined, "bold");
	doc.text("Total Paid", 25, 146);
	doc.text(inr(total), 190, 146, null, null, "right");
	doc.setFont(undefined, "normal");

	doc.setFontSize(14);
	doc.setTextColor(...NAVY);
	doc.text("Guest Details & Verification", 20, 162);
	doc.line(20, 165, 190, 165);

	let y = 177;
	(reservation.guests || []).forEach((guest, index) => {
		doc.setFillColor(249, 250, 251);
		doc.rect(20, y - 5, 170, 16, "F");

		doc.setFontSize(10);
		doc.setTextColor(50, 50, 50);
		doc.setFont(undefined, "bold");
		doc.text(`${index + 1}. ${guest.name}`, 25, y);

		doc.setFont(undefined, "normal");
		doc.setTextColor(100, 100, 100);
		doc.text(`ID: ${guest.idType}`, 25, y + 6);

		// Only a confirmed guest can be on a stay, so the line only ever reads one way.
		doc.setTextColor(34, 197, 94);
		doc.setFont(undefined, "bold");
		doc.text(`Status: ${guest.status}`, 160, y + 3, null, null, "right");

		y += 20;
	});

	doc.setTextColor(150, 150, 150);
	doc.setFontSize(9);
	doc.setFont(undefined, "normal");
	doc.text(
		"Please present this confirmation and your original ID documents upon check-in.",
		105,
		280,
		null,
		null,
		"center",
	);

	return doc;
};

export const downloadReservationPdf = (reservation) => {
	buildReservationPdf(reservation).save(
		`Lumina_Reservation_${reservation.reservationId}.pdf`,
	);
};
