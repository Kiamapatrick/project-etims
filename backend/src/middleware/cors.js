import cors from 'cors';
import { config } from '../config/env.js';

const corsOptions = {
  origin: config.frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

export const corsMiddleware = cors(corsOptions);