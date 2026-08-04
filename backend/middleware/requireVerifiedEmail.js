import emailOtpService from '../services/emailOtpService.js';

/**
 * Lets a request through only when it carries proof that the email address on
 * the booking was confirmed by a code sent to it. Guests are not signed in, so
 * this proof is what ties an upload to a real, reachable address.
 *
 * The confirmed address is left on the request for handlers that need to check
 * it against the one being booked.
 */
const requireVerifiedEmail = (req, res, next) => {
  const email = emailOtpService.readProof(req.headers['x-email-verification']);

  if (!email) {
    return res.status(401).json({
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before continuing.'
    });
  }

  req.verifiedEmail = email;
  next();
};

export default requireVerifiedEmail;
