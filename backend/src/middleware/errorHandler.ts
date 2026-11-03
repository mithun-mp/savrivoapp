import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env';
import { sendError } from '../utils/response';
import { sanitizeErrorMessage } from '../utils/sanitize';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (config.isDev) {
    console.error('[Error]', err);
  }

  if (err instanceof ZodError) {
    sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR',
      err.errors.map(e => ({ field: e.path.join('.'), message: e.message })));
    return;
  }

  if (err instanceof Error) {
    // Mongoose duplicate key
    if ((err as NodeJS.ErrnoException & { code?: number }).code === 11000) {
      sendError(res, 'A record with this value already exists', 409, 'DUPLICATE_KEY');
      return;
    }

    // Mongoose cast error (bad ObjectId)
    if (err.name === 'CastError') {
      sendError(res, 'Invalid identifier format', 400, 'INVALID_ID');
      return;
    }

    // Mongoose validation
    if (err.name === 'ValidationError') {
      sendError(res, err.message, 400, 'MONGOOSE_VALIDATION');
      return;
    }

    // JWT
    if (err.name === 'JsonWebTokenError') {
      sendError(res, 'Invalid token', 401, 'TOKEN_INVALID');
      return;
    }
    if (err.name === 'TokenExpiredError') {
      sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
      return;
    }

    // CORS block
    if (err.message && err.message.includes('not allowed by CORS')) {
      sendError(res, 'Cross-Origin Request Blocked by CORS', 403, 'CORS_ERROR');
      return;
    }

    const customStatus = (err as unknown as Record<string, unknown>).statusCode;
    if (typeof customStatus === 'number') {
      const code = String((err as unknown as Record<string, unknown>).code || 'OPERATION_FAILED');
      sendError(res, sanitizeErrorMessage(err.message), customStatus, code);
      return;
    }

    sendError(res, config.isDev ? sanitizeErrorMessage(err.message) : 'An unexpected error occurred');
    return;
  }

  sendError(res, 'An unexpected error occurred');
}