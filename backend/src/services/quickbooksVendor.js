import { getValidAccessToken } from './quickbooksAuth.js';
import { config } from '../config/env.js';
import { QuickBooksConnection } from '../models/index.js';
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function findOrCreateVendor(businessId, sellerName, sellerPin) {
  const accessToken = await getValidAccessToken(businessId);
  const conn = await QuickBooksConnection.findOne({ businessId });
  const realmId = conn.realmId;

  const searchRes = await qbRequest(accessToken, realmId, 'GET', `/query?query=SELECT * FROM Vendor WHERE DisplayName = '${escape(sellerName)}'`);
  if (searchRes.QueryResponse?.Vendor?.length) {
    return searchRes.QueryResponse.Vendor[0].Id;
  }

  const createRes = await qbRequest(accessToken, realmId, 'POST', '/vendor', {
    DisplayName: sellerName,
    AcctNum: sellerPin,
  });
  return createRes.Vendor.Id;
}

function escape(str) {
  return str.replace(/'/g, "''");
}