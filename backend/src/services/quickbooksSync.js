import { getValidAccessToken } from './quickbooksAuth.js';
import { findOrCreateVendor } from './quickbooksVendor.js';
import { Sale, QuickBooksConnection } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';
import fetch from 'node-fetch';

const QB_BASE = config.quickbooks.baseUrl;

async function qbRequest(accessToken, realmId, method, path, body) {
  const res = await fetch(`${QB_BASE}/v3/company/${realmId}${path}?minorversion=65`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.Fault) throw new Error(JSON.stringify(data.Fault));
  return data;
}

export async function syncSaleToQuickBooks(saleId) {
  const sale = await Sale.findById(saleId).populate('businessId');
  if (!sale) throw new AppError('Sale not found', 404);
  if (sale.quickbooksId) throw new AppError('Already synced to QuickBooks', 400);

  const business = sale.businessId;
  if (!business.qbExpenseAccountId || !business.qbTaxCodeId) {
    throw new AppError('Business missing QuickBooks expense account or tax code mapping', 400);
  }

  const accessToken = await getValidAccessToken(business._id);
  const conn = await QuickBooksConnection.findOne({ businessId: business._id });
  const realmId = conn.realmId;

  const vendorId = await findOrCreateVendor(business._id, sale.sellerName, sale.sellerPin);

  const purchasePayload = {
    VendorRef: { value: vendorId },
    TxnDate: sale.saleDate.toISOString().split('T')[0],
    PrivateNote: `CUIN: ${sale.cuin || 'N/A'} | Source: ${sale.source}`,
    Line: sale.lineItems.map(item => ({
      Amount: item.amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: business.qbExpenseAccountId },
        Qty: item.quantity,
        UnitPrice: item.unitPrice,
        TaxCodeRef: { value: business.qbTaxCodeId },
      },
      Description: item.description,
    })),
  };

  const result = await qbRequest(accessToken, realmId, 'POST', '/purchase', purchasePayload);
  const qbId = result.Purchase.Id;

  sale.quickbooksId = qbId;
  sale.syncedAt = new Date();
  await sale.save();

  await QuickBooksConnection.findByIdAndUpdate(conn._id, { lastSyncedAt: new Date() });

  return { quickbooksId: qbId, syncedAt: sale.syncedAt };
}

export async function bulkSyncSales(saleIds) {
  const results = { synced: [], errors: [] };
  for (const id of saleIds) {
    try {
      const result = await syncSaleToQuickBooks(id);
      results.synced.push({ saleId: id, ...result });
    } catch (err) {
      results.errors.push({ saleId: id, error: err.message });
    }
  }
  return results;
}