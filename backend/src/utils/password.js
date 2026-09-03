import bcrypt from 'bcrypt';
import { config } from '../config/env.js';

const PASSWORD_MIN_LENGTH = 12;

export function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password) {
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  return bcrypt.hash(password, config.bcrypt.saltRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}