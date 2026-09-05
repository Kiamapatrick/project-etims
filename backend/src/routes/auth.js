import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie, clearAuthCookies } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many refresh attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      status: 'success',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
        firmId: user.firmId,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const jwt = await import('jsonwebtoken');
    const { config } = await import('../config/env.js');

    let decoded;
    try {
      decoded = jwt.default.verify(refreshToken, config.jwtSecret);
    } catch {
      clearAuthCookies(res);
      throw new AppError('Invalid refresh token, please log in again', 401);
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      clearAuthCookies(res);
      throw new AppError('User not found or inactive', 401);
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      status: 'success',
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ status: 'success', message: 'Logged out successfully' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    status: 'success',
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      businessId: req.user.businessId,
      firmId: req.user.firmId,
      lastLoginAt: req.user.lastLoginAt,
    },
  });
});

export default router;