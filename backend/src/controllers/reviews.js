import { DocumentUpload } from '../models/index.js';
import { generatePresignedDownloadUrl } from '../services/s3.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listBatches(req, res, next) {
  try {
    const { businessId, status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (businessId) filter.businessId = businessId;
    if (status) filter.status = { $in: status.split(',') };
    else filter.status = { $in: ['completed', 'needs_review', 'partial'] };
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const uploads = await DocumentUpload.find(filter)
      .populate('businessId', 'name pin')
      .populate('uploadedBy', 'email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await DocumentUpload.countDocuments(filter);

    const batches = uploads.map(upload => ({
      batchId: upload.batchId,
      documentUploadId: upload._id,
      business: upload.businessId,
      uploadedBy: upload.uploadedBy,
      status: upload.status,
      totalFiles: upload.totalFiles,
      extractedCount: upload.files.filter(f => f.status === 'extracted').length,
      needsReviewCount: upload.files.filter(f => f.status === 'needs_review').length,
      rejectedCount: upload.files.filter(f => f.status === 'rejected').length,
      failedCount: upload.files.filter(f => f.status === 'failed').length,
      createdAt: upload.createdAt,
      processingCompletedAt: upload.processingCompletedAt,
    }));

    res.json({
      status: 'success',
      batches,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getBatchDetail(req, res, next) {
  try {
    const { batchId } = req.params;
    const upload = req.batchUpload || await DocumentUpload.findOne({ batchId })
      .populate('businessId', 'name pin')
      .populate('uploadedBy', 'email');

    if (!upload) throw new AppError('Batch not found', 404);

    const files = await Promise.all(upload.files.map(async (file, index) => {
      const viewUrl = await generatePresignedDownloadUrl(file.s3Key, 3600);
      return {
        fileIndex: index,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        status: file.status,
        extractedData: file.extractedData,
        confidenceScore: file.confidenceScore,
        errorMessage: file.errorMessage,
        rejectReason: file.rejectReason,
        linkedSaleId: file.linkedSaleId,
        viewUrl,
      };
    }));

    res.json({
      status: 'success',
      batch: {
        batchId: upload.batchId,
        documentUploadId: upload._id,
        business: upload.businessId,
        uploadedBy: upload.uploadedBy,
        status: upload.status,
        totalFiles: upload.totalFiles,
        processedFiles: upload.processedFiles,
        createdAt: upload.createdAt,
        processingStartedAt: upload.processingStartedAt,
        processingCompletedAt: upload.processingCompletedAt,
        files,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function editFile(req, res, next) {
  try {
    const { documentUploadId, fileIndex } = req.params;
    const { editData } = req.body;
    const userId = req.user._id;

    const { editFile: editFileService } = await import('../services/confirmation.js');
    const result = await editFileService(documentUploadId, parseInt(fileIndex, 10), userId, editData);

    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function confirmFile(req, res, next) {
  try {
    const { documentUploadId, fileIndex } = req.params;
    const userId = req.user._id;

    const { confirmFile: confirmFileService } = await import('../services/confirmation.js');
    const result = await confirmFileService(documentUploadId, parseInt(fileIndex, 10), userId);

    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function bulkConfirmBatch(req, res, next) {
  try {
    const { batchId } = req.params;
    const userId = req.user._id;
    const { threshold } = req.body;

    const { bulkConfirmBatch: bulkConfirmBatchService } = await import('../services/confirmation.js');
    const result = await bulkConfirmBatchService(batchId, userId, threshold);

    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function rejectFile(req, res, next) {
  try {
    const { documentUploadId, fileIndex } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const { rejectFile: rejectFileService } = await import('../services/confirmation.js');
    const result = await rejectFileService(documentUploadId, parseInt(fileIndex, 10), userId, reason);

    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLog(req, res, next) {
  try {
    const { documentUploadId, fileIndex } = req.params;

    const { getAuditLog: getAuditLogService } = await import('../services/auditLog.js');
    const logs = await getAuditLogService(documentUploadId, parseInt(fileIndex, 10));

    res.json({ status: 'success', auditLog: logs });
  } catch (err) {
    next(err);
  }
}