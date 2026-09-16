import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessAccess } from '../middleware/accessControl.js';
import { requireBatchAccess } from '../middleware/batchAccess.js';
import { processCsvImport } from '../services/csvImport.js';
import { DocumentUpload } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.csvImport.maxFileSize },
});

const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { status: 'fail', message: 'Too many import requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(authenticate);
router.use(importLimiter);

router.post('/', requireBusinessAccess, upload.single('file'), async (req, res, next) => {
    try {
        const { businessId } = req.body;
        if (!req.file) {
            throw new AppError('file is required (multipart field "file")', 400);
        }
        if (!config.csvImport.allowedMimeTypes.includes(req.file.mimetype)) {
            throw new AppError(`File type ${req.file.mimetype} not allowed for CSV/XLSX import`, 400);
        }

        const documentUpload = await processCsvImport({
            businessId,
            userId: req.user._id,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
        });

        const summary = {
            extracted: documentUpload.files.filter(f => f.status === 'extracted').length,
            needsReview: documentUpload.files.filter(f => f.status === 'needs_review').length,
        };

        res.status(201).json({
            status: 'success',
            batchId: documentUpload.batchId,
            documentUploadId: documentUpload._id,
            totalRows: documentUpload.totalFiles,
            summary,
        });
    } catch (err) {
        next(err);
    }
});

// Same shape as GET /api/uploads/batch/:batchId/status — reused so the
// existing review dashboard needs no changes to display CSV batches too.
router.get('/batch/:batchId/status', requireBatchAccess, async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const upload = await DocumentUpload.findOne({ batchId })
            .populate('businessId', 'name pin')
            .populate('uploadedBy', 'email');

        if (!upload) throw new AppError('Batch not found', 404);

        res.json({
            status: 'success',
            batch: {
                batchId: upload.batchId,
                documentUploadId: upload._id,
                businessId: upload.businessId,
                uploadedBy: upload.uploadedBy,
                status: upload.status,
                totalFiles: upload.totalFiles,
                rows: upload.files.map((file, index) => ({
                    rowIndex: index,
                    rowNumber: file.rowNumber,
                    status: file.status,
                    extractedData: file.extractedData,
                    confidenceScore: file.confidenceScore,
                    errorMessage: file.errorMessage,
                })),
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;