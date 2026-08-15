import reservationRepository from "../repositories/reservationRepository.js";
import roomRepository from "../repositories/roomRepository.js";
import documentPassService from "./documentPassService.js";
import { quoteStay } from "../config/roomPricing.js";

const departureCutoff = () => {
	const cutoff = new Date();
	cutoff.setHours(0, 0, 0, 0);
	return cutoff;
};

class ReservationService {
	async releaseExpiredRooms() {
		const cutoff = departureCutoff();
		const heldRooms = await roomRepository.findRoomsWithReservation();
		const expiredRoomIds = heldRooms
			.filter(
				(room) =>
					room.currentReservation &&
					new Date(room.currentReservation.checkOutDate) < cutoff,
			)
			.map((room) => room._id);

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

	async getReservationsForGuest(email) {
		const cutoff = departureCutoff();
		const stays = await reservationRepository.findByEmail(email);

		const strip = (reservation) => {
			const plain = reservation.toObject();
			plain.guests = (plain.guests || []).map(
				({ documentUrl, documentHash, ...guest }) => guest,
			);
			return plain;
		};

		return {
			upcoming: stays
				.filter((r) => new Date(r.checkOutDate) >= cutoff)
				.map(strip)
				.reverse(),
			past: stays.filter((r) => new Date(r.checkOutDate) < cutoff).map(strip),
		};
	}

	async getReservationById(reservationId) {
		const reservation = await reservationRepository.findById(reservationId);
		if (!reservation) {
			throw new Error("Reservation not found");
		}
		return reservation;
	}

	async createBooking(bookingData, guestEmail) {
		const { guests, phone, roomType, checkInDate, checkOutDate } = bookingData;

		if (!guestEmail) {
			throw new Error("Please sign in before making a reservation.");
		}

		const verifiedGuests = this.readGuestPasses(guests, guestEmail);

		const quote = quoteStay({
			roomType,
			guestCount: guests?.length || 1,
			checkInDate,
			checkOutDate,
		});

		const requiredRoomsCount = quote.rooms;

		await this.releaseExpiredRooms();

		const availableRooms = await roomRepository.findAvailableRooms(
			roomType,
			requiredRoomsCount,
		);

		if (availableRooms.length < requiredRoomsCount) {
			throw new Error(
				`Only ${availableRooms.length} rooms available for type ${roomType}, but ${requiredRoomsCount} are required for ${guests.length} guests.`,
			);
		}

		const reservationId = "LUM-" + Math.floor(100000 + Math.random() * 900000);

		const savedReservation = await reservationRepository.createReservation({
			reservationId,
			guests: verifiedGuests,
			email: guestEmail,
			phone,
			roomType,
			roomNumbers: availableRooms.map((r) => r.roomNumber),
			totalPrice: quote.total,
			pricePerNight: quote.pricePerNight,
			nights: quote.nights,
			checkInDate: new Date(checkInDate),
			checkOutDate: new Date(checkOutDate),
		});

		for (const room of availableRooms) {
			room.status = "Occupied";
			room.currentReservation = savedReservation._id;
			await roomRepository.saveRoom(room);
		}

		return savedReservation;
	}

	readGuestPasses(guests, guestEmail) {
		if (!Array.isArray(guests) || guests.length === 0) {
			throw new Error(
				"Please add at least one guest before making a reservation.",
			);
		}

		const seenDocuments = new Set();

		return guests.map((guest, index) => {
			const pass = documentPassService.readPass(
				guest?.documentPass,
				guestEmail,
			);

			if (!pass) {
				throw new Error(
					`Guest ${index + 1} has no confirmed ID document. Please upload an ID for every guest and wait for it to be confirmed before booking.`,
				);
			}

			if (seenDocuments.has(pass.documentHash)) {
				throw new Error("Each guest must have their own ID document.");
			}
			seenDocuments.add(pass.documentHash);

			return {
				name: pass.name,
				age: pass.age,
				sex: pass.sex,
				idType: pass.idType,

				status: "Verified",
				documentHash: pass.documentHash,
				documentUrl: `/api/documents/${pass.documentId}`,
				verificationDetails: {
					extractedName: (pass.name || "").substring(0, 50),
					verificationTime: new Date(),
					remarks: pass.remarks,
					verificationLevel: "government",
					governmentVerified: true,
				},
			};
		});
	}
}

export default new ReservationService();
