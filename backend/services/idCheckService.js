import crypto from "crypto";
import reservationRepository from "../repositories/reservationRepository.js";
import IdDocument from "../models/IdDocument.js";
import { extractDocumentDetails } from "./documentReaderService.js";
import {
	verifyAgainstGovernmentRecord,
	VERIFICATION_LEVEL,
} from "./govVerificationService.js";
import documentPassService from "./documentPassService.js";

const OUTCOME = { RETRY: "retry", REPLACE: "replace" };

// The only two document types with a record we can put a card to.
const VERIFIABLE_TYPES = new Set(["aadhaar", "pan"]);

const ACCEPTED_DOCUMENTS = "Aadhaar or PAN card";

// Model wording for a card we could confirm, keyed by what the reader saw.
const MODEL_ID_TYPE = { aadhaar: "Aadhaar Card", pan: "PAN Card" };

const rejection = (verification) => {
	if (verification.level === VERIFICATION_LEVEL.FAILED) {
		return {
			outcome: OUTCOME.REPLACE,
			message: `${verification.remarks} Please upload a different ID.`,
		};
	}

	if (VERIFIABLE_TYPES.has(verification.idType)) {
		return {
			outcome: OUTCOME.RETRY,
			message: `${verification.remarks} Please try uploading it again in a moment.`,
		};
	}

	if (verification.idType === "unknown") {
		return {
			outcome: OUTCOME.REPLACE,
			message: `We could not tell which type of ID this is. Please upload a clear photo of your ${ACCEPTED_DOCUMENTS}.`,
		};
	}

	return {
		outcome: OUTCOME.REPLACE,
		message: `${verification.remarks} Please upload your ${ACCEPTED_DOCUMENTS} instead, which we can confirm immediately.`,
	};
};

class IdCheckService {
	async verifyUpload(file, checkInDateStr, checkOutDateStr, guestEmail) {
		const fileBuffer = file.buffer;
		const documentHash = crypto
			.createHash("md5")
			.update(fileBuffer)
			.digest("hex");

		await this.assertNotAlreadyInUse(
			documentHash,
			checkInDateStr,
			checkOutDateStr,
		);

		const reading = await extractDocumentDetails(fileBuffer);
		if (!reading.success) {
			return {
				verified: false,

				outcome: reading.retryable ? OUTCOME.RETRY : OUTCOME.REPLACE,
				message: reading.error,
			};
		}

		const verification = await verifyAgainstGovernmentRecord(reading.document);
		if (!verification.verified) {
			return { verified: false, ...rejection(verification) };
		}

		// Only now, with the card confirmed, is anything kept.
		const saved = await new IdDocument({
			filename: file.originalname,
			contentType: file.mimetype,
			data: fileBuffer,
			documentHash,
		}).save();

		return {
			verified: true,
			extractedName: reading.extractedName,
			extractedAge: reading.extractedAge,
			extractedSex: reading.extractedSex,
			idType: MODEL_ID_TYPE[verification.idType],
			remarks: verification.remarks,

			documentPass: documentPassService.issuePass(
				{
					documentId: String(saved._id),
					documentHash,
					name: reading.extractedName,
					age: reading.extractedAge,
					sex: reading.extractedSex,
					idType: MODEL_ID_TYPE[verification.idType],
					remarks: verification.remarks,
					transactionId: verification.transactionId || null,
				},
				guestEmail,
			),
		};
	}

	// One document cannot hold two stays that overlap.
	async assertNotAlreadyInUse(documentHash, checkInDateStr, checkOutDateStr) {
		if (checkInDateStr && checkOutDateStr) {
			const checkInDate = new Date(checkInDateStr);
			const checkOutDate = new Date(checkOutDateStr);

			const existing =
				await reservationRepository.findAllByDocumentHash(documentHash);
			const overlaps = (existing || []).some((res) => {
				const resCheckIn = new Date(res.checkInDate);
				const resCheckOut = new Date(res.checkOutDate);
				// Overlap check
				return checkInDate < resCheckOut && checkOutDate > resCheckIn;
			});

			if (overlaps) {
				throw new Error(
					"This ID document is already being used for a booking during overlapping dates.",
				);
			}
			return;
		}

		// Fallback if dates aren't provided
		const existing =
			await reservationRepository.findByDocumentHash(documentHash);
		if (existing) {
			throw new Error(
				"This ID document has already been used for a previous booking.",
			);
		}
	}
}

export default new IdCheckService();
