import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { config } from '../config/env.js';
import { AppError } from './errorHandler.js';

export async function authenticate(req, res, next) {
  try {
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
      throw new AppError('Authentication required', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401);
      }
      throw new AppError('Invalid token', 401);
    }

    const user = await User.findById(decoded.sub).select('+passwordHash');
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = user;
    req.accessToken = accessToken;
    next();
  } catch (err) {
    next(err);
  }
}

function extractAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      businessId: user.businessId?.toString() || null,
      firmId: user.firmId?.toString() || null,
    },
    config.jwtSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    config.jwtSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

export function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: parseDuration(config.jwt.refreshExpiresIn),
    path: '/api/auth',
  });
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * (multipliers[unit] || 1);
}