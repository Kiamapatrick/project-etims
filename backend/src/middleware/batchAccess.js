import { DocumentUpload } from '../models/index.js';
import { checkBusinessAccess } from './checkBusinessAccess.js';
import { AppError } from './errorHandler.js';

export async function requireBatchAccess(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const { batchId } = req.params;
  if (!batchId) {
    return next(new AppError('Batch ID required', 400));
  }

  const upload = await DocumentUpload.findOne({ batchId });
  if (!upload) {
    return next(new AppError('Batch not found', 404));
  }

  const businessId = upload.businessId.toString();
  const hasAccess = await checkBusinessAccess(req.user, businessId);
  if (!hasAccess) {
    return next(new AppError('Access denied to this batch', 403));
  }

  req.batchUpload = upload;
  next();
}