import crypto from 'crypto';
import reservationRepository from '../repositories/reservationRepository.js';
import IdDocument from '../models/IdDocument.js';
import { extractDocumentDetails } from './documentReaderService.js';
import { verifyAgainstGovernmentRecord, VERIFICATION_LEVEL } from './govVerificationService.js';
import documentPassService from './documentPassService.js';

// Nothing gets through on a reading alone. Reading a card only tells us what it
// claims; every card is put to the authority that issued it, and only an answer
// confirming it lets the guest move on. There is no setting that relaxes this.
//
// A card that does not clear is never recorded against anybody — it is handed
// straight back with something to do about it. That is the whole of this file's
// job: issue a pass, or say why not and what to try next.

// What the guest should do about a card that did not clear.
//   RETRY   — nothing is known to be wrong with the document; the check itself
//             did not complete, so the same card is worth another go.
//   REPLACE — this document cannot be the one, either because the authority
//             does not confirm it or because nothing exists to check it against.
const OUTCOME = { RETRY: 'retry', REPLACE: 'replace' };

// The only two document types with a record we can put a card to.
const VERIFIABLE_TYPES = new Set(['aadhaar', 'pan']);

const ACCEPTED_DOCUMENTS = 'Aadhaar or PAN card';

// Model wording for a card we could confirm, keyed by what the reader saw.
const MODEL_ID_TYPE = { aadhaar: 'Aadhaar Card', pan: 'PAN Card' };

/**
 * What to tell a guest whose card did not clear, and whether the same card is
 * worth trying again. The distinction matters: an authority that answered "no"
 * is final, whereas one that could not be reached says nothing about the card.
 */
const rejection = (verification) => {
  if (verification.level === VERIFICATION_LEVEL.FAILED) {
    return {
      outcome: OUTCOME.REPLACE,
      message: `${verification.remarks} Please upload a different ID.`
    };
  }

  if (VERIFIABLE_TYPES.has(verification.idType)) {
    // The right kind of card — the check simply did not complete.
    return {
      outcome: OUTCOME.RETRY,
      message: `${verification.remarks} Please try uploading it again in a moment.`
    };
  }

  if (verification.idType === 'unknown') {
    return {
      outcome: OUTCOME.REPLACE,
      message: `We could not tell which type of ID this is. Please upload a clear photo of your ${ACCEPTED_DOCUMENTS}.`
    };
  }

  return {
    outcome: OUTCOME.REPLACE,
    message: `${verification.remarks} Please upload your ${ACCEPTED_DOCUMENTS} instead, which we can confirm immediately.`
  };
};

class VerifyService {
  /**
   * The one place a document is checked. Reads the card, puts it to the issuing
   * authority, and on success stores it and issues the pass the booking will
   * ask for. Anything short of a confirmed document comes back as
   * `{ verified: false }` with a message and what to do next — never as a
   * status recorded against a guest.
   */
  async verifyUpload(file, checkInDateStr, checkOutDateStr, guestEmail) {
    const fileBuffer = file.buffer;
    const documentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

    await this.assertNotAlreadyInUse(documentHash, checkInDateStr, checkOutDateStr);

    const reading = await extractDocumentDetails(fileBuffer);
    if (!reading.success) {
      return {
        verified: false,
        // A reader that could not be reached says nothing about the card, so the
        // same one is worth another go. A card we read and could not use is not.
        outcome: reading.retryable ? OUTCOME.RETRY : OUTCOME.REPLACE,
        message: reading.error
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
      documentHash
    }).save();

    return {
      verified: true,
      extractedName: reading.extractedName,
      extractedAge: reading.extractedAge,
      extractedSex: reading.extractedSex,
      idType: MODEL_ID_TYPE[verification.idType],
      remarks: verification.remarks,
      // Handed back with the booking. Everything the reservation needs to record
      // this guest is inside it, signed, so the booking neither re-reads the card
      // nor trusts the browser for any of it.
      documentPass: documentPassService.issuePass({
        documentId: String(saved._id),
        documentHash,
        name: reading.extractedName,
        age: reading.extractedAge,
        sex: reading.extractedSex,
        idType: MODEL_ID_TYPE[verification.idType],
        remarks: verification.remarks,
        transactionId: verification.transactionId || null
      }, guestEmail)
    };
  }

  /**
   * One document cannot hold two stays that overlap. Checked before the card is
   * read so a document already in use costs nothing upstream.
   */
  async assertNotAlreadyInUse(documentHash, checkInDateStr, checkOutDateStr) {
    if (checkInDateStr && checkOutDateStr) {
      const checkInDate = new Date(checkInDateStr);
      const checkOutDate = new Date(checkOutDateStr);

      const existing = await reservationRepository.findAllByDocumentHash(documentHash);
      const overlaps = (existing || []).some(res => {
        const resCheckIn = new Date(res.checkInDate);
        const resCheckOut = new Date(res.checkOutDate);
        // Overlap: Start A < End B AND End A > Start B
        return checkInDate < resCheckOut && checkOutDate > resCheckIn;
      });

      if (overlaps) {
        throw new Error('This ID document is already being used for a booking during overlapping dates.');
      }
      return;
    }

    // Fallback if dates aren't provided
    const existing = await reservationRepository.findByDocumentHash(documentHash);
    if (existing) {
      throw new Error('This ID document has already been used for a previous booking.');
    }
  }
}

export default new VerifyService();
