const TEST_BASE_URL = 'https://test-api.sandbox.co.in';
const LIVE_BASE_URL = 'https://api.sandbox.co.in';

// Sent with every verification request as the stated purpose. The upstream
// contract requires at least 20 characters here.
const VERIFICATION_REASON = 'Guest identity verification for hotel check-in';

// An upstream call that stops responding must not hold the upload open.
const REQUEST_TIMEOUT_MS = 30000;

// Verification levels recorded against a guest.
export const VERIFICATION_LEVEL = {
  GOVERNMENT: 'government',
  EXTRACTION_ONLY: 'extraction-only',
  FAILED: 'failed'
};

let warnedAboutLive = false;

/**
 * Test and production each accept only their own credentials, so the target is
 * taken from the key prefix unless SANDBOX_ENV overrides it. Live keys are
 * billed per successful verification, so their use is announced once.
 */
const getBaseUrl = () => {
  const override = (process.env.SANDBOX_ENV || '').toLowerCase();
  const key = process.env.SANDBOX_API_KEY || '';

  let live;
  if (override === 'production') live = true;
  else if (override === 'test') live = false;
  else live = key.startsWith('key_live');

  if (live && !warnedAboutLive) {
    warnedAboutLive = true;
    console.warn('Verification is using live credentials — each successful check is billed.');
  }

  return live ? LIVE_BASE_URL : TEST_BASE_URL;
};

const isConfigured = () => {
  return !!(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
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
      reason: VERIFICATION_REASON
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
 * Document types that can be confirmed against a government record without the
 * holder completing a consent step. Aadhaar requires an OTP sent to the number
 * registered with UIDAI, and driving licence and passport are not available, so
 * those are recorded as read-but-unconfirmed rather than being checked here.
 */
const VERIFIERS = {
  pan: verifyPan
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
