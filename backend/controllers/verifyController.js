import idCheckService from '../services/idCheckService.js';

class VerifyController {
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
      if (msg.includes('already been used') || msg.includes('already being used')) {
        res.status(400).json({ message: msg });
      } else {
        res.status(500).json({ message: 'Internal server error during verification' });
      }
    }
  }
}

export default new VerifyController();
