import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessAccess } from '../middleware/accessControl.js';
import { Sale, Business } from '../models/index.js';
import { validateExtraction } from '../services/validator.js';
import { logSaleCreated } from '../services/auditLog.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);

router.post('/', requireBusinessAccess, async (req, res, next) => {
  try {
    const businessId = req.body.businessId;
    const userId = req.user._id;

    if (!businessId) {
      throw new AppError('businessId is required', 400);
    }

    const business = await Business.findById(businessId).lean();
    if (!business) {
      throw new AppError('Business not found', 404);
    }

    const {
      saleDate,
      totalAmount,
      vatAmount,
      lineItems,
      sellerName,
      sellerPin,
    } = req.body;

    if (!saleDate || !totalAmount || !vatAmount || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new AppError('saleDate, totalAmount, vatAmount, and lineItems are required', 400);
    }

    for (const item of lineItems) {
      if (!item.description || !item.quantity || !item.unitPrice || !item.vatRate || !item.vatAmount || !item.totalAmount) {
        throw new AppError('Each line item must have description, quantity, unitPrice, vatRate, vatAmount, and totalAmount', 400);
      }
      item.amount = item.quantity * item.unitPrice;
    }

    const extractedData = {
      date: saleDate,
      total: totalAmount,
      vat: { amount: vatAmount },
      lineItems,
    };

    const validation = validateExtraction(extractedData);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const sale = await Sale.create({
      businessId,
      cuin: null,
      qrCode: null,
      saleDate: new Date(saleDate),
      totalAmount,
      vatAmount,
      sellerName: sellerName || business.name || 'Unknown',
      sellerPin: sellerPin || business.pin || null,
      lineItems,
      source: 'manual',
      documentUploadId: null,
      confirmedBy: userId,
      confirmedAt: new Date(),
    });

    await logSaleCreated({ saleId: sale._id, userId, source: 'manual', saleData: { totalAmount, vatAmount, lineItemsCount: lineItems.length } });

    res.status(201).json({ status: 'success', sale });
  } catch (err) {
    next(err);
  }
});

export default router;