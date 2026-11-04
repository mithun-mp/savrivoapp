import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import {
  productRefreshGuard,
  _resetRefreshLimits,
  PRODUCT_REFRESH_COOLDOWN_MS,
  MAX_GLOBAL_CONCURRENT_REFRESHES,
} from './refreshLimiter';

describe('Product Refresh Security & Concurrency Guard', () => {
  beforeEach(() => {
    _resetRefreshLimits();
  });

  function createMockReqRes(options: {
    slug?: string;
    authHeader?: string;
  }) {
    const req: any = {
      params: { slug: options.slug || 'test-product' },
      headers: {},
    };
    if (options.authHeader) {
      req.headers.authorization = options.authHeader;
    }

    const listeners: Record<string, (() => void)[]> = {};
    const res: any = {
      statusCode: 200,
      headers: {},
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.body = body;
        return this;
      },
      once(event: string, fn: () => void) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      emit(event: string) {
        if (listeners[event]) {
          listeners[event].forEach((fn) => fn());
        }
      },
    };

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    return { req, res, next, getNextCalled: () => nextCalled };
  }

  it('allows public request to proceed when within limits and acquires lock', () => {
    const { req, res, next, getNextCalled } = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(req, res, next);

    assert.equal(getNextCalled(), true);
    assert.equal(res.statusCode, 200);

    // Simulate response finish
    res.emit('finish');
  });

  it('rejects concurrent in-flight refresh for the same product', () => {
    const call1 = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(call1.req, call1.res, call1.next);
    assert.equal(call1.getNextCalled(), true);

    // Call 2 arrives while call 1 is still in flight (not finished)
    const call2 = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(call2.req, call2.res, call2.next);

    assert.equal(call2.getNextCalled(), false);
    assert.equal(call2.res.statusCode, 429);
    assert.equal(call2.res.body.error.code, 'CONCURRENCY_LIMIT');

    // Finish call 1
    call1.res.emit('finish');
  });

  it('enforces 5-minute cooldown for subsequent public refresh calls on same product', () => {
    const call1 = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(call1.req, call1.res, call1.next);
    assert.equal(call1.getNextCalled(), true);
    call1.res.statusCode = 200;
    call1.res.emit('finish'); // finishes and records refresh timestamp

    // Subsequent call immediately after
    const call2 = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(call2.req, call2.res, call2.next);

    assert.equal(call2.getNextCalled(), false);
    assert.equal(call2.res.statusCode, 429);
    assert.equal(call2.res.body.error.code, 'RATE_LIMIT');
    assert.ok(call2.res.headers['Retry-After']);
  });

  it('allows authenticated admin to bypass cooldown and concurrency limits', () => {
    // First, simulate a public request that finished and put product into cooldown
    const call1 = createMockReqRes({ slug: 'sony-wh-1000xm5' });
    productRefreshGuard(call1.req, call1.res, call1.next);
    call1.res.statusCode = 200;
    call1.res.emit('finish');

    // Generate valid admin token
    const adminToken = jwt.sign(
      { userId: 'admin123', email: 'admin@savrivo.com', role: 'admin' },
      config.jwt.secret
    );

    // Admin request arrives during cooldown
    const adminCall = createMockReqRes({
      slug: 'sony-wh-1000xm5',
      authHeader: `Bearer ${adminToken}`,
    });
    productRefreshGuard(adminCall.req, adminCall.res, adminCall.next);

    // Admin bypasses cooldown successfully
    assert.equal(adminCall.getNextCalled(), true);
    assert.equal(adminCall.req.user?.role, 'admin');
  });

  it('rejects invalid authentication bearer tokens with 401', () => {
    const invalidAuthCall = createMockReqRes({
      slug: 'sony-wh-1000xm5',
      authHeader: 'Bearer invalid-token-xyz',
    });
    productRefreshGuard(invalidAuthCall.req, invalidAuthCall.res, invalidAuthCall.next);

    assert.equal(invalidAuthCall.getNextCalled(), false);
    assert.equal(invalidAuthCall.res.statusCode, 401);
    assert.equal(invalidAuthCall.res.body.error.code, 'TOKEN_INVALID');
  });

  it('enforces server-wide max concurrent public refreshes limit', () => {
    const activeCalls = [];
    for (let i = 0; i < MAX_GLOBAL_CONCURRENT_REFRESHES; i++) {
      const call = createMockReqRes({ slug: `product-${i}` });
      productRefreshGuard(call.req, call.res, call.next);
      assert.equal(call.getNextCalled(), true);
      activeCalls.push(call);
    }

    // Attempt one more beyond limit
    const overflowCall = createMockReqRes({ slug: 'product-overflow' });
    productRefreshGuard(overflowCall.req, overflowCall.res, overflowCall.next);

    assert.equal(overflowCall.getNextCalled(), false);
    assert.equal(overflowCall.res.statusCode, 429);
    assert.equal(overflowCall.res.body.error.code, 'CONCURRENCY_LIMIT');

    // Clean up active calls
    activeCalls.forEach((c) => c.res.emit('finish'));
  });
});
