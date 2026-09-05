import { Sale, Business } from '../models/index.js';
import { getConfig as getReceiptConfig, seedDefaultConfig } from '../services/receiptConfig.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getConfig(req, res, next) {
  try {
    const businessId = req.user.businessId;
    let config = await getReceiptConfig(businessId);
    
    if (!config) {
      const business = await Business.findById(businessId).lean();
      config = await seedDefaultConfig(businessId, business?.defaultVatRate ?? 16);
    }
    
    res.json({ status: 'success', config });
  } catch (err) { next(err); }
}

export async function createSale(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const userId = req.user._id;
    
    const business = await Business.findById(businessId).lean();
    
    const { 
      saleDate, 
      totalAmount, 
      vatAmount, 
      lineItems, 
      sellerName, 
      sellerPin 
    } = req.body;

    if (!saleDate || !totalAmount || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new AppError('saleDate, totalAmount, and lineItems are required', 400);
    }

    for (const item of lineItems) {
      if (!item.description || !item.quantity || !item.unitPrice || !item.vatRate || !item.vatAmount || !item.totalAmount) {
        throw new AppError('Each line item must have description, quantity, unitPrice, vatRate, vatAmount, and totalAmount', 400);
      }
    }

    const posReference = `POS-${business?.pin || businessId}-${Date.now()}`;

    const sale = await Sale.create({
      businessId,
      cuin: null,
      qrCode: null,
      saleDate: new Date(saleDate),
      totalAmount,
      vatAmount,
      sellerName: sellerName || business?.name || 'Unknown',
      sellerPin: sellerPin || business?.pin || null,
      lineItems,
      source: 'pos',
      documentUploadId: null,
      confirmedBy: userId,
      confirmedAt: new Date(),
      posReference,
    });

    res.status(201).json({ status: 'success', sale });
  } catch (err) { next(err); }
}

export async function listSales(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    
    const filter = { businessId, source: 'pos' };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const sales = await Sale.find(filter)
      .sort({ saleDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Sale.countDocuments(filter);

    res.json({
      status: 'success',
      sales,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}