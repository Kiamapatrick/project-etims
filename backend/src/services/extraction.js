import { DocumentUpload } from '../models/index.js';
import { downloadFromS3 } from './s3.js';
import { prepareImageForExtraction } from './imageProcessor.js';
import { decodeQrFromBuffer, extractCUIFromQR } from './qrDecoder.js';
import { extractTextFromBuffer } from './ocr.js';
import { validateExtraction, parseAmount, parseDate } from './validator.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

function parseOcrText(text, cuin) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    source: 'ocr',
    cuin,
    qrVerified: !!cuin,
    sellerPin: null,
    sellerName: null,
    buyerPin: null,
    date: null,
    lineItems: [],
    subtotal: null,
    vat: { rate: null, amount: null },
    total: null,
    currency: 'KES',
    confidence: 0,
    validationFlags: [],
  };

  const pinPattern = /(PIN|pin)[\s:]*([A-Z0-9]{10,11})/i;
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/,
    /(\d{2}[\/\-.]\d{2}[\/\-.]\d{2})/,
  ];
  const amountPatterns = [
    /(?:total|amount|sum)[\s:]*([\d,]+\.?\d*)/i,
    /(?:vat|tax)[\s:]*([\d,]+\.?\d*)/i,
    /(?:subtotal|sub-total)[\s:]*([\d,]+\.?\d*)/i,
  ];

  for (const line of lines) {
    const pinMatch = line.match(pinPattern);
    if (pinMatch && !result.sellerPin) {
      result.sellerPin = pinMatch[2].toUpperCase();
    }

    for (const pattern of datePatterns) {
      const dateMatch = line.match(pattern);
      if (dateMatch && !result.date) {
        const parsed = parseDate(dateMatch[1]);
        if (parsed) result.date = parsed;
      }
    }

    for (const pattern of amountPatterns) {
      const amtMatch = line.match(pattern);
      if (amtMatch) {
        const val = parseAmount(amtMatch[1]);
        if (val !== null) {
          if (/total|amount|sum/i.test(pattern.source) && !result.total) result.total = val;
          else if (/vat|tax/i.test(pattern.source) && !result.vat.amount) result.vat.amount = val;
          else if (/subtotal|sub-total/i.test(pattern.source) && !result.subtotal) result.subtotal = val;
        }
      }
    }
  }

  return result;
}

function calculateConfidence(extracted, validation) {
  let score = 0.5;
  
  if (extracted.qrVerified) score += 0.3;
  if (extracted.date) score += 0.1;
  if (extracted.total) score += 0.1;
  if (extracted.lineItems?.length > 0) score += 0.1;
  if (extracted.sellerPin) score += 0.05;
  
  if (!validation.valid) score -= 0.3;
  if (validation.warnings.length > 0) score -= 0.1 * validation.warnings.length;
  
  return Math.max(0, Math.min(1, score));
}

export async function processFile(documentUploadId, fileIndex) {
  const upload = await DocumentUpload.findById(documentUploadId);
  if (!upload) {
    throw new Error(`DocumentUpload ${documentUploadId} not found`);
  }

  const file = upload.files[fileIndex];
  if (!file) {
    throw new Error(`File index ${fileIndex} not found in DocumentUpload ${documentUploadId}`);
  }

  try {
    file.status = 'processing';
    await upload.save();

    logger.info('Starting extraction', { documentUploadId, fileIndex, s3Key: file.s3Key });

    const buffer = await downloadFromS3(file.s3Key);
    const imageBuffer = await prepareImageForExtraction(buffer, file.mimeType);

    let cuin = null;
    let qrVerified = false;
    let extractedData = null;

    const qrResult = await decodeQrFromBuffer(imageBuffer);
    if (qrResult) {
      cuin = extractCUIFromQR(qrResult.data);
      if (cuin) {
        qrVerified = true;
        logger.info('QR decoded successfully', { documentUploadId, fileIndex, cuin });
      }
    }

    const ocrResult = await extractTextFromBuffer(imageBuffer);
    logger.info('OCR completed', { documentUploadId, fileIndex, confidence: ocrResult.confidence });

    extractedData = parseOcrText(ocrResult.text, cuin);
    extractedData.source = qrVerified ? 'qr' : 'ocr';
    extractedData.confidence = ocrResult.confidence;

    const validation = validateExtraction(extractedData);
    extractedData.validationFlags = validation.errors;
    extractedData.confidence = calculateConfidence(extractedData, validation);

    file.extractedData = extractedData;
    file.confidenceScore = extractedData.confidence;

    if (extractedData.confidence >= config.extraction.confidenceThreshold && validation.valid) {
      file.status = 'extracted';
    } else {
      file.status = 'needs_review';
    }

    upload.processedFiles += 1;
    if (upload.processedFiles >= upload.totalFiles) {
      const allExtracted = upload.files.every(f => f.status === 'extracted');
      const anyFailed = upload.files.some(f => f.status === 'failed');
      const anyNeedsReview = upload.files.some(f => f.status === 'needs_review');
      
      if (allExtracted) {
        upload.status = 'completed';
      } else if (anyFailed) {
        upload.status = 'partial';
      } else if (anyNeedsReview) {
        upload.status = 'completed';
      } else {
        upload.status = 'processing';
      }
      upload.processingCompletedAt = new Date();
    }

    await upload.save();
    logger.info('File processing complete', { documentUploadId, fileIndex, status: file.status, confidence: extractedData.confidence });

  } catch (err) {
    logger.error('File processing failed', { documentUploadId, fileIndex, error: err.message });
    file.status = 'failed';
    file.errorMessage = err.message;
    upload.processedFiles += 1;
    await upload.save();
    throw err;
  }
}