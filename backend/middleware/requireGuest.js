import guestAuthService from '../services/guestAuthService.js';

/**
 * Lets a request through only when it carries a signed-in guest's session, and
 * leaves that guest's address on the request. Handlers use it to scope what
 * they return to the stays booked under that address.
 */
const requireGuest = (req, res, next) => {
  const email = guestAuthService.readSessionFromHeader(req.headers.authorization);

  if (!email) {
    return res.status(401).json({
      code: 'GUEST_SIGN_IN_REQUIRED',
      message: 'Please sign in to continue.'
    });
  }

  req.guestEmail = email;
  next();
};

export default requireGuest;
