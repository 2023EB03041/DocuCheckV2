import { GoogleGenerativeAI as GenerativeClient, SchemaType } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Response contract enforced on the model so the reply is always parseable JSON.
const EXTRACTION_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: 'Full name of the document holder in English. Empty string if unreadable.'
    },
    dob: {
      type: SchemaType.STRING,
      description: 'Date of birth as DD/MM/YYYY. Use YYYY alone if only a year of birth is printed. Empty string if absent.'
    },
    gender: {
      type: SchemaType.STRING,
      description: 'One of Male, Female, Other. Empty string if not printed.'
    },
    idType: {
      type: SchemaType.STRING,
      description: 'One of Aadhaar, PAN, Driving Licence, Passport, Voter ID, Unknown.'
    },
    idNumber: {
      type: SchemaType.STRING,
      description: 'The document number exactly as printed. Empty string if unreadable.'
    },
    isIdDocument: {
      type: SchemaType.BOOLEAN,
      description: 'True only if the image is a genuine government-issued identity document.'
    },
    rawText: {
      type: SchemaType.STRING,
      description: 'All legible text visible on the document.'
    }
  },
  required: ['name', 'dob', 'gender', 'idType', 'idNumber', 'isIdDocument', 'rawText']
};

const EXTRACTION_PROMPT = [
  'You are reading a photograph of an Indian government-issued identity document',
  '(Aadhaar, PAN card, Driving Licence, Passport or Voter ID).',
  'Transcribe only what is actually printed on the document.',
  'Never guess, invent or complete a value you cannot clearly read — return an empty string for it instead.',
  'For Aadhaar cards the holder name is the English line directly above the date of birth;',
  'ignore the Devanagari line and never return a father\'s or mother\'s name.',
  'If the image is not an identity document, set isIdDocument to false.'
].join(' ');

let cachedClient = null;

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!cachedClient) {
    cachedClient = new GenerativeClient(apiKey);
  }
  return cachedClient;
};

const getModel = () => {
  return getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA
    }
  });
};

/**
 * Reads the magic bytes of the upload so the correct mime type is sent upstream.
 * Defaults to JPEG, which covers the vast majority of phone camera uploads.
 */
const detectMimeType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return 'image/jpeg';

  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (buffer.toString('ascii', 4, 12) === 'ftypheic') return 'image/heic';

  return 'image/jpeg';
};

/**
 * Converts a printed date of birth into an age in completed years.
 * Accepts DD/MM/YYYY (with any of / - . as separator) or a bare four digit year.
 */
const calculateAge = (dob) => {
  if (!dob || typeof dob !== 'string') return null;

  const now = new Date();
  const fullDate = dob.trim().match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);

  if (fullDate) {
    const day = parseInt(fullDate[1], 10);
    const month = parseInt(fullDate[2], 10);
    const year = parseInt(fullDate[3], 10);

    let age = now.getFullYear() - year;
    const monthDiff = now.getMonth() + 1 - month;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
      age -= 1;
    }
    return age >= 0 && age <= 120 ? age : null;
  }

  const yearOnly = dob.trim().match(/\b(19[0-9]\d|20[0-2]\d)\b/);
  if (yearOnly) {
    const age = now.getFullYear() - parseInt(yearOnly[1], 10);
    return age >= 0 && age <= 120 ? age : null;
  }

  return null;
};

const normalizeSex = (gender) => {
  const value = (gender || '').trim().toLowerCase();
  if (value.startsWith('f')) return 'Female';
  if (value.startsWith('m')) return 'Male';
  if (value) return 'Other';
  return '';
};

const titleCase = (value) => {
  return (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Sends the image upstream and returns the parsed document fields. The result
 * below summarises these, and carries the document itself so the verification
 * layer can reach the number and printed date of birth.
 */
const readDocumentFields = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error('Empty image buffer');
  }

  const model = getModel();
  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    {
      inlineData: {
        mimeType: detectMimeType(imageBuffer),
        data: imageBuffer.toString('base64')
      }
    }
  ]);

  const payload = result.response.text();
  if (!payload) {
    throw new Error('Empty response from extraction model');
  }

  const parsed = JSON.parse(payload);

  return {
    name: titleCase(parsed.name),
    dob: (parsed.dob || '').trim(),
    gender: normalizeSex(parsed.gender),
    idType: (parsed.idType || 'Unknown').trim(),
    idNumber: (parsed.idNumber || '').trim(),
    isIdDocument: parsed.isIdDocument === true,
    rawText: (parsed.rawText || '').trim()
  };
};

export const extractDocumentDetails = async (imageBuffer) => {
  try {
    const document = await readDocumentFields(imageBuffer);

    if (!document.isIdDocument) {
      return {
        success: false,
        error: 'This does not look like a government-issued ID. Please upload a clear photo of your Aadhaar or PAN card.'
      };
    }

    const extractedName = document.name;
    const extractedAge = calculateAge(document.dob);

    // Never accept an ID whose key details could not be read. The guest is asked
    // to re-upload a clearer photo rather than proceeding with blank data.
    const nameReadable = extractedName && extractedName.trim().length >= 2;
    const ageReadable = extractedAge !== null && !isNaN(extractedAge);
    if (!nameReadable || !ageReadable) {
      return {
        success: false,
        error: 'We could not clearly read the details on this ID. Please upload a sharper, better-quality photo — good lighting, no blur, and all text clearly visible.'
      };
    }

    return {
      success: true,
      extractedName,
      extractedAge,
      extractedSex: document.gender || 'Other',
      // Carried for the verification layer only. Holds the document number, so
      // it must be stripped before the result is returned over the API.
      document
    };
  } catch (error) {
    // Nothing was learned about the document itself here — the reader could not
    // be reached, or answered with something unusable. Flagged as retryable so
    // a passing outage is never mistaken for a verdict on somebody's ID.
    console.error('Document reader unavailable:', error.message);
    return {
      success: false,
      retryable: true,
      error: 'We could not read your document just now. Please try uploading it again in a moment.'
    };
  }
};
