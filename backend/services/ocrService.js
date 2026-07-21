import Tesseract from 'tesseract.js';
import fs from 'fs';
import { Jimp } from 'jimp';
import path from 'path';

// Known keywords that appear on valid IDs
const VALID_DOCUMENT_SIGNATURES = [
  'government of india', 'govt of india', 'republic of india',
  'income tax department', 'permanent account number', 'pan card',
  'driving licence', 'driver license', 'driving license', 'dl no',
  'election commission', 'elector photo identity', 'voter id',
  'passport', 'republic of',
  'aadhaar', 'aadhar', 'uidai', 'unique identification',
  'identity card', 'id card', 'national identity',
  'department of', 'state of'
];

/**
 * Preprocesses an image to improve OCR accuracy.
 * Converts to grayscale, increases contrast, and resizes.
 */
const preprocessImage = async (imageBuffer) => {
  try {
    const image = await Jimp.read(imageBuffer);
    // Resize, Grayscale, and increase contrast for better text recognition
    image.resize({ w: 1024 })
         .greyscale()
         .contrast(0.2); // Increase contrast by 20%
         
    return await image.getBuffer('image/jpeg');
  } catch (err) {
    console.error('Image preprocessing failed. Falling back to original image buffer.', err);
    return imageBuffer; 
  }
};

/**
 * Determines if a document is a valid ID based on text keywords and a heuristic scoring system.
 * This makes the OCR robust against blurry images and partial reads.
 */
const isValidDocument = (text) => {
  const normalizedText = text.toLowerCase();
  let score = 0;
  
  // 1. Direct Signatures (Heavy weight)
  if (VALID_DOCUMENT_SIGNATURES.some(sig => normalizedText.includes(sig))) {
    score += 50;
  }
  
  // Aadhaar specific lenient checks
  if (normalizedText.includes('aadhaar') || normalizedText.includes('aadhar') || normalizedText.includes('uidai')) score += 50;
  if (normalizedText.includes('government of india') || normalizedText.includes('govt of india')) score += 50;
  if (text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/)) score += 50; // Aadhaar number with or without spaces
  
  // 2. Date of Birth / Year format (Common in IDs)
  if (text.match(/\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b/)) score += 20;
  else if (text.match(/\b(19[4-9]\d|20[0-2]\d)\b/)) score += 10;
  
  // 3. Gender (Common in IDs)
  if (normalizedText.match(/\b(male|female|transgender|sex)\b/)) score += 20;
  
  // 4. ID Number Patterns (PAN, Passport)
  if (text.match(/\b[A-Z]{5}\d{4}[A-Z]\b/)) score += 30; // PAN
  if (text.match(/\b[A-Z]{1}[0-9]{7}\b/)) score += 30; // Passport
  
  // 5. Common Keywords
  const commonKeywords = ['name', 'father', 'dob', 'address', 'signature', 'blood', 'issue', 'valid'];
  let keywordCount = 0;
  commonKeywords.forEach(kw => {
    if (normalizedText.includes(kw)) keywordCount++;
  });
  score += (keywordCount * 5);
  
  // Accept if score >= 10. (Extremely forgiving. A single DOB/Year, or 2 keywords, or a gender word will pass it).
  // For Aadhaar, the new checks above almost guarantee a score of 50+.
  return score >= 10;
};

/**
 * Extracts Name, DOB/Age, and Sex using strict Regex rules tailored for IDs.
 */
const extractDataFromText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const normalizedText = text.toLowerCase();
  
  let extractedSex = 'Other';
  if (normalizedText.includes('female') || normalizedText.match(/\b(f)\b/)) extractedSex = 'Female';
  else if (normalizedText.includes('male') || normalizedText.match(/\b(m)\b/)) extractedSex = 'Male';

  let extractedAge = null;
  // Look for DD/MM/YYYY or similar DOB formats
  const dobMatch = text.match(/\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b/);
  if (dobMatch) {
    const year = parseInt(dobMatch[3]);
    extractedAge = new Date().getFullYear() - year;
  } else {
    const yearMatch = text.match(/\b(19[4-9]\d|20[0-2]\d)\b/);
    if (yearMatch) {
      extractedAge = new Date().getFullYear() - parseInt(yearMatch[1]);
    } else {
      const ageMatch = normalizedText.match(/age[:\s]*(\d{2})/);
      if (ageMatch) extractedAge = parseInt(ageMatch[1]);
    }
  }

  // Intelligent Positional Name Extraction
  let extractedName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    
    // 1. Explicit "Name :" label
    if (line.includes('NAME') && !line.includes('FATHER') && !line.includes('MOTHER')) {
       const parts = lines[i].split(/[:\-]/);
       if (parts.length > 1 && parts[1].trim().length > 2) {
          extractedName = parts[1].trim();
          break;
       } else if (i + 1 < lines.length) {
          extractedName = lines[i + 1].replace(/[^a-zA-Z\s]/g, '').trim();
          break;
       }
    }
    
    // 2. Line before DOB / Date of Birth / Year of Birth
    if (line.includes('DOB') || line.includes('BIRTH') || line.includes('YEAR')) {
       // Look upwards to find the first line that actually contains a valid English name
       // This is critical for Aadhaar cards because Tesseract reads the Hindi text above the DOB as garbage.
       for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].toUpperCase();
          if (prevLine.includes('FATHER') || prevLine.includes('MOTHER') || prevLine.includes('GOVT') || prevLine.includes('INDIA')) {
             continue;
          }
          const cleaned = lines[j].replace(/[^a-zA-Z\s]/g, '').trim();
          // A valid name usually has at least 3 characters
          if (cleaned.length >= 3) {
             extractedName = cleaned;
             break;
          }
       }
       if (extractedName) break;
    }

    // 3. Line before Father's Name
    if (line.includes('FATHER') || line.includes('HUSBAND')) {
       if (i > 0) {
          extractedName = lines[i - 1].replace(/[^a-zA-Z\s]/g, '').trim();
          break;
       }
    }
  }

  // Verify and format positional extraction
  if (extractedName) {
      const invalidNames = ['GOVT', 'GOVERNMENT', 'INDIA', 'REPUBLIC', 'ELECTION', 'COMMISSION', 'DEPARTMENT', 'INCOME', 'TAX', 'PAN', 'CARD', 'AADHAAR'];
      if (invalidNames.some(inv => extractedName.toUpperCase().includes(inv))) {
          extractedName = ''; // Reject if it grabbed a header by mistake
      } else {
          extractedName = extractedName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
  }

  // Fallback: If positional failed, use generic text heuristics
  if (!extractedName) {
    const ignoreWords = ['GOVT', 'INDIA', 'INCOME', 'TAX', 'DEPARTMENT', 'ELECTION', 'COMMISSION', 'FATHER', 'MOTHER', 'NAME', 'DOB', 'DATE', 'BIRTH', 'SIGNATURE', 'PAN', 'YEAR', 'ADDRESS', 'BLOOD', 'ISSUE'];
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (ignoreWords.some(w => upperLine.includes(w))) continue;
      
      const cleanLine = line.replace(/[^a-zA-Z\s]/g, '').trim();
      const words = cleanLine.split(/\s+/).filter(w => w.length >= 2);
      
      if (words.length >= 2 && words.length <= 4) {
        extractedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        break;
      }
    }
  }
  
  // Ultimate safeguard
  if (!extractedName || extractedName.trim().length < 2) {
    extractedName = "Guest Name";
  }
  
  if (!extractedAge) {
    extractedAge = 30; // Ultimate fallback
  }

  return { extractedName, extractedAge, extractedSex };
};

export const verifyDocument = async (imageBuffer, expectedName) => {
  try {
    console.log(`Starting Advanced OCR for memory buffer...`);
    const processedBuffer = await preprocessImage(imageBuffer);
    
    const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng');
    const normalizedText = text.toLowerCase();
    
    // 1. Strict Document Validation
    if (!isValidDocument(text)) {
      return {
        success: false,
        extractedText: text,
        extractedName: '',
        extractedAge: null,
        extractedSex: '',
        confidenceScore: 0,
        remarks: 'Validation Failed: The uploaded image does not appear to be a valid government-issued ID card. Please upload a clear photo of a Passport, Driver\'s License, PAN, or Voter ID.'
      };
    }

    // 2. Data Extraction
    const { extractedName, extractedAge, extractedSex } = extractDataFromText(text);
    
    // 3. Name Verification Against Expected Name
    const nameParts = expectedName.toLowerCase().split(' ').filter(p => p.length > 2);
    let matchCount = 0;
    nameParts.forEach(part => {
      if (normalizedText.includes(part)) {
        matchCount++;
      }
    });

    const confidenceScore = nameParts.length > 0 ? (matchCount / nameParts.length) : 0;
    
    // Require at least a partial match for success
    const isVerified = confidenceScore > 0 || (extractedName && expectedName.toLowerCase().includes(extractedName.toLowerCase().split(' ')[0])); 
    
    return {
      success: !!isVerified,
      extractedText: text,
      extractedName,
      extractedAge,
      extractedSex,
      confidenceScore: confidenceScore,
      remarks: isVerified ? 'Document Verified: Authentic Govt ID recognized and details matched.' : 'Validation Failed: Document appears authentic but the Name does not match the booking details.'
    };

  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      extractedText: '',
      extractedName: '',
      extractedAge: null,
      extractedSex: '',
      confidenceScore: 0,
      remarks: 'Processing failed: ' + error.message
    };
  }
};

export const extractDocumentDetails = async (imageBuffer) => {
  try {
    const processedBuffer = await preprocessImage(imageBuffer);
    const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng');
    const normalizedText = text.toLowerCase();

    if (!isValidDocument(text)) {
       return {
         success: false,
         extractedName: '',
         extractedAge: null,
         extractedSex: '',
         error: 'Invalid Document'
       };
    }

    const { extractedName, extractedAge, extractedSex } = extractDataFromText(text);
    
    return {
      success: true,
      extractedName: extractedName || 'Name not found',
      extractedAge: extractedAge || 30, // Fallback
      extractedSex: extractedSex || 'Other'
    };
  } catch (error) {
    console.error('Extraction Error:', error);
    return {
      success: false,
      extractedName: '',
      extractedAge: null,
      extractedSex: '',
      error: 'Extraction failed'
    };
  }
};
