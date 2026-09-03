import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { User } from '../models/index.js';
import { Business } from '../models/index.js';
import { AccountingFirm } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { hashPassword, validatePassword } from '../utils/password.js';
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
    const { email, password, role, businessId, firmId } = req.body;

    if (!email || !password || !role) {
      throw new AppError('Email, password, and role are required', 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join('; '), 400);
    }

    if (!['business_staff', 'accountant', 'admin'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    if (role === 'business_staff') {
      if (!businessId) {
        throw new AppError('businessId is required for business_staff role', 400);
      }
      const business = await Business.findById(businessId);
      if (!business) {
        throw new AppError('Business not found', 404);
      }
    }

    if (role === 'accountant') {
      if (!firmId) {
        throw new AppError('firmId is required for accountant role', 400);
      }
      const firm = await AccountingFirm.findById(firmId);
      if (!firm) {
        throw new AppError('Firm not found', 404);
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      businessId: role === 'business_staff' ? businessId : null,
      firmId: role === 'accountant' ? firmId : null,
    });

    res.status(201).json({
      status: 'success',
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

router.get('/', async (req, res, next) => {
  try {
    const { role, businessId, firmId, isActive } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (businessId) filter.businessId = businessId;
    if (firmId) filter.firmId = firmId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .populate('businessId', 'name pin')
      .populate('firmId', 'name pin')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', users });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('businessId', 'name pin')
      .populate('firmId', 'name pin');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json({ status: 'success', user });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { email, role, businessId, firmId, isActive } = req.body;
    const updateData = {};

    if (email) updateData.email = email.toLowerCase();
    if (role) {
      if (!['business_staff', 'accountant', 'admin'].includes(role)) {
        throw new AppError('Invalid role', 400);
      }
      updateData.role = role;
    }
    if (businessId !== undefined) updateData.businessId = businessId;
    if (firmId !== undefined) updateData.firmId = firmId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('businessId', 'name pin').populate('firmId', 'name pin');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ status: 'success', user });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/password', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      throw new AppError('Password is required', 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join('; '), 400);
    }

    const passwordHash = await hashPassword(password);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { passwordHash },
      { new: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ status: 'success', message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json({ status: 'success', message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;