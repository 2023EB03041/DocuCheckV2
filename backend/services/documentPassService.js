import jwt from 'jsonwebtoken';

// A pass is the server's own receipt that one particular document was read and
// confirmed against the record of the authority that issued it. It is handed to
// the guest the moment a check succeeds and handed back when the booking is
// made.
//
// This is what lets a document be checked exactly once. The booking does not
// re-read the card and does not re-run the check, so there is no second opinion
// to disagree with the first — and, just as importantly, no booking can be made
// without presenting one of these for every guest.
//
// It lasts only as long as a booking plausibly takes, and it is bound to the
// signed-in address, so one guest's cleared document cannot be presented on
// somebody else's booking.
const PASS_TTL_SECONDS = 2 * 60 * 60;
const PASS_PURPOSE = 'document-verification';

class DocumentPassService {
  issuePass(document, email) {
    return jwt.sign({ ...document, email, purpose: PASS_PURPOSE }, process.env.JWT_SECRET, {
      expiresIn: PASS_TTL_SECONDS
    });
  }

  /**
   * The document a pass was issued for, or null if it is missing, tampered
   * with, expired, issued for anything other than a confirmed document, or
   * issued to a different address than the one presenting it.
   */
  readPass(token, email) {
    if (!token || !email) return null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload?.purpose !== PASS_PURPOSE) return null;
      if (payload.email !== email) return null;
      return payload;
    } catch {
      return null;
    }
  }
}

export default new DocumentPassService();
