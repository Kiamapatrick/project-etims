import { FirmBusinessAccess } from '../models/index.js';
import { checkBusinessAccess } from './checkBusinessAccess.js';
import { AppError } from './errorHandler.js';

export async function scopeToAccessibleBusinesses(req, res, next) {
  if (!req.user) return next(new AppError('Authentication required', 401));

  const { businessId } = req.query;

  if (businessId) {
    const hasAccess = await checkBusinessAccess(req.user, businessId);
    if (!hasAccess) return next(new AppError('Access denied to this business', 403));
    req.accessibleBusinessIds = [businessId];
    return next();
  }

  if (req.user.role === 'admin') {
    req.accessibleBusinessIds = null;
  } else if (req.user.role === 'business_staff') {
    if (!req.user.businessId) return next(new AppError('User not associated with a business', 403));
    req.accessibleBusinessIds = [req.user.businessId.toString()];
  } else if (req.user.role === 'accountant') {
    if (!req.user.firmId) return next(new AppError('Accountant not associated with a firm', 403));
    const grants = await FirmBusinessAccess.find({ firmId: req.user.firmId, revokedAt: null });
    req.accessibleBusinessIds = grants.map(g => g.businessId.toString());
    if (req.accessibleBusinessIds.length === 0) {
      return next(new AppError('Accountant has no accessible businesses', 403));
    }
  } else {
    return next(new AppError('Insufficient permissions', 403));
  }
  next();
}