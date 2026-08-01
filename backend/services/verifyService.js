import crypto from 'crypto';
import reservationRepository from '../repositories/reservationRepository.js';
import IdDocument from '../models/IdDocument.js';
import { verifyDocument, extractDocumentDetails } from './documentReaderService.js';
import { verifyAgainstGovernmentRecord, VERIFICATION_LEVEL } from './govVerificationService.js';

// A document that no government record confirms is rejected outright. Set
// REQUIRE_GOVERNMENT_VERIFICATION=false to accept a reading on its own, which
// is only useful while the verification provider is unavailable.
const requiresGovernmentVerification = () => {
  return (process.env.REQUIRE_GOVERNMENT_VERIFICATION || 'true').toLowerCase() !== 'false';
};

/**
 * Tells the guest what to do next when a document could not be confirmed.
 * Aadhaar, driving licences and passports have no automatic check available,
 * so the guest is pointed at a document that does.
 */
const rejectionMessage = (verification) => {
  if (verification.level === VERIFICATION_LEVEL.FAILED) {
    return `${verification.remarks} Please upload a different ID.`;
  }

  if (verification.idType === 'unknown') {
    return 'We could not tell which type of ID this is. Please upload a clear photo of your PAN card.';
  }

  if (!verification.checked && verification.remarks.includes('temporarily unavailable')) {
    return 'Verification is temporarily unavailable. Please try again in a few minutes.';
  }

  return `${verification.remarks} Please upload your PAN card instead, which we can confirm immediately.`;
};

/**
 * Runs the government check for a document that was read successfully, and
 * folds the outcome into the result. The raw document is removed on the way
 * out so the document number never leaves the server.
 */
const attachVerification = async (result) => {
  const document = result.document;
  delete result.document;

  if (!result.success || !document) {
    return result;
  }

  const verification = await verifyAgainstGovernmentRecord(document);

  result.idType = verification.idType;
  result.verificationLevel = verification.level;
  result.governmentVerified = verification.verified;
  result.verificationRemarks = verification.remarks;

  if (requiresGovernmentVerification() && !verification.verified) {
    // Details are cleared so an unconfirmed document cannot auto-fill the form.
    result.success = false;
    result.extractedName = '';
    result.extractedAge = null;
    result.extractedSex = '';
    result.error = rejectionMessage(verification);
    result.remarks = result.error;
  }

  return result;
};

class VerifyService {
  async extractDetails(file, checkInDateStr, checkOutDateStr) {
    const fileBuffer = file.buffer;
    const documentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

    if (checkInDateStr && checkOutDateStr) {
      const checkInDate = new Date(checkInDateStr);
      const checkOutDate = new Date(checkOutDateStr);
      
      const existingResArray = await reservationRepository.findAllByDocumentHash(documentHash);
      if (existingResArray && existingResArray.length > 0) {
        const overlaps = existingResArray.some(res => {
          const resCheckIn = new Date(res.checkInDate);
          const resCheckOut = new Date(res.checkOutDate);
          // Overlap: Start A < End B AND End A > Start B
          return checkInDate < resCheckOut && checkOutDate > resCheckIn;
        });
        
        if (overlaps) {
          throw new Error('This ID document is already being used for a booking during overlapping dates.');
        }
      }
    } else {
      // Fallback if dates aren't provided
      const existingRes = await reservationRepository.findByDocumentHash(documentHash);
      if (existingRes) {
        throw new Error('This ID document has already been used for a previous booking.');
      }
    }

    const extractionResult = await attachVerification(await extractDocumentDetails(fileBuffer));

    return extractionResult;
  }

  async verifyGuestDocument(reservationId, guestIndex, file) {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const index = parseInt(guestIndex, 10);
    if (isNaN(index) || index < 0 || index >= reservation.guests.length) {
      throw new Error('Invalid guest index');
    }

    const guest = reservation.guests[index];
    const fileBuffer = file.buffer;
    
    const verificationResult = await attachVerification(await verifyDocument(fileBuffer, guest.name));

    const documentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    
    // Check if another reservation uses this hash for overlapping dates
    const existingResArray = await reservationRepository.findAllByDocumentHash(documentHash);
    const overlaps = existingResArray.some(res => {
      if (res.reservationId === reservationId) return false; // Ignore own reservation
      const resCheckIn = new Date(res.checkInDate);
      const resCheckOut = new Date(res.checkOutDate);
      const myCheckIn = new Date(reservation.checkInDate);
      const myCheckOut = new Date(reservation.checkOutDate);
      return myCheckIn < resCheckOut && myCheckOut > resCheckIn;
    });

    if (overlaps) {
       throw new Error('This ID document is already being used for a booking during overlapping dates.');
    }

    // Save Document securely to MongoDB
    const idDocument = new IdDocument({
      filename: file.originalname,
      contentType: file.mimetype,
      data: fileBuffer,
      documentHash: documentHash
    });
    const savedDocument = await idDocument.save();

    guest.documentHash = documentHash;
    // With verification required, success already implies a government record
    // confirmed the document, so it alone decides the guest's standing.
    guest.status = verificationResult.success ? 'Verified' : 'Failed';
    guest.documentUrl = `/api/documents/${savedDocument._id}`; // Secure authenticated route
    guest.verificationDetails = {
      extractedName: (verificationResult.extractedName || '').substring(0, 50),
      confidenceScore: verificationResult.confidenceScore,
      verificationTime: new Date(),
      remarks: verificationResult.verificationRemarks
        ? `${verificationResult.remarks} ${verificationResult.verificationRemarks}`
        : verificationResult.remarks,
      verificationLevel: verificationResult.verificationLevel,
      governmentVerified: verificationResult.governmentVerified === true
    };

    await reservationRepository.saveReservation(reservation);

    return {
      message: `Verification completed for guest ${index + 1}`,
      status: guest.status,
      details: verificationResult
    };
  }
}

export default new VerifyService();
