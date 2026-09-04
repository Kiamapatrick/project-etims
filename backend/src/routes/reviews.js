import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessAccess } from '../middleware/accessControl.js';
import { requireBatchAccess } from '../middleware/batchAccess.js';
import { requireDocumentAccess } from '../middleware/documentAccess.js';
import {
  listBatches,
  getBatchDetail,
  editFile,
  confirmFile,
  bulkConfirmBatch,
  rejectFile,
  getAuditLog,
} from '../controllers/reviews.js';

const router = Router();
router.use(authenticate);

router.get('/batches', requireBusinessAccess, listBatches);
router.get('/batch/:batchId', requireBatchAccess, getBatchDetail);
router.post('/batch/:batchId/confirm-bulk', requireBatchAccess, bulkConfirmBatch);

router.patch('/file/:documentUploadId/:fileIndex', requireDocumentAccess, editFile);
router.post('/file/:documentUploadId/:fileIndex/confirm', requireDocumentAccess, confirmFile);
router.post('/file/:documentUploadId/:fileIndex/reject', requireDocumentAccess, rejectFile);
router.get('/audit-log/:documentUploadId/:fileIndex', requireDocumentAccess, getAuditLog);

export default router;