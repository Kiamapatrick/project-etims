import OAuthClient from 'intuit-oauth';
import { config } from '../config/env.js';
import { QuickBooksConnection, OAuthState } from '../models/index.js';
import { encryptToken, decryptToken } from '../utils/tokenEncryption.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

function createOAuthClient() {
  return new OAuthClient({
    clientId: config.quickbooks.clientId,
    clientSecret: config.quickbooks.clientSecret,
    environment: config.quickbooks.environment,
    redirectUri: config.quickbooks.redirectUri,
  });
}

export function getAuthUrl(state) {
  const client = createOAuthClient();
  return client.authorizeUri({
    scope: [client.scopes.Accounting],
    state,
  });
}

export async function initiateConnect(businessId, userId) {
  const state = crypto.randomBytes(32).toString('hex');
  await OAuthState.create({
    state,
    businessId,
    userId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return getAuthUrl(state);
}

export async function handleCallback(reqUrl) {
  const client = createOAuthClient();
  const authResponse = await client.createToken(reqUrl);
  const { access_token, refresh_token, expires_in } = authResponse.getJson();
  const realmId = authResponse.token.realmId;
  const state = authResponse.token.state;

  const record = await OAuthState.findOneAndDelete({ state });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired OAuth state', 400);
  }

  await QuickBooksConnection.findOneAndUpdate(
    { businessId: record.businessId },
    {
      businessId: record.businessId,
      realmId,
      accessTokenEncrypted: encryptToken(access_token),
      refreshTokenEncrypted: encryptToken(refresh_token),
      expiresAt: new Date(Date.now() + (expires_in - 60) * 1000),
      syncStatus: 'connected',
      errorMessage: null,
    },
    { upsert: true, new: true }
  );

  return { businessId: record.businessId };
}

export async function getValidAccessToken(businessId) {
  const conn = await QuickBooksConnection.findOne({ businessId });
  if (!conn) throw new AppError('QuickBooks not connected for this business', 404);
  if (conn.syncStatus === 'disconnected') throw new AppError('QuickBooks connection disconnected', 400);

  if (new Date() >= conn.expiresAt) {
    return refreshAccessToken(conn);
  }
  return decryptToken(conn.accessTokenEncrypted);
}

async function refreshAccessToken(conn) {
  const client = createOAuthClient();
  client.setToken({
    access_token: decryptToken(conn.accessTokenEncrypted),
    refresh_token: decryptToken(conn.refreshTokenEncrypted),
  });

  try {
    const refreshResponse = await client.refresh();
    const { access_token, refresh_token, expires_in } = refreshResponse.getJson();

    conn.accessTokenEncrypted = encryptToken(access_token);
    conn.refreshTokenEncrypted = encryptToken(refresh_token);
    conn.expiresAt = new Date(Date.now() + (expires_in - 60) * 1000);
    conn.syncStatus = 'connected';
    conn.errorMessage = null;
    await conn.save();

    return access_token;
  } catch (err) {
    conn.syncStatus = 'error';
    conn.errorMessage = err.message;
    await conn.save();
    throw new AppError('Failed to refresh QuickBooks token', 500);
  }
}

export async function disconnect(businessId) {
  await QuickBooksConnection.findOneAndUpdate(
    { businessId },
    { syncStatus: 'disconnected', errorMessage: null }
  );
}

export async function getConnectionStatus(businessId) {
  const conn = await QuickBooksConnection.findOne({ businessId });
  if (!conn) {
    return { connected: false, status: 'not_configured' };
  }
  return {
    connected: conn.syncStatus === 'connected',
    status: conn.syncStatus,
    realmId: conn.realmId,
    lastSyncedAt: conn.lastSyncedAt,
    errorMessage: conn.errorMessage,
  };
}