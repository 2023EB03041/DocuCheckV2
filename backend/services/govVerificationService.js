// This integration talks only to the test environment. It answers from a fixed
// set of published sample records, so no real person's details are ever sent
// and no check is ever billed.
const TEST_BASE_URL = 'https://test-api.sandbox.co.in';

// The test environment replays saved examples and only answers a request whose
// body matches one exactly, so the stated purpose has to be the wording the
// example for that endpoint uses. Each endpoint was written up separately
// upstream, so the wording differs between them.
const TEST_REASONS = {
  aadhaar: 'For KYC',
  pan: 'For onboarding customers'
};

// An upstream call that stops responding must not hold the upload open.
const REQUEST_TIMEOUT_MS = 30000;

// Verification levels recorded against a guest.
export const VERIFICATION_LEVEL = {
  GOVERNMENT: 'government',
  EXTRACTION_ONLY: 'extraction-only',
  FAILED: 'failed'
};

const getBaseUrl = () => TEST_BASE_URL;

const getVerificationReason = (endpoint) => TEST_REASONS[endpoint];

/**
 * Only test credentials are accepted. A live key would be charged per check and
 * would send a real person's details upstream, so it is refused outright rather
 * than used by accident.
 */
const isConfigured = () => {
  const key = process.env.SANDBOX_API_KEY;
  const secret = process.env.SANDBOX_API_SECRET;
  if (!key || !secret) return false;

  if (key.startsWith('key_live') || secret.startsWith('secret_live')) {
    console.warn('Refusing to verify: live credentials are configured, but only test credentials are supported.');
    return false;
  }

  return true;
};

// Access tokens are valid for 24 hours, so they are held in memory and reused.
let tokenCache = { token: null, expiresAt: 0 };

const getAccessToken = async () => {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const response = await fetch(`${getBaseUrl()}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SANDBOX_API_KEY,
      'x-api-secret': process.env.SANDBOX_API_SECRET,
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const body = await response.json().catch(() => ({}));
  const token = body?.data?.access_token;

  if (!response.ok || !token) {
    throw new Error(`Authentication failed (HTTP ${response.status})`);
  }

  // Refreshed an hour early so a request never carries an expiring token.
  tokenCache = { token, expiresAt: now + 23 * 60 * 60 * 1000 };
  return token;
};

/**
 * Normalises a printed date of birth to the DD/MM/YYYY the upstream API expects.
 * Returns an empty string when only a year of birth was printed, since a partial
 * date cannot be checked.
 */
const formatDateOfBirth = (dob) => {
  const match = (dob || '').trim().match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (!match) return '';

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${day}/${month}/${match[3]}`;
};

const normalizePan = (idNumber) => {
  const candidate = (idNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(candidate) ? candidate : '';
};

const normalizeAadhaar = (idNumber) => {
  const digits = (idNumber || '').replace(/\D/g, '');
  return /^[0-9]{12}$/.test(digits) ? digits : '';
};

/**
 * Compares a name held by an authority with the one printed on the document.
 * Matching on parts keeps middle names and initials from failing a genuine
 * card, while still catching a different person entirely.
 */
const namesAgree = (officialName, documentName) => {
  const parts = (documentName || '').toLowerCase().split(/\s+/).filter(p => p.length > 2);
  if (!parts.length) return false;

  const official = (officialName || '').toLowerCase();
  return parts.filter(part => official.includes(part)).length / parts.length >= 0.5;
};

const sameDate = (a, b) => {
  const digits = value => (value || '').replace(/\D/g, '');
  const left = digits(a);
  const right = digits(b);
  return left.length === 8 && left === right;
};

const postJson = async (path, body) => {
  const token = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'x-api-key': process.env.SANDBOX_API_KEY,
      'x-api-version': '2.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  return { ok: response.ok, status: response.status, payload: await response.json().catch(() => ({})) };
};

/**
 * Checks an Aadhaar against the UIDAI record. UIDAI only releases details
 * against a one time password, so the server can complete this on its own
 * only where that password is a known fixed value, which is the case in the
 * test environment. Without one the document is reported as unconfirmed
 * rather than being waved through.
 */
const verifyAadhaar = async ({ idNumber, name, dob }) => {
  const aadhaar = normalizeAadhaar(idNumber);
  if (!aadhaar) {
    return {
      checked: false,
      verified: false,
      remarks: 'Aadhaar number could not be read from the document.'
    };
  }

  const otp = process.env.AADHAAR_DEV_OTP;
  if (!otp) {
    return {
      checked: false,
      verified: false,
      remarks: 'Aadhaar cannot be confirmed automatically — UIDAI requires a one-time password sent to the registered mobile number.'
    };
  }

  const requested = await postJson('/kyc/aadhaar/okyc/otp', {
    '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
    aadhaar_number: aadhaar,
    consent: 'y',
    reason: getVerificationReason('aadhaar')
  });

  const referenceId = requested.payload?.data?.reference_id;
  if (!requested.ok || !referenceId) {
    return {
      checked: false,
      verified: false,
      remarks: `This Aadhaar could not be checked (HTTP ${requested.status}).`
    };
  }

  // An unknown Aadhaar is still answered with a reference id, so the message
  // has to be read before treating the number as one worth confirming.
  const requestMessage = requested.payload?.data?.message || '';
  if (/invalid aadhaar/i.test(requestMessage)) {
    return {
      checked: true,
      verified: false,
      remarks: 'UIDAI does not recognise this Aadhaar number.'
    };
  }

  const confirmed = await postJson('/kyc/aadhaar/okyc/otp/verify', {
    '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
    reference_id: String(referenceId),
    otp: String(otp)
  });

  if (!confirmed.ok) {
    return {
      checked: false,
      verified: false,
      remarks: `This Aadhaar could not be confirmed (HTTP ${confirmed.status}).`
    };
  }

  const holder = confirmed.payload?.data || {};

  // A one time password that was wrong, expired or still being processed is
  // answered with an ordinary success status carrying only a message. None of
  // these say anything about the card, so the guest is not failed for them.
  if ((holder.status || '').toUpperCase() !== 'VALID') {
    return {
      checked: false,
      verified: false,
      remarks: holder.message
        ? `Aadhaar could not be confirmed: ${holder.message}.`
        : 'Aadhaar could not be confirmed by UIDAI.'
    };
  }

  const nameMatches = namesAgree(holder.name, name);
  const dobKnown = !!holder.date_of_birth && !!dob;
  const dobMatches = dobKnown ? sameDate(holder.date_of_birth, dob) : true;
  const verified = !!holder.name && nameMatches && dobMatches;

  let remarks;
  if (!holder.name) {
    remarks = 'UIDAI returned no details for this Aadhaar.';
  } else if (!nameMatches) {
    remarks = 'The name held by UIDAI does not match the name on this card.';
  } else if (!dobMatches) {
    remarks = 'The date of birth held by UIDAI does not match this card.';
  } else {
    remarks = 'Aadhaar confirmed against the UIDAI record.';
  }

  return {
    checked: true,
    verified,
    remarks,
    transactionId: confirmed.payload?.transaction_id || null,
    details: {
      nameMatch: nameMatches,
      dateOfBirthMatch: dobMatches
    }
  };
};

/**
 * Checks a PAN against the Income Tax department record, confirming that the
 * card exists and that the name and date of birth printed on it match.
 */
const verifyPan = async ({ idNumber, name, dob }) => {
  const pan = normalizePan(idNumber);
  if (!pan) {
    return {
      checked: false,
      verified: false,
      remarks: 'PAN number could not be read from the document.'
    };
  }

  const dateOfBirth = formatDateOfBirth(dob);
  if (!dateOfBirth) {
    return {
      checked: false,
      verified: false,
      remarks: 'A full date of birth is required to check this PAN.'
    };
  }

  const token = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}/kyc/pan/verify`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'x-api-key': process.env.SANDBOX_API_KEY,
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.pan_verification.request',
      pan,
      name_as_per_pan: name,
      date_of_birth: dateOfBirth,
      consent: 'Y',
      reason: getVerificationReason('pan')
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      checked: false,
      verified: false,
      remarks: `Government check unavailable (HTTP ${response.status}).`
    };
  }

  const data = body?.data || {};
  // The match flags are read under both the documented and the short field
  // names, so a rename upstream cannot turn into a silent verification failure.
  const isValid = (data.status || '').toLowerCase() === 'valid';
  const nameMatches = (data.name_as_per_pan_match ?? data.name_match) === true;
  const dobMatches = (data.date_of_birth_match ?? data.dob_match) === true;
  const verified = isValid && nameMatches && dobMatches;

  let remarks;
  if (!isValid) {
    remarks = 'This PAN is not recognised by the Income Tax department.';
  } else if (!nameMatches) {
    remarks = 'The name on this PAN does not match the name on the card.';
  } else if (!dobMatches) {
    remarks = 'The date of birth on this PAN does not match the card.';
  } else {
    remarks = 'PAN confirmed against the Income Tax department record.';
  }

  return {
    checked: true,
    verified,
    remarks,
    transactionId: body?.transaction_id || null,
    details: {
      status: data.status || null,
      category: data.category || null,
      nameMatch: nameMatches,
      dateOfBirthMatch: dobMatches
    }
  };
};

/**
 * Document types that can be checked from the details on the card alone.
 * Driving licence, passport and voter ID have no record to query, so they are
 * recorded as read-but-unconfirmed rather than being checked here.
 */
const VERIFIERS = {
  pan: verifyPan,
  aadhaar: verifyAadhaar
};

const normalizeIdType = (idType) => {
  const value = (idType || '').toLowerCase();
  if (value.includes('pan')) return 'pan';
  if (value.includes('aadha')) return 'aadhaar';
  if (value.includes('driv') || value.includes('licen')) return 'driving_licence';
  if (value.includes('passport')) return 'passport';
  if (value.includes('voter') || value.includes('epic')) return 'voter_id';
  return 'unknown';
};

const UNSUPPORTED_REMARKS = {
  aadhaar: 'Aadhaar cannot be confirmed automatically — UIDAI requires a one-time password sent to the registered mobile number.',
  driving_licence: 'Driving licence records are not available for automatic confirmation.',
  passport: 'Passport records are not available for automatic confirmation.',
  voter_id: 'Voter ID records are not available for automatic confirmation.',
  unknown: 'The document type could not be identified, so no government check was possible.'
};

/**
 * Runs the appropriate government check for an extracted document and reports
 * how strongly the identity could be established. A document that cannot be
 * checked is reported as extraction-only rather than as a failure, so the
 * caller can record the difference.
 */
export const verifyAgainstGovernmentRecord = async (document) => {
  const idType = normalizeIdType(document?.idType);

  if (!isConfigured()) {
    return {
      level: VERIFICATION_LEVEL.EXTRACTION_ONLY,
      idType,
      checked: false,
      verified: false,
      remarks: 'Government verification is not configured on this server.'
    };
  }

  const verifier = VERIFIERS[idType];
  if (!verifier) {
    return {
      level: VERIFICATION_LEVEL.EXTRACTION_ONLY,
      idType,
      checked: false,
      verified: false,
      remarks: UNSUPPORTED_REMARKS[idType] || UNSUPPORTED_REMARKS.unknown
    };
  }

  try {
    const result = await verifier({
      idNumber: document.idNumber,
      name: document.name,
      dob: document.dob
    });

    if (!result.checked) {
      return {
        level: VERIFICATION_LEVEL.EXTRACTION_ONLY,
        idType,
        checked: false,
        verified: false,
        remarks: result.remarks
      };
    }

    return {
      level: result.verified ? VERIFICATION_LEVEL.GOVERNMENT : VERIFICATION_LEVEL.FAILED,
      idType,
      checked: true,
      verified: result.verified,
      remarks: result.remarks,
      transactionId: result.transactionId,
      details: result.details
    };
  } catch (error) {
    console.error('Government verification error:', error.message);
    return {
      level: VERIFICATION_LEVEL.EXTRACTION_ONLY,
      idType,
      checked: false,
      verified: false,
      remarks: 'Government verification is temporarily unavailable.'
    };
  }
};
