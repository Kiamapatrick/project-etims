import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { randomUUID as uuidv4 } from 'crypto';
import { DocumentUpload } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessAccess } from '../middleware/accessControl.js';
import { requireBatchAccess } from '../middleware/batchAccess.js';
import { generatePresignedUploadUrl, generateS3Key } from '../services/s3.js';
import { addExtractionJob } from '../queues/extractionQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'fail', message: 'Too many upload requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);
router.use(uploadLimiter);

router.post('/batch', requireBusinessAccess, async (req, res, next) => {
  try {
    const { businessId, files } = req.body;

    if (!businessId || !files || !Array.isArray(files) || files.length === 0) {
      throw new AppError('businessId and files array are required', 400);
    }

    if (files.length > config.upload.maxFilesPerBatch) {
      throw new AppError(`Maximum ${config.upload.maxFilesPerBatch} files per batch`, 400);
    }

    for (const file of files) {
      if (!file.name || !file.type || !file.size) {
        throw new AppError('Each file must have name, type, and size', 400);
      }
      if (!config.upload.allowedMimeTypes.includes(file.type)) {
        throw new AppError(`File type ${file.type} not allowed`, 400);
      }
      if (file.size > config.upload.maxFileSize) {
        throw new AppError(`File ${file.name} exceeds maximum size`, 400);
      }
    }

    const batchId = uuidv4();
    const uploadUrls = [];

    const uploadFiles = files.map((file, index) => {
      const s3Key = generateS3Key(businessId, batchId, index, file.name);
      uploadUrls.push({ fileIndex: index, fileName: file.name, s3Key });
      return {
        originalName: file.name,
        storedName: s3Key.split('/').pop(),
        mimeType: file.type,
        size: file.size,
        s3Key,
        status: 'pending',
      };
    });

    const presignedUrls = await Promise.all(
      uploadUrls.map(({ s3Key }) => 
        generatePresignedUploadUrl(s3Key, uploadFiles.find(f => f.s3Key === s3Key)?.mimeType || 'application/octet-stream')
      )
    );

    const documentUpload = await DocumentUpload.create({
      businessId,
      uploadedBy: req.user._id,
      batchId,
      files: uploadFiles,
      totalFiles: files.length,
      s3Keys: uploadFiles.map(f => f.s3Key),
    });

    const responseUrls = uploadUrls.map((u, i) => ({
      fileIndex: u.fileIndex,
      fileName: u.fileName,
      s3Key: u.s3Key,
      uploadUrl: presignedUrls[i],
    }));

    res.status(201).json({
      status: 'success',
      batchId,
      documentUploadId: documentUpload._id,
      uploadUrls: responseUrls,
      expiresIn: config.s3.presignedUrlExpiry,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/batch/:batchId/complete', requireBatchAccess, async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const upload = await DocumentUpload.findOne({ batchId });
    if (!upload) {
      throw new AppError('Batch not found', 404);
    }

    if (upload.status !== 'pending') {
      throw new AppError('Batch already processed', 400);
    }

    upload.status = 'processing';
    upload.processingStartedAt = new Date();
    await upload.save();

    const jobs = [];
    for (let i = 0; i < upload.totalFiles; i++) {
      const job = await addExtractionJob(upload._id.toString(), i);
      jobs.push(job.id);
    }

    res.json({
      status: 'success',
      message: 'Extraction jobs queued',
      batchId,
      jobIds: jobs,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/batch/:batchId/status', requireBatchAccess, async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const upload = await DocumentUpload.findOne({ batchId })
      .populate('businessId', 'name pin')
      .populate('uploadedBy', 'email');

    if (!upload) {
      throw new AppError('Batch not found', 404);
    }

    const files = upload.files.map((file, index) => ({
      fileIndex: index,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      extractedData: file.extractedData,
      confidenceScore: file.confidenceScore,
      errorMessage: file.errorMessage,
    }));

    const completedFiles = upload.files.filter(f => f.status === 'extracted' || f.status === 'needs_review').length;
    const failedFiles = upload.files.filter(f => f.status === 'failed').length;
    const pendingFiles = upload.files.filter(f => f.status === 'pending' || f.status === 'processing').length;

    res.json({
      status: 'success',
      batch: {
        batchId: upload.batchId,
        documentUploadId: upload._id,
        businessId: upload.businessId,
        uploadedBy: upload.uploadedBy,
        status: upload.status,
        totalFiles: upload.totalFiles,
        processedFiles: upload.processedFiles,
        completedFiles,
        failedFiles,
        pendingFiles,
        createdAt: upload.createdAt,
        processingStartedAt: upload.processingStartedAt,
        processingCompletedAt: upload.processingCompletedAt,
        files,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireBusinessAccess, async (req, res, next) => {
  try {
    const { businessId, status, limit = 20, offset = 0 } = req.query;
    const filter = {};
    if (businessId) filter.businessId = businessId;
    if (status) filter.status = status;

    const uploads = await DocumentUpload.find(filter)
      .populate('businessId', 'name pin')
      .populate('uploadedBy', 'email')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await DocumentUpload.countDocuments(filter);

    res.json({
      status: 'success',
      uploads,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;