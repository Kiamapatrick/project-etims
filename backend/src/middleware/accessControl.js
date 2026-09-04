import { checkBusinessAccess } from './checkBusinessAccess.js';
import { AppError } from './errorHandler.js';

export async function requireBusinessAccess(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const businessId = extractBusinessId(req);
  if (!businessId) {
    return next(new AppError('Business ID required', 400));
  }

  const hasAccess = await checkBusinessAccess(req.user, businessId);
  if (!hasAccess) {
    return next(new AppError('Access denied to this business', 403));
  }

  next();
}

function extractBusinessId(req) {
  if (req.params.businessId) return req.params.businessId;
  if (req.body?.businessId) return req.body.businessId;
  if (req.query?.businessId) return req.query.businessId;
  return null;
}

export async function requireFirmAccess(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const firmId = extractFirmId(req);
  if (!firmId) {
    return next(new AppError('Firm ID required', 400));
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'accountant') {
    if (!req.user.firmId || req.user.firmId.toString() !== firmId) {
      return next(new AppError('Access denied to this firm', 403));
    }
    return next();
  }

  return next(new AppError('Insufficient permissions', 403));
}

function extractFirmId(req) {
  if (req.params.firmId) return req.params.firmId;
  if (req.body?.firmId) return req.body.firmId;
  if (req.query?.firmId) return req.query.firmId;
  return null;
}