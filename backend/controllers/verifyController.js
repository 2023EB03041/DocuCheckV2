import idCheckService from '../services/idCheckService.js';

class VerifyController {
  /**
   * Checks one uploaded document. A card that clears comes back with its
   * details and the pass the booking will ask for; one that does not comes back
   * as an ordinary answer saying why and what to do, not as an error.
   */
  async verify(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No document uploaded' });
      }

      const { checkInDate, checkOutDate } = req.body;

      const result = await idCheckService.verifyUpload(req.file, checkInDate, checkOutDate, req.guestEmail);
      res.json(result);
    } catch (error) {
      console.error('Verification route error:', error);
      const msg = error.message || '';
      // Both duplicate-document cases ("already been used" / "already being
      // used ... overlapping dates") are client-side issues -> 400, not 500.
      if (msg.includes('already been used') || msg.includes('already being used')) {
        res.status(400).json({ message: msg });
      } else {
        res.status(500).json({ message: 'Internal server error during verification' });
      }
    }
  }
}

export default new VerifyController();
