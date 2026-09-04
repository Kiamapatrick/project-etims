import { Sale } from '../models/index.js';
import { checkBusinessAccess } from './checkBusinessAccess.js';
import { AppError } from './errorHandler.js';

export async function requireSaleAccess(req, res, next) {
  if (!req.user) return next(new AppError('Authentication required', 401));
  const { saleId } = req.params;
  const sale = await Sale.findById(saleId);
  if (!sale) return next(new AppError('Sale not found', 404));
  const hasAccess = await checkBusinessAccess(req.user, sale.businessId.toString());
  if (!hasAccess) return next(new AppError('Access denied to this sale', 403));
  req.sale = sale;
  next();
}