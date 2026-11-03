import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/logger';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/response';
import { config } from './config/env';
import routes from './routes';

export function createApp() {
  const app = express();

  // Trust first proxy hop (Render reverse proxy) for accurate client IP resolution in rate limiting
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // Multi-origin CORS support for both savrivo and savrivoapp
  const configuredOrigins = (config.frontendOrigin || '')
    .split(',')
    .map((o) => {
      try {
        return new URL(o.trim()).origin;
      } catch {
        return o.trim().replace(/\/+$/, '');
      }
    })
    .filter(Boolean);

  const allowedOriginsSet = new Set([
    'https://mithun-mp.github.io',
    'https://savrivo.in',
    'https://www.savrivo.in',
    'https://app.savrivo.in',
    'http://localhost:4321',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:4321',
    'http://127.0.0.1:3000',
    ...configuredOrigins,
  ]);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOriginsSet.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(requestLogger);

  // Global rate limit
  app.use('/api', generalLimiter);

  // Routes
  app.use('/api', routes);

  // 404
  app.use((_req, res) => {
    sendError(res, 'Route not found', 404, 'NOT_FOUND');
  });

  // Error handler
  app.use(errorHandler);

  return app;
}