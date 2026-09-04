import { DocumentUpload } from '../models/index.js';
import { checkBusinessAccess } from './checkBusinessAccess.js';
import { AppError } from './errorHandler.js';

export async function requireDocumentAccess(req, res, next) {
  if (!req.user) return next(new AppError('Authentication required', 401));
  const { documentUploadId } = req.params;
  if (!documentUploadId) return next(new AppError('Document ID required', 400));

  const upload = await DocumentUpload.findById(documentUploadId);
  if (!upload) return next(new AppError('Document not found', 404));

  const hasAccess = await checkBusinessAccess(req.user, upload.businessId.toString());
  if (!hasAccess) return next(new AppError('Access denied', 403));

  req.documentUpload = upload;
  next();
}