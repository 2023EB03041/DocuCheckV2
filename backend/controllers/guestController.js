import guestAuthService from '../services/guestAuthService.js';
import reservationService from '../services/reservationService.js';

class GuestController {
  async requestLoginCode(req, res) {
    try {
      const result = await guestAuthService.requestLoginCode(req.body?.email);
      res.json({
        message: `A sign-in code has been sent to ${result.email}. It can take a moment to arrive — check your spam folder if it does not.`,
        // Names the message the code belongs to; the page sends it back with
        // the code so the two can be matched without any state held here.
        methodId: result.methodId,
        expiresInSeconds: result.expiresInSeconds,
        resendInSeconds: result.resendInSeconds
      });
    } catch (error) {
      if (error.status) {
        // A cooldown carries the wait with it so the page can count it down
        // instead of guessing when the next code may be asked for.
        return res.status(error.status).json({
          message: error.message,
          ...(error.retryAfterSeconds ? { resendInSeconds: error.retryAfterSeconds } : {})
        });
      }
      console.error('Guest sign-in code error:', error);
      res.status(500).json({ message: 'Internal server error while sending the sign-in code' });
    }
  }

  async confirmLoginCode(req, res) {
    try {
      const session = await guestAuthService.confirmLoginCode(req.body?.methodId, req.body?.code);
      res.json({
        message: 'Signed in.',
        email: session.email,
        token: session.token,
        expiresInSeconds: session.expiresInSeconds
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error('Guest sign-in confirm error:', error);
      res.status(500).json({ message: 'Internal server error while confirming the sign-in code' });
    }
  }

  // Lets the page check a stored session is still good before it trusts it.
  async getSession(req, res) {
    res.json({ email: req.guestEmail });
  }

  async getMyReservations(req, res) {
    try {
      const stays = await reservationService.getReservationsForGuest(req.guestEmail);
      res.json(stays);
    } catch (error) {
      console.error('Guest reservations error:', error);
      res.status(500).json({ message: 'Internal server error while loading your reservations' });
    }
  }
}

export default new GuestController();
