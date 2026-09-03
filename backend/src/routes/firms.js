import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { AccountingFirm } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'fail', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate, requireAdmin, adminLimiter);

router.post('/', async (req, res, next) => {
  try {
    const { name, pin, address, contactEmail, contactPhone } = req.body;

    if (!name || !pin || !address || !contactEmail || !contactPhone) {
      throw new AppError('All fields are required', 400);
    }

    const firm = await AccountingFirm.create({
      name,
      pin,
      address,
      contactEmail,
      contactPhone,
    });

    res.status(201).json({ status: 'success', firm });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const firms = await AccountingFirm.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ status: 'success', firms });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const firm = await AccountingFirm.findById(req.params.id);
    if (!firm) {
      throw new AppError('Firm not found', 404);
    }
    res.json({ status: 'success', firm });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, address, contactEmail, contactPhone, isActive } = req.body;
    const firm = await AccountingFirm.findByIdAndUpdate(
      req.params.id,
      { name, address, contactEmail, contactPhone, isActive },
      { new: true, runValidators: true }
    );
    if (!firm) {
      throw new AppError('Firm not found', 404);
    }
    res.json({ status: 'success', firm });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const firm = await AccountingFirm.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!firm) {
      throw new AppError('Firm not found', 404);
    }
    res.json({ status: 'success', message: 'Firm deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;