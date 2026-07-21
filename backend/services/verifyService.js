import crypto from 'crypto';
import reservationRepository from '../repositories/reservationRepository.js';
import IdDocument from '../models/IdDocument.js';
import { verifyDocument, extractDocumentDetails } from './ocrService.js';

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

    const extractionResult = await extractDocumentDetails(fileBuffer);

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
    
    const ocrResult = await verifyDocument(fileBuffer, guest.name);

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
    guest.status = ocrResult.success ? 'Verified' : 'Failed';
    guest.documentUrl = `/api/documents/${savedDocument._id}`; // Secure authenticated route
    guest.verificationDetails = {
      extractedName: ocrResult.extractedText.substring(0, 50),
      confidenceScore: ocrResult.confidenceScore,
      verificationTime: new Date(),
      remarks: ocrResult.remarks
    };

    await reservationRepository.saveReservation(reservation);

    return {
      message: `Verification completed for guest ${index + 1}`,
      status: guest.status,
      details: ocrResult
    };
  }
}

export default new VerifyService();
