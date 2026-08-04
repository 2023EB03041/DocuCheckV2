import nodemailer from 'nodemailer';

// Mail is sent over plain SMTP, so any provider works without changing code —
// Brevo, Mailtrap, Amazon SES, or a Gmail account with an app password. The
// host, credentials and sender address all come from the environment.
const DEFAULT_PORT = 587;
const DEFAULT_SENDER_NAME = 'Lumina Resort & Spa';

// A provider that stops responding must not hold the guest's request open.
const CONNECTION_TIMEOUT_MS = 15000;

let transport = null;

/**
 * True once a host and credentials are present. Without them nothing is sent
 * and the caller falls back to printing the code in the server log, which keeps
 * local development usable without a mail account.
 */
export const isMailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Port 465 is implicit TLS; every other port starts in the clear and upgrades
// with STARTTLS. SMTP_SECURE overrides this for a provider that differs.
const usesImplicitTls = (port) => {
  const override = (process.env.SMTP_SECURE || '').toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  return port === 465;
};

// Built once and reused; nodemailer keeps the connection pool internally.
const getTransport = () => {
  if (transport) return transport;

  const port = Number(process.env.SMTP_PORT) || DEFAULT_PORT;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: usesImplicitTls(port),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: CONNECTION_TIMEOUT_MS
  });

  return transport;
};

// Providers reject a sender they have not had verified, so the from address
// defaults to the account the server signs in with.
const getSender = () => {
  const address = process.env.MAIL_FROM || process.env.SMTP_USER;
  const name = process.env.MAIL_FROM_NAME || DEFAULT_SENDER_NAME;
  return `${name} <${address}>`;
};

/**
 * Sends one message. Returns whether it left the server; the caller decides
 * what to tell the guest, since a delivery failure must not read as success.
 */
export const sendMail = async ({ to, subject, text, html }) => {
  if (!isMailConfigured()) {
    return { sent: false, reason: 'Mail delivery is not configured on this server.' };
  }

  try {
    await getTransport().sendMail({ from: getSender(), to, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error('Mail delivery error:', error.message);
    return { sent: false, reason: 'The message could not be delivered.' };
  }
};
