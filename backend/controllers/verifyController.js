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
      if (error.message.includes('already been used')) {
        res.status(400).json({ message: error.message });
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
