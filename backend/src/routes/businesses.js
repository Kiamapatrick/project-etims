import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { Business } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { scopeToAccessibleBusinesses } from '../middleware/scopeToAccessibleBusinesses.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'fail', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate, adminLimiter);

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, pin, address, contactEmail, contactPhone } = req.body;

    if (!name || !pin || !address || !contactEmail || !contactPhone) {
      throw new AppError('All fields are required', 400);
    }

    const business = await Business.create({
      name,
      pin,
      address,
      contactEmail,
      contactPhone,
    });

    res.status(201).json({ status: 'success', business });
  } catch (err) {
    next(err);
  }
});

router.get('/', scopeToAccessibleBusinesses, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.accessibleBusinessIds !== null) {
      filter._id = { $in: req.accessibleBusinessIds };
    }
    const businesses = await Business.find(filter).sort({ createdAt: -1 });
    res.json({ status: 'success', businesses });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    res.json({ status: 'success', business });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, address, contactEmail, contactPhone, isActive } = req.body;
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { name, address, contactEmail, contactPhone, isActive },
      { new: true, runValidators: true }
    );
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    res.json({ status: 'success', business });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    res.json({ status: 'success', message: 'Business deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;