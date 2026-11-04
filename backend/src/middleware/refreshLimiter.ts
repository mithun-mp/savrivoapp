import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import type { AuthPayload } from '../types';
import { sendError } from '../utils/response';

// Per-product cooldown in milliseconds (5 minutes)
export const PRODUCT_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

// Maximum simultaneous in-flight public refreshes across server
export const MAX_GLOBAL_CONCURRENT_REFRESHES = 3;

// State tracking (in-memory)
const lastRefreshedMap = new Map<string, number>();
const activeInFlightSlugs = new Set<string>();

/**
 * IP-based rate limiter for product merchant refresh requests (5 requests per 15 minutes)
 */
export const refreshIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many product merchant refresh requests from this IP. Please try again later.',
    },
  },
  skip: (req: Request) => {
    // If request has valid admin credentials, skip IP rate limit
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), config.jwt.secret) as AuthPayload;
        if (payload?.role === 'admin' || payload?.role === 'superadmin') {
          return true;
        }
      } catch {
        // Not a valid admin token, apply limiter
      }
    }
    return false;
  },
});

/**
 * Product-level security guard for POST /api/products/:slug/refresh
 * - Checks for admin authentication (preferred): admin requests bypass cooldown & concurrency limits.
 * - For public/unauthenticated requests:
 *   1. Enforces 5-minute per-product cooldown.
 *   2. Prevents concurrent duplicate refreshes for the same product.
 *   3. Limits total simultaneous public refresh tasks.
 */
export function productRefreshGuard(req: Request, res: Response, next: NextFunction): void {
  const slug = req.params.slug ? String(req.params.slug).trim().toLowerCase() : '';
  if (!slug) {
    sendError(res, 'Product slug is required', 400, 'BAD_REQUEST');
    return;
  }

  // 1. Check for Admin Authentication (Preferred Mode)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwt.secret) as AuthPayload;
      if (payload?.role === 'admin' || payload?.role === 'superadmin') {
        req.user = payload;
        // Admin authenticated: proceed immediately without public cooldown or concurrency limits
        next();
        return;
      }
    } catch {
      // If bearer token was supplied but invalid, reject early
      sendError(res, 'Invalid or expired authentication token', 401, 'TOKEN_INVALID');
      return;
    }
  }

  // 2. Public Refresh Path: Enforce Per-Product Cooldown
  const now = Date.now();
  const lastRefreshed = lastRefreshedMap.get(slug);
  if (lastRefreshed && (now - lastRefreshed) < PRODUCT_REFRESH_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((PRODUCT_REFRESH_COOLDOWN_MS - (now - lastRefreshed)) / 1000);
    res.setHeader('Retry-After', remainingSeconds.toString());
    sendError(
      res,
      `Product merchant data was refreshed recently. Cooldown active. Please wait ${remainingSeconds}s before retrying.`,
      429,
      'RATE_LIMIT'
    );
    return;
  }

  // 3. Public Refresh Path: Enforce Per-Product Concurrency Lock
  if (activeInFlightSlugs.has(slug)) {
    sendError(
      res,
      'A merchant data refresh is already in progress for this product. Please wait for it to complete.',
      429,
      'CONCURRENCY_LIMIT'
    );
    return;
  }

  // 4. Public Refresh Path: Enforce Global Concurrency Limit
  if (activeInFlightSlugs.size >= MAX_GLOBAL_CONCURRENT_REFRESHES) {
    sendError(
      res,
      'Server is currently processing the maximum number of concurrent merchant refreshes. Please retry shortly.',
      429,
      'CONCURRENCY_LIMIT'
    );
    return;
  }

  // Acquire in-flight lock
  activeInFlightSlugs.add(slug);

  // Hook cleanup on request completion
  const cleanup = () => {
    activeInFlightSlugs.delete(slug);
    // If response was successful (2xx), record refresh timestamp for cooldown
    if (res.statusCode >= 200 && res.statusCode < 300) {
      lastRefreshedMap.set(slug, Date.now());
    }
  };

  res.once('finish', cleanup);
  res.once('close', cleanup);

  next();
}

/**
 * Test helper to reset internal in-memory maps
 */
export function _resetRefreshLimits(): void {
  lastRefreshedMap.clear();
  activeInFlightSlugs.clear();
}

