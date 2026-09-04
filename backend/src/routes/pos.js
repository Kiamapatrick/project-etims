import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireBusinessStaff } from '../middleware/rbac.js';
import { getConfig, createSale, listSales } from '../controllers/pos.js';

const router = Router();
router.use(authenticate, requireBusinessStaff);

router.get('/config', getConfig);
router.post('/sales', createSale);
router.get('/sales', listSales);

export default router;