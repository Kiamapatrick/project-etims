import { Router } from 'express';
import { getConnectionStatus } from '../db/mongoose.js';

const router = Router();

router.get('/health', (req, res) => {
  const dbStatus = getConnectionStatus();
  const isHealthy = dbStatus.readyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: isHealthy ? 'connected' : 'disconnected',
      host: dbStatus.host,
      name: dbStatus.name,
    },
  });
});

export default router;