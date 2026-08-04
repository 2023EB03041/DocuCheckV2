import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import EmailVerification from '../models/EmailVerification.js';
import { isMailConfigured, sendMail } from './mailService.js';

const CODE_LENGTH = 6;
// How long a code stays usable, and how long the guest must wait before asking
// for another one. The wait stops the endpoint from being used to send mail.
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
// Wrong guesses allowed before the code is thrown away and a new one is needed.
const MAX_ATTEMPTS = 5;

// Proof of a verified address, handed to the guest and presented again when
// they upload an ID or confirm the booking. Long enough to finish a booking,
// short enough that it is not worth keeping.
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

// Uniform across the range, unlike the remainder of a random 32-bit number.
const generateCode = () => {
  const max = 10 ** CODE_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, '0');
};

// Keyed with the server secret so the stored hash cannot be matched against a
// precomputed table of the million possible codes.
const hashCode = (code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex');

const codesMatch = (candidate, storedHash) => {
  const left = Buffer.from(hashCode(candidate));
  const right = Buffer.from(storedHash || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const secondsUntil = (date) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 1000));

const buildEmail = (code) => {
  const minutes = CODE_TTL_MINUTES;

  const text = [
    'Lumina Resort & Spa',
    '',
    `Your email verification code is ${code}.`,
    '',
    `Enter it on the booking page to confirm this address. The code expires in ${minutes} minutes.`,
    '',
    'If you did not start a booking with us, you can ignore this message.'
  ].join('\n');

  const html = `
  <div style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#1a365d;padding:28px 24px;text-align:center;">
        <div style="color:#ffffff;font-size:20px;letter-spacing:2px;font-weight:bold;">LUMINA RESORT &amp; SPA</div>
        <div style="color:#d4af37;font-size:11px;letter-spacing:3px;margin-top:6px;">LUXURY LIVING AT ITS FINEST</div>
      </div>
      <div style="padding:32px 28px;color:#334155;font-size:14px;line-height:22px;">
        <p style="margin:0 0 18px;">Please confirm this email address to continue with your booking.</p>
        <div style="margin:0 0 18px;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-align:center;">
          <div style="font-size:11px;letter-spacing:2px;color:#64748b;font-weight:bold;">VERIFICATION CODE</div>
          <div style="margin-top:8px;font-size:32px;letter-spacing:10px;font-weight:bold;color:#1a365d;font-family:'Courier New',monospace;">${code}</div>
        </div>
        <p style="margin:0 0 18px;">The code expires in ${minutes} minutes. Enter it on the booking page to verify your address and upload your ID documents.</p>
        <p style="margin:0;color:#64748b;font-size:12px;">If you did not start a booking with us, you can safely ignore this message.</p>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;color:#94a3b8;font-size:11px;">
        This is an automated message — please do not reply.
      </div>
    </div>
  </div>`;

  return { subject: `${code} is your Lumina verification code`, text, html };
};

class EmailOtpService {
  /**
   * Issues a code for an address and sends it there. An address that already
   * has a live code has to wait out the cooldown, so the endpoint cannot be
   * used to send repeated mail to someone who did not ask for it.
   */
  async requestCode(rawEmail) {
    const email = normalizeEmail(rawEmail);
    assertUsableEmail(email);

    const existing = await EmailVerification.findOne({ email });

    if (existing?.lastSentAt) {
      const readyAt = new Date(existing.lastSentAt).getTime() + RESEND_COOLDOWN_SECONDS * 1000;
      const wait = Math.ceil((readyAt - Date.now()) / 1000);
      if (wait > 0) {
        const error = fail(429, `Please wait ${wait} second${wait === 1 ? '' : 's'} before requesting another code.`);
        error.retryAfterSeconds = wait;
        throw error;
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    // Nothing is written until the message is on its way, so a failed send
    // leaves any earlier code and its cooldown untouched.
    const message = buildEmail(code);
    let delivery = 'email';

    if (isMailConfigured()) {
      const result = await sendMail({ to: email, ...message });
      if (!result.sent) {
        throw fail(502, 'We could not send the verification code right now. Please try again in a moment.');
      }
    } else {
      // Without a mail account configured the code is printed here instead, so
      // the flow can still be exercised locally.
      console.log(`Email verification code for ${email}: ${code} (mail delivery is not configured)`);
      delivery = 'server-log';
    }

    await EmailVerification.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashCode(code),
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        verifiedAt: null,
        purgeAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      email,
      delivery,
      expiresInSeconds: CODE_TTL_MINUTES * 60,
      resendInSeconds: RESEND_COOLDOWN_SECONDS
    };
  }

  /**
   * Checks a code and, when it is right, returns proof the address belongs to
   * whoever is filling the form. The proof travels with the ID uploads and the
   * booking, so an address is never taken on the client's word alone.
   */
  async confirmCode(rawEmail, rawCode) {
    const email = normalizeEmail(rawEmail);
    assertUsableEmail(email);

    const code = (rawCode || '').trim();
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      throw fail(400, `Please enter the ${CODE_LENGTH} digit code from the email.`);
    }

    const record = await EmailVerification.findOne({ email });
    if (!record) {
      throw fail(400, 'Request a verification code first.');
    }

    if (secondsUntil(record.expiresAt) === 0) {
      throw fail(400, 'That code has expired. Please request a new one.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw fail(429, 'Too many incorrect attempts. Please request a new code.');
    }

    if (!codesMatch(code, record.codeHash)) {
      record.attempts += 1;
      await record.save();
      const left = MAX_ATTEMPTS - record.attempts;
      throw fail(
        400,
        left > 0
          ? `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'That code is not correct. Please request a new one.'
      );
    }

    // Spent as soon as it is used, so the same code cannot be replayed.
    record.verifiedAt = new Date();
    record.codeHash = '';
    record.expiresAt = new Date();
    await record.save();

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
