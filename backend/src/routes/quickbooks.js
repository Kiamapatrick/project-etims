import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessAccess } from '../middleware/accessControl.js';
import { requireBatchAccess } from '../middleware/batchAccess.js';
import { requireSaleAccess } from '../middleware/saleAccess.js';
import {
  initiateConnect,
  handleCallback,
  getConnectionStatus,
  disconnect,
} from '../services/quickbooksAuth.js';
import { syncSaleToQuickBooks, bulkSyncSales } from '../services/quickbooksSync.js';
import { generateQuickBooksExpenseCSV } from '../services/csvExport.js';
import { DocumentUpload } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/connect/:businessId', authenticate, requireBusinessAccess, async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const authUrl = await initiateConnect(businessId, req.user._id);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

router.get('/callback', async (req, res, _next) => {
  try {
    const reqUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await handleCallback(reqUrl);
    res.redirect('/review.html?quickbooks=connected');
  } catch (err) {
    res.redirect(`/review.html?quickbooks=error&message=${encodeURIComponent(err.message)}`);
  }
});

router.get('/status/:businessId', authenticate, requireBusinessAccess, async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const status = await getConnectionStatus(businessId);
    res.json({ status: 'success', ...status });
  } catch (err) {
    next(err);
  }
});

router.post('/disconnect/:businessId', authenticate, requireBusinessAccess, async (req, res, next) => {
  try {
    const { businessId } = req.params;
    await disconnect(businessId);
    res.json({ status: 'success', message: 'QuickBooks disconnected' });
  } catch (err) {
    next(err);
  }
});

router.post('/sync/:saleId', authenticate, requireSaleAccess, async (req, res, next) => {
  try {
    const { saleId } = req.params;
    const result = await syncSaleToQuickBooks(saleId);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/sync-batch/:batchId', authenticate, requireBatchAccess, async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const upload = req.batchUpload || await DocumentUpload.findOne({ batchId });
    if (!upload) throw new AppError('Batch not found', 404);

    const confirmedSaleIds = upload.files
      .filter(f => f.status === 'confirmed' && f.linkedSaleId)
      .map(f => f.linkedSaleId.toString());

    if (confirmedSaleIds.length === 0) {
      return res.json({ status: 'success', synced: [], errors: [], message: 'No confirmed sales to sync' });
    }

    const result = await bulkSyncSales(confirmedSaleIds);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/export/:batchId', authenticate, requireBatchAccess, async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const upload = req.batchUpload || await DocumentUpload.findOne({ batchId })
      .populate('businessId', 'name pin');
    if (!upload) throw new AppError('Batch not found', 404);

    const saleIds = upload.files
      .filter(f => f.status === 'confirmed' && f.linkedSaleId)
      .map(f => f.linkedSaleId);

    if (saleIds.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'No confirmed sales to export' });
    }

    const sales = await Sale.find({ _id: { $in: saleIds } })
      .populate('businessId', 'name pin');

    const csv = generateQuickBooksExpenseCSV(sales);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quickbooks-expenses-${batchId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;