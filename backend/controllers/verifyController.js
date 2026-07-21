import verifyService from '../services/verifyService.js';

class VerifyController {
  async extract(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No document uploaded' });
      }
      
      const { checkInDate, checkOutDate } = req.body;

      const extractionResult = await verifyService.extractDetails(req.file, checkInDate, checkOutDate);
      res.json(extractionResult);
    } catch (error) {
      console.error('Extraction route error:', error);
      const msg = error.message || '';
      // Both duplicate-document cases ("already been used" / "already being
      // used ... overlapping dates") are client-side issues -> 400, not 500.
      if (msg.includes('already been used') || msg.includes('already being used')) {
        res.status(400).json({ message: msg });
      } else {
        res.status(500).json({ message: 'Internal server error during extraction' });
      }
    }
  }

  async verifyGuest(req, res) {
    try {
      const { reservationId, guestIndex } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: 'No document uploaded' });
      }

      const result = await verifyService.verifyGuestDocument(reservationId, guestIndex, req.file);
      res.json(result);
    } catch (error) {
      console.error('Verification Error:', error);
      if (error.message === 'Reservation not found') {
        res.status(404).json({ message: error.message });
      } else if (error.message === 'Invalid guest index') {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error during verification' });
      }
    }
  }
}

export default new VerifyController();
