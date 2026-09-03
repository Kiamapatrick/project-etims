import { AppError } from './errorHandler.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireAccountant = requireRole('accountant', 'admin');
export const requireBusinessStaff = requireRole('business_staff', 'admin');
export const requireAnyRole = requireRole('business_staff', 'accountant', 'admin');