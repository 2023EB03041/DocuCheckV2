import jwt from 'jsonwebtoken';
import emailOtpService, { normalizeEmail } from './emailOtpService.js';

// A guest account is nothing more than a confirmed email address. There is no
// password to set, forget or leak: the guest proves the address by answering a
// code sent to it, and this issues a session that lets them come back later to
// see the stays booked under that address.
//
// The session lasts far longer than the proof used mid-booking, because its
// whole point is that a returning guest is not asked to verify again.
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_PURPOSE = 'guest-session';

class GuestAuthService {
  /**
   * Starts a sign-in by asking for a one-time code to be emailed. Both new and
   * returning guests take this same path — an address that has never booked
   * simply has no stays to show yet.
   */
  async requestLoginCode(email) {
    return await emailOtpService.requestCode(email);
  }

  /**
   * Finishes a sign-in. The address is read out of the confirmation rather than
   * taken from the request, so a code confirmed for one address can never open
   * a session for another.
   */
  async confirmLoginCode(methodId, code) {
    const confirmed = await emailOtpService.confirmCode(methodId, code);

    return {
      email: confirmed.email,
      // The session the dashboard is read with.
      token: this.issueSession(confirmed.email),
      expiresInSeconds: SESSION_TTL_SECONDS
    };
  }

  issueSession(email) {
    return jwt.sign({ email: normalizeEmail(email), purpose: SESSION_PURPOSE }, process.env.JWT_SECRET, {
      expiresIn: SESSION_TTL_SECONDS
    });
  }

  /**
   * The signed-in address, or null if the token is missing, tampered with,
   * expired, or was issued for anything other than a guest session. Staff
   * tokens travel in the same header and are rejected here by purpose.
   */
  readSession(token) {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload?.purpose === SESSION_PURPOSE ? normalizeEmail(payload.email) : null;
    } catch {
      return null;
    }
  }

  // Pulls the session out of an 'Authorization: Bearer <token>' header.
  readSessionFromHeader(authorizationHeader) {
    const header = authorizationHeader || '';
    if (!header.startsWith('Bearer ')) return null;
    return this.readSession(header.slice(7).trim());
  }
}

export default new GuestAuthService();
