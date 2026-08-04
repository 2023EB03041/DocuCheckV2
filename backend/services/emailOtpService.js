import jwt from 'jsonwebtoken';

// The one-time code is generated, emailed and checked by Supabase Auth, so no
// code is ever created or stored here and nothing is sent from this server.
// The message reaches the guest from Supabase's own address and infrastructure,
// which is what lets this work without a sending domain of our own.
//
// This server keeps only the last step: once Supabase confirms an address, it
// issues short-lived proof that travels with the ID uploads and the booking.

// An upstream call that stops responding must not hold the guest's request open.
const REQUEST_TIMEOUT_MS = 15000;

// Supabase refuses a second code for the same address inside its own cooldown.
// Used to tell the page how long to wait when it answers with one.
const RESEND_COOLDOWN_SECONDS = 60;

// Supabase's default lifetime for an emailed code. Reported to the caller for
// completeness; the authority on expiry is Supabase, not this constant.
const CODE_TTL_SECONDS = 3600;

// Proof of a verified address. Long enough to finish a booking, short enough
// that it is not worth keeping.
const PROOF_TTL_SECONDS = 2 * 60 * 60;
const PROOF_PURPOSE = 'email-verification';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const assertUsableEmail = (email) => {
  if (!EMAIL_PATTERN.test(email)) {
    throw fail(400, 'Please enter a valid email address.');
  }
};

const isConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

/**
 * Calls a Supabase Auth endpoint. The key sent here is the publishable one,
 * which is meant to be seen by clients and carries no privileges of its own.
 */
const postToSupabase = async (path, body) => {
  const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_ANON_KEY;

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  return { ok: response.ok, status: response.status, payload: await response.json().catch(() => ({})) };
};

// Supabase has reported errors under several field names across versions, so
// each is read in turn rather than trusting any single one.
const upstreamMessage = (payload) =>
  payload?.msg || payload?.error_description || payload?.message || payload?.error || '';

class EmailOtpService {
  /**
   * Asks Supabase to email a code to the address. Nothing is written here —
   * Supabase holds the code and decides when it expires.
   */
  async requestCode(rawEmail) {
    const email = normalizeEmail(rawEmail);
    assertUsableEmail(email);

    if (!isConfigured()) {
      throw fail(503, 'Email verification is not configured on this server.');
    }

    let result;
    try {
      result = await postToSupabase('/auth/v1/otp', { email, create_user: true });
    } catch (error) {
      console.error('Email verification send error:', error.message);
      throw fail(502, 'We could not send the verification code right now. Please try again in a moment.');
    }

    if (result.status === 429) {
      const error = fail(429, 'Please wait a moment before requesting another code.');
      error.retryAfterSeconds = RESEND_COOLDOWN_SECONDS;
      throw error;
    }

    if (!result.ok) {
      console.error(`Email verification send failed (HTTP ${result.status}): ${upstreamMessage(result.payload)}`);
      throw fail(502, 'We could not send the verification code to that address. Please check it and try again.');
    }

    return {
      email,
      expiresInSeconds: CODE_TTL_SECONDS,
      resendInSeconds: RESEND_COOLDOWN_SECONDS
    };
  }

  /**
   * Puts the code the guest typed to Supabase. Only when Supabase accepts it is
   * proof issued, so a confirmed address is never taken on the client's word.
   */
  async confirmCode(rawEmail, rawCode) {
    const email = normalizeEmail(rawEmail);
    assertUsableEmail(email);

    const code = (rawCode || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw fail(400, 'Please enter the 6 digit code from the email.');
    }

    if (!isConfigured()) {
      throw fail(503, 'Email verification is not configured on this server.');
    }

    let result;
    try {
      result = await postToSupabase('/auth/v1/verify', { type: 'email', email, token: code });
    } catch (error) {
      console.error('Email verification confirm error:', error.message);
      throw fail(502, 'We could not check that code right now. Please try again in a moment.');
    }

    if (result.status === 429) {
      throw fail(429, 'Too many attempts. Please wait a moment and try again.');
    }

    if (!result.ok) {
      // A wrong code, an expired one and a spent one are all reported the same
      // way, so the guest is given the one instruction that covers all three.
      throw fail(400, 'That code is not correct or has expired. Please check it, or request a new one.');
    }

    return {
      email,
      token: this.issueProof(email),
      expiresInSeconds: PROOF_TTL_SECONDS
    };
  }

  issueProof(email) {
    return jwt.sign({ email, purpose: PROOF_PURPOSE }, process.env.JWT_SECRET, {
      expiresIn: PROOF_TTL_SECONDS
    });
  }

  /**
   * Reads the address out of a proof, or null if it is missing, tampered with,
   * expired, or was issued for anything other than email verification.
   */
  readProof(token) {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload?.purpose === PROOF_PURPOSE ? normalizeEmail(payload.email) : null;
    } catch {
      return null;
    }
  }
}

export default new EmailOtpService();
