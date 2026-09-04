import { config } from '../config/env.js';
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(config.quickbooks.encryptionKey, 'hex');

if (key.length !== 32) {
  throw new Error('QB_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
}

export function decryptToken(encrypted) {
  const [ivHex, ciphertextHex, authTagHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}