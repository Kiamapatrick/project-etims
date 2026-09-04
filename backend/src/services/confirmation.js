import mongoose from 'mongoose';
import { DocumentUpload, Sale } from '../models/index.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { parseDate } from './validator.js';
import { logConfirm, logReject, logEdit } from './auditLog.js';

function mapExtractedToSaleData(extracted, upload) {
  return {
    businessId: upload.businessId,
    cuin: extracted.cuin,
    qrCode: extracted.qrCode,
    saleDate: parseDate(extracted.date),
    totalAmount: extracted.total,
    vatAmount: extracted.vat?.amount || 0,
    lineItems: extracted.lineItems || [],
    source: 'upload',
    documentUploadId: upload._id,
    confirmedBy: null,
    confirmedAt: null,
  };
}

export async function editFile(documentUploadId, fileIndex, userId, editedData) {
  const upload = await DocumentUpload.findById(documentUploadId);
  if (!upload) throw new AppError('Batch not found', 404);

  const file = upload.files[fileIndex];
  if (!file) throw new AppError('File not found', 404);
  if (file.linkedSaleId) throw new AppError('Already confirmed', 400);

  const before = { ...file.extractedData };
  const after = { ...file.extractedData, ...editedData };

  if (editedData.date) {
    const parsed = parseDate(editedData.date);
    if (!parsed) throw new AppError('Invalid date format', 400);
    if (parsed > new Date()) throw new AppError('Date cannot be in the future', 400);
    after.date = parsed;
  }

  await DocumentUpload.updateOne(
    { _id: documentUploadId },
    { $set: { [`files.${fileIndex}.extractedData`]: after } }
  );

  await logEdit({ documentUploadId, fileIndex, saleId: file.linkedSaleId, userId, before, after });

  return { success: true, extractedData: after };
}

export async function confirmFile(documentUploadId, fileIndex, userId) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const upload = await DocumentUpload.findById(documentUploadId).session(session);
      if (!upload) throw new AppError('Batch not found', 404);
      const file = upload.files[fileIndex];
      if (!file) throw new AppError('File not found', 404);

      if (file.linkedSaleId) {
        result = { sale: await Sale.findById(file.linkedSaleId).session(session), alreadyConfirmed: true };
        return;
      }
      if (!['extracted', 'needs_review'].includes(file.status)) {
        throw new AppError(`File status '${file.status}' cannot be confirmed`, 400);
      }

      const saleData = mapExtractedToSaleData(file.extractedData, upload);
      saleData.confirmedBy = userId;
      saleData.confirmedAt = new Date();
      const [sale] = await Sale.create([saleData], { session });

      const update = await DocumentUpload.updateOne(
        { _id: documentUploadId, [`files.${fileIndex}.linkedSaleId`]: null },
        { $set: { [`files.${fileIndex}.status`]: 'confirmed', [`files.${fileIndex}.linkedSaleId`]: sale._id } },
        { session }
      );
      if (update.matchedCount === 0) throw new Error('CONCURRENT_CONFIRM');

      await logConfirm({ documentUploadId, fileIndex, saleId: sale._id, userId, before: file.extractedData, after: saleData });
      result = { sale, alreadyConfirmed: false };
    });
    return result;
  } catch (err) {
    if (err.message === 'CONCURRENT_CONFIRM') {
      const upload = await DocumentUpload.findById(documentUploadId);
      return { sale: await Sale.findById(upload.files[fileIndex].linkedSaleId), alreadyConfirmed: true };
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function bulkConfirmBatch(batchId, userId, threshold = config.extraction.confidenceThreshold) {
  const upload = await DocumentUpload.findOne({ batchId });
  if (!upload) throw new AppError('Batch not found', 404);

  const results = { confirmed: [], skipped: [], errors: [] };

  for (let i = 0; i < upload.totalFiles; i++) {
    const file = upload.files[i];
    if (file.status !== 'extracted') {
      results.skipped.push({ fileIndex: i, reason: `status=${file.status}` });
      continue;
    }
    if (file.confidenceScore < threshold) {
      results.skipped.push({ fileIndex: i, reason: `confidence ${file.confidenceScore} < ${threshold}` });
      continue;
    }
    if (file.linkedSaleId) {
      results.skipped.push({ fileIndex: i, reason: 'already confirmed' });
      continue;
    }

    try {
      const { sale } = await confirmFile(upload._id, i, userId);
      results.confirmed.push({ fileIndex: i, saleId: sale._id });
    } catch (err) {
      results.errors.push({ fileIndex: i, error: err.message, type: err.name });
    }
  }

  return results;
}

export async function rejectFile(documentUploadId, fileIndex, userId, reason) {
  if (!reason?.trim()) throw new AppError('Reject reason required', 400);

  const upload = await DocumentUpload.findById(documentUploadId);
  if (!upload) throw new AppError('Batch not found', 404);

  const file = upload.files[fileIndex];
  if (!file) throw new AppError('File not found', 404);
  if (file.linkedSaleId) throw new AppError('Already confirmed', 400);

  await DocumentUpload.updateOne(
    { _id: documentUploadId },
    { $set: { [`files.${fileIndex}.status`]: 'rejected', [`files.${fileIndex}.rejectReason`]: reason } }
  );

  await logReject({ documentUploadId, fileIndex, userId, reason });

  return { success: true };
}