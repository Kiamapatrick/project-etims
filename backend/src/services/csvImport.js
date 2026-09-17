import { parse as parseCsvSync } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { randomUUID as uuidv4 } from 'crypto';
import { DocumentUpload } from '../models/index.js';
import { uploadBufferToS3 } from './s3.js';
import { validateExtraction, parseAmount, parseDate } from './validator.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

// Flexible header aliases -> canonical field name. Headers are matched
// case-insensitively with spaces/underscores/hyphens stripped, so
// "Unit Price", "unit_price" and "UnitPrice" all resolve to "unitprice".
const HEADER_ALIASES = {
    date: 'date',
    saledate: 'date',
    transactiondate: 'date',
    description: 'description',
    item: 'description',
    itemdescription: 'description',
    quantity: 'quantity',
    qty: 'quantity',
    unitprice: 'unitPrice',
    price: 'unitPrice',
    vatrate: 'vatRate',
    taxrate: 'vatRate',
    vatamount: 'vatAmount',
    taxamount: 'vatAmount',
    subtotal: 'subtotal',
    total: 'total',
    totalamount: 'total',
    amount: 'total',
    cuin: 'cuin',
    sellerpin: 'sellerPin',
    pin: 'sellerPin',
    sellername: 'sellerName',
    seller: 'sellerName',
    currency: 'currency',
};

function normalizeHeader(header) {
    const key = String(header || '').trim().toLowerCase().replace(/[\s_-]/g, '');
    return HEADER_ALIASES[key] || null;
}

function normalizeRawRows(rawRows) {
    if (rawRows.length === 0) return [];
    const headers = rawRows[0].map(normalizeHeader);

    return rawRows.slice(1)
        .filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
        .map(row => {
            const record = {};
            headers.forEach((field, i) => {
                if (field) record[field] = row[i];
            });
            return record;
        });
}

async function parseCsvBuffer(buffer) {
    const rawRows = parseCsvSync(buffer, {
        skip_empty_lines: true,
        relax_column_count: true,
    });
    return normalizeRawRows(rawRows);
}

async function parseXlsxBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new AppError('Workbook has no sheets', 400);

    const rawRows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        const values = row.values.slice(1); // exceljs pads index 0
        rawRows.push(values.map(v => (v && v.text !== undefined ? v.text : v)));
    });
    return normalizeRawRows(rawRows);
}

// Builds the same shape processFile() produces in extraction.js, so it
// can be validated, confidence-scored, and confirmed identically.
function recordToExtractedData(record) {
    const quantity = parseAmount(record.quantity) ?? 1;
    const unitPrice = parseAmount(record.unitPrice);
    const vatRate = parseAmount(record.vatRate) ?? 16;
    let vatAmount = parseAmount(record.vatAmount);
    let total = parseAmount(record.total);
    let subtotal = parseAmount(record.subtotal);

    if (total === null && unitPrice !== null) {
        const lineSubtotal = quantity * unitPrice;
        vatAmount = vatAmount ?? Math.round(lineSubtotal * vatRate) / 100;
        subtotal = subtotal ?? lineSubtotal;
        total = subtotal + vatAmount;
    } else if (total !== null && vatAmount === null) {
        vatAmount = Math.round(total * vatRate / (100 + vatRate) * 100) / 100;
        subtotal = subtotal ?? Math.round((total - vatAmount) * 100) / 100;
    }

    const lineItems = [];
    if (unitPrice !== null && total !== null) {
        const amount = quantity * unitPrice;
        lineItems.push({
            description: record.description || 'Imported line item',
            quantity,
            unitPrice,
            amount,
            vatRate,
            vatAmount: vatAmount ?? 0,
            totalAmount: total,
        });
    }

    return {
        source: 'csv',
        cuin: record.cuin || null,
        qrCode: null,
        qrVerified: false,
        sellerPin: record.sellerPin || null,
        sellerName: record.sellerName || null,
        buyerPin: null,
        date: parseDate(record.date),
        lineItems,
        subtotal,
        vat: { rate: vatRate, amount: vatAmount },
        total,
        currency: record.currency || 'KES',
        confidence: 0,
        validationFlags: [],
    };
}

// Structured data starts far more trustworthy than OCR text — no glyph
// misreads possible — so the base is high and only validation failures
// pull it down, mirroring calculateConfidence() in extraction.js.
function calculateCsvConfidence(extracted, validation) {
    let score = config.csvImport.baseConfidence;
    if (extracted.cuin) score += 0.05;
    if (!validation.valid) score -= 0.35;
    if (validation.warnings.length > 0) score -= 0.1 * validation.warnings.length;
    return Math.max(0, Math.min(1, score));
}

export async function processCsvImport({ businessId, userId, buffer, mimeType, originalName }) {
    if (buffer.length > config.csvImport.maxFileSize) {
        throw new AppError('File exceeds maximum size for CSV/XLSX import', 400);
    }

    const isXlsx = mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const records = isXlsx ? await parseXlsxBuffer(buffer) : await parseCsvBuffer(buffer);

    if (records.length === 0) {
        throw new AppError('No data rows found in file', 400);
    }
    if (records.length > config.csvImport.maxRowsPerImport) {
        throw new AppError(`File has ${records.length} rows, exceeds limit of ${config.csvImport.maxRowsPerImport}`, 400);
    }

    const batchId = uuidv4();
    const ext = isXlsx ? 'xlsx' : 'csv';
    const s3Key = `csv-imports/${businessId}/${batchId}/${Date.now()}_original.${ext}`;
    await uploadBufferToS3(s3Key, buffer, mimeType);

    const files = records.map((record, index) => {
        const extractedData = recordToExtractedData(record);
        const validation = validateExtraction(extractedData);
        extractedData.validationFlags = validation.errors;
        extractedData.confidence = calculateCsvConfidence(extractedData, validation);

        const status = (extractedData.confidence >= config.extraction.confidenceThreshold && validation.valid)
            ? 'extracted'
            : 'needs_review';

        return {
            originalName: `${originalName} (row ${index + 2})`,
            storedName: s3Key.split('/').pop(),
            mimeType,
            size: buffer.length,
            s3Key,
            status,
            extractedData,
            confidenceScore: extractedData.confidence,
            sourceType: 'csv',
            rowNumber: index + 2, // +2: 1-indexed, plus header row
        };
    });

    const anyNeedsReview = files.some(f => f.status === 'needs_review');

    const documentUpload = await DocumentUpload.create({
        businessId,
        uploadedBy: userId,
        batchId,
        files,
        totalFiles: files.length,
        processedFiles: files.length,
        s3Keys: [s3Key],
        status: anyNeedsReview ? 'needs_review' : 'completed',
        processingStartedAt: new Date(),
        processingCompletedAt: new Date(),
    });

    logger.info('CSV/XLSX import processed', {
        documentUploadId: documentUpload._id,
        businessId,
        rows: files.length,
        needsReview: files.filter(f => f.status === 'needs_review').length,
    });

    return documentUpload;
}