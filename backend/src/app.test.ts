import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createApp } from './app';
import { generalLimiter, authLimiter, searchLimiter, contactLimiter } from './middleware/rateLimiter';

describe('Express Reverse Proxy & Trust Proxy Configuration', () => {
  it('configures trust proxy to 1 on the Express app instance', () => {
    const app = createApp();
    assert.equal(app.get('trust proxy'), 1);
  });

  it('correctly resolves client IP from X-Forwarded-For through rate limiter without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR', async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    try {
      const response = await new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: address.port,
            path: '/api/health',
            method: 'GET',
            headers: {
              'X-Forwarded-For': '203.0.113.195',
            },
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => {
              resolve({ statusCode: res.statusCode, body });
            });
          }
        );
        req.on('error', reject);
        req.end();
      });

      // Health endpoint passes through generalLimiter without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
      assert.ok(response.statusCode === 200 || response.statusCode === 503);
      const parsed = JSON.parse(response.body);
      assert.ok(parsed.data && (parsed.data.status === 'ok' || parsed.data.status === 'degraded'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('correctly resolves client IP behind 1 reverse proxy hop when trust proxy is 1', async () => {
    const testApp = express();
    testApp.set('trust proxy', 1);

    let resolvedIp: string | undefined;
    testApp.get('/test-proxy-ip', generalLimiter, (req, res) => {
      resolvedIp = req.ip;
      res.json({ ip: req.ip });
    });

    const server = http.createServer(testApp);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: address.port,
            path: '/test-proxy-ip',
            method: 'GET',
            headers: {
              // Client IP is 198.51.100.42 forwarded by Render proxy
              'X-Forwarded-For': '198.51.100.42',
            },
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
          }
        );
        req.on('error', reject);
        req.end();
      });

      assert.equal(resolvedIp, '198.51.100.42');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('all rate limiters execute cleanly with X-Forwarded-For when trust proxy is 1', async () => {
    const testApp = express();
    testApp.set('trust proxy', 1);

    testApp.get('/auth', authLimiter, (_req, res) => res.send('ok'));
    testApp.get('/search', searchLimiter, (_req, res) => res.send('ok'));
    testApp.get('/contact', contactLimiter, (_req, res) => res.send('ok'));

    const server = http.createServer(testApp);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    try {
      for (const endpoint of ['/auth', '/search', '/contact']) {
        const status = await new Promise<number>((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: address.port,
              path: endpoint,
              method: 'GET',
              headers: {
                'X-Forwarded-For': '203.0.113.50',
              },
            },
            (res) => {
              res.on('data', () => {});
              res.on('end', () => resolve(res.statusCode || 0));
            }
          );
          req.on('error', reject);
          req.end();
        });

        assert.equal(status, 200);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
