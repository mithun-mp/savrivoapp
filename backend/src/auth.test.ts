import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createApp } from './app';
import { AdminUser } from './models/AdminUser.model';
import { hashPassword, comparePassword, generateToken, verifyToken } from './services/auth.service';

describe('Admin Authentication & Verification Flow', () => {
  const originalFindOne = AdminUser.findOne;
  const originalFindByIdAndUpdate = AdminUser.findByIdAndUpdate;

  const TEST_EMAIL = 'test-admin@savrivo.test';
  const TEST_PASS = 'TestSecurePassword123!';
  let testPasswordHash: string;

  beforeEach(async () => {
    testPasswordHash = await hashPassword(TEST_PASS);
  });

  afterEach(() => {
    AdminUser.findOne = originalFindOne;
    AdminUser.findByIdAndUpdate = originalFindByIdAndUpdate;
  });

  describe('Password Hashing & Comparison Utilities', () => {
    it('generates a valid bcrypt hash and successfully verifies matching password', async () => {
      const hash = await hashPassword('SampleAdminPassword2026!');
      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));

      const isMatch = await comparePassword('SampleAdminPassword2026!', hash);
      assert.equal(isMatch, true);
    });

    it('rejects an incorrect password during verification', async () => {
      const hash = await hashPassword('SampleAdminPassword2026!');
      const isMatch = await comparePassword('WrongPassword123!', hash);
      assert.equal(isMatch, false);
    });

    it('preserves password whitespace exactly during hashing and verification', async () => {
      const spacedPassword = '   padded secret key   ';
      const hash = await hashPassword(spacedPassword);

      assert.equal(await comparePassword(spacedPassword, hash), true);
      assert.equal(await comparePassword(spacedPassword.trim(), hash), false);
    });

    it('generates and verifies JWT authentication tokens', () => {
      const payload = {
        userId: '65f01234567890abcdef1234',
        email: 'test-editor@savrivo.test',
        role: 'editor' as const,
      };

      const token = generateToken(payload);
      assert.ok(typeof token === 'string' && token.length > 20);

      const decoded = verifyToken(token);
      assert.equal(decoded.userId, payload.userId);
      assert.equal(decoded.email, payload.email);
      assert.equal(decoded.role, payload.role);
    });
  });

  describe('Admin Login Controller & Email Normalization Flow', () => {
    it('authenticates successfully with exact lowercase email', async () => {
      // Mock AdminUser.findOne to simulate exact database lookup
      (AdminUser as any).findOne = (query: { email: string; active?: boolean }) => {
        return {
          select: (_proj: string) => {
            if (query.email === TEST_EMAIL && query.active === true) {
              return Promise.resolve({
                _id: 'mock-admin-id-1',
                email: TEST_EMAIL,
                passwordHash: testPasswordHash,
                role: 'superadmin',
                active: true,
              });
            }
            return Promise.resolve(null);
          },
        };
      };
      (AdminUser as any).findByIdAndUpdate = () => Promise.resolve({});

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: TEST_EMAIL,
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true);
        assert.equal(body.data.user.email, TEST_EMAIL);
        assert.equal(body.data.user.role, 'superadmin');
        assert.ok(body.data.token);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('normalizes uppercase email and authenticates successfully', async () => {
      // Database stores lowercase email; query must be normalized to lowercase
      (AdminUser as any).findOne = (query: { email: string; active?: boolean }) => {
        return {
          select: (_proj: string) => {
            // If the query was not normalized, query.email will have uppercase letters and return null
            if (query.email === TEST_EMAIL && query.active === true) {
              return Promise.resolve({
                _id: 'mock-admin-id-1',
                email: TEST_EMAIL,
                passwordHash: testPasswordHash,
                role: 'superadmin',
                active: true,
              });
            }
            return Promise.resolve(null);
          },
        };
      };
      (AdminUser as any).findByIdAndUpdate = () => Promise.resolve({});

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: 'Test-Admin@Savrivo.TEST',
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true);
        assert.equal(body.data.user.email, TEST_EMAIL);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('normalizes email with surrounding whitespace and authenticates successfully', async () => {
      (AdminUser as any).findOne = (query: { email: string; active?: boolean }) => {
        return {
          select: (_proj: string) => {
            if (query.email === TEST_EMAIL && query.active === true) {
              return Promise.resolve({
                _id: 'mock-admin-id-1',
                email: TEST_EMAIL,
                passwordHash: testPasswordHash,
                role: 'superadmin',
                active: true,
              });
            }
            return Promise.resolve(null);
          },
        };
      };
      (AdminUser as any).findByIdAndUpdate = () => Promise.resolve({});

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: `  ${TEST_EMAIL}  `,
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('returns HTTP 401 when password does not match', async () => {
      (AdminUser as any).findOne = (query: { email: string; active?: boolean }) => {
        return {
          select: (_proj: string) => {
            if (query.email === TEST_EMAIL && query.active === true) {
              return Promise.resolve({
                _id: 'mock-admin-id-1',
                email: TEST_EMAIL,
                passwordHash: testPasswordHash,
                role: 'superadmin',
                active: true,
              });
            }
            return Promise.resolve(null);
          },
        };
      };

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: TEST_EMAIL,
          password: 'IncorrectPassword999!',
        });

        assert.equal(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'INVALID_CREDENTIALS');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('returns HTTP 401 when account is not found', async () => {
      (AdminUser as any).findOne = () => ({
        select: () => Promise.resolve(null),
      });

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: 'nonexistent@savrivo.test',
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'INVALID_CREDENTIALS');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('returns HTTP 401 when account is inactive', async () => {
      // When active: true is required, inactive user returns null
      (AdminUser as any).findOne = (query: { active?: boolean }) => ({
        select: () => {
          if (query.active === true) return Promise.resolve(null);
          return Promise.resolve({
            _id: 'inactive-id',
            email: TEST_EMAIL,
            passwordHash: testPasswordHash,
            active: false,
          });
        },
      });

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: TEST_EMAIL,
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'INVALID_CREDENTIALS');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('returns HTTP 400 when email format is invalid', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: 'not-an-email',
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('returns HTTP 400 when password is empty', async () => {
      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: TEST_EMAIL,
          password: '',
        });

        assert.equal(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'VALIDATION_ERROR');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('safely returns HTTP 401 without 500 crash if passwordHash is missing from database record', async () => {
      (AdminUser as any).findOne = () => ({
        select: () =>
          Promise.resolve({
            _id: 'mock-corrupted-id',
            email: TEST_EMAIL,
            passwordHash: undefined,
            role: 'superadmin',
            active: true,
          }),
      });

      const app = createApp();
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address() as { port: number };

      try {
        const res = await makePostRequest(address.port, '/api/admin/auth/login', {
          email: TEST_EMAIL,
          password: TEST_PASS,
        });

        assert.equal(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.equal(body.success, false);
        assert.equal(body.error.code, 'INVALID_CREDENTIALS');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});

let reqCounter = 1;

function makePostRequest(
  port: number,
  path: string,
  payload: Record<string, unknown>
): Promise<{ statusCode?: number; body: string }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const clientIp = `203.0.113.${(reqCounter++ % 200) + 1}`;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-Forwarded-For': clientIp,
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
    req.write(postData);
    req.end();
  });
}
