import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './app';
import { generateToken } from './services/auth.service';
import { createProductSchema, updateProductSchema } from './validators/product.validator';
import { createMerchantSchema, updateMerchantSchema } from './validators/merchant.validator';
import { createOfferSchema, updateOfferSchema } from './validators/offer.validator';
import { createCategorySchema, updateCategorySchema } from './validators/category.validator';
import { createGuideSchema, updateGuideSchema } from './validators/guide.validator';
import { Merchant } from './models/Merchant.model';
import { Offer } from './models/Offer.model';
import { Category } from './models/Category.model';
import { Product } from './models/Product.model';
import { Guide } from './models/Guide.model';
import * as merchantService from './services/merchant.service';
import * as categoryService from './services/category.service';
import * as productService from './services/product.service';

describe('Admin CRUD Schemas, Relational Integrity & API Route Tests', () => {
  let server: http.Server;
  let port: number;
  let adminToken: string;
  let reqCounter = 1;

  // Stored originals for cleanup
  const originalMerchantCountDocuments = Offer.countDocuments;
  const originalProductCountDocuments = Product.countDocuments;
  const originalMerchantFindById = Merchant.findById;
  const originalMerchantFindByIdAndDelete = Merchant.findByIdAndDelete;
  const originalProductFindById = Product.findById;
  const originalProductFindByIdAndUpdate = Product.findByIdAndUpdate;
  const originalOfferFindById = Offer.findById;
  const originalOfferFindByIdAndDelete = Offer.findByIdAndDelete;
  const originalCategoryFindById = Category.findById;
  const originalCategoryFindByIdAndDelete = Category.findByIdAndDelete;
  const originalGuideFindById = Guide.findById;
  const originalGuideFindByIdAndDelete = Guide.findByIdAndDelete;

  before(async () => {
    adminToken = generateToken({
      userId: '65f01234567890abcdef1234',
      email: 'verified-admin@savrivo.test',
      role: 'superadmin',
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    port = address.port;
  });

  after(async () => {
    Offer.countDocuments = originalMerchantCountDocuments;
    Product.countDocuments = originalProductCountDocuments;
    Merchant.findById = originalMerchantFindById;
    Merchant.findByIdAndDelete = originalMerchantFindByIdAndDelete;
    Product.findById = originalProductFindById;
    Product.findByIdAndUpdate = originalProductFindByIdAndUpdate;
    Offer.findById = originalOfferFindById;
    Offer.findByIdAndDelete = originalOfferFindByIdAndDelete;
    Category.findById = originalCategoryFindById;
    Category.findByIdAndDelete = originalCategoryFindByIdAndDelete;
    Guide.findById = originalGuideFindById;
    Guide.findByIdAndDelete = originalGuideFindByIdAndDelete;

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function makeRequest(
    method: string,
    path: string,
    payload?: Record<string, unknown>,
    token?: string,
    overrideHeaders?: Record<string, string>
  ): Promise<{ statusCode?: number; body: string }> {
    return new Promise((resolve, reject) => {
      const postData = payload ? JSON.stringify(payload) : '';
      const clientIp = `203.0.113.${(reqCounter++ % 200) + 1}`;
      const headers: Record<string, string | number> = {
        'X-Forwarded-For': clientIp,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      if (overrideHeaders) {
        Object.assign(headers, overrideHeaders);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers,
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
      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // -------------------------------------------------------------
  // 1. ZOD SCHEMA & FORM VALIDATION TESTS
  // -------------------------------------------------------------
  describe('Zod Validation Schemas & Data Normalization', () => {
    it('Product Schema: accepts valid payload, converts empty URLs/IDs to undefined, rejects missing title', () => {
      const valid = createProductSchema.parse({
        title: 'Bowers & Wilkins Px8',
        canonicalUrl: '',
        categoryId: '',
      });
      assert.equal(valid.title, 'Bowers & Wilkins Px8');
      assert.equal(valid.canonicalUrl, undefined);
      assert.equal(valid.categoryId, undefined);

      assert.throws(() => {
        createProductSchema.parse({ title: '' });
      });
    });

    it('Merchant Schema: accepts valid URL, sanitizes empty strings, rejects invalid URL format', () => {
      const valid = createMerchantSchema.parse({
        name: 'Harrods Luxury',
        websiteUrl: 'https://harrods.com',
        logoUrl: '',
        affiliateProgramName: '',
      });
      assert.equal(valid.name, 'Harrods Luxury');
      assert.equal(valid.logoUrl, undefined);

      assert.throws(() => {
        createMerchantSchema.parse({
          name: 'Invalid Merchant',
          websiteUrl: 'not-a-valid-url',
        });
      });
    });

    it('Merchant Schema: accepts valid root-level Amazon India payload', () => {
      const valid = createMerchantSchema.parse({
        name: 'Amazon India',
        websiteUrl: 'https://amazon.in',
        affiliateProgramName: 'Amazon Associates',
      });
      assert.equal(valid.name, 'Amazon India');
      assert.equal(valid.websiteUrl, 'https://amazon.in');
      assert.equal(valid.affiliateProgramName, 'Amazon Associates');
      assert.equal(valid.enabled, true);
    });

    it('Merchant Schema: rejects payload missing name', () => {
      assert.throws(
        () => createMerchantSchema.parse({ websiteUrl: 'https://amazon.in' }),
        (err: any) => err.errors.some((e: any) => e.path.includes('name') && e.message === 'Required')
      );
    });

    it('Merchant Schema: rejects payload missing websiteUrl', () => {
      assert.throws(
        () => createMerchantSchema.parse({ name: 'Amazon India' }),
        (err: any) => err.errors.some((e: any) => e.path.includes('websiteUrl') && e.message === 'Required')
      );
    });

    it('Merchant Schema: rejects nested wrapper object { merchant: { ... } } as missing root-level fields', () => {
      assert.throws(
        () => createMerchantSchema.parse({
          merchant: {
            name: 'Amazon India',
            websiteUrl: 'https://amazon.in',
          },
        }),
        (err: any) =>
          err.errors.some((e: any) => e.path.includes('name') && e.message === 'Required') &&
          err.errors.some((e: any) => e.path.includes('websiteUrl') && e.message === 'Required')
      );
    });

    it('Offer Schema: coerces numeric price strings and rejects invalid productUrl', () => {
      const valid = createOfferSchema.parse({
        productId: '60d5ec49f1b2c8b1f8e4e1a1',
        merchantId: '60d5ec49f1b2c8b1f8e4e1a2',
        productUrl: 'https://amazon.in/dp/B09XYZ',
        currentPrice: '49990' as unknown as number,
        originalPrice: '59990' as unknown as number,
      });
      assert.equal(valid.currentPrice, 49990);
      assert.equal(valid.originalPrice, 59990);

      assert.throws(() => {
        createOfferSchema.parse({
          productId: '60d5ec49f1b2c8b1f8e4e1a1',
          merchantId: '60d5ec49f1b2c8b1f8e4e1a2',
          productUrl: 'not-a-url',
          currentPrice: '49990' as unknown as number,
        });
      });
    });

    it('Category Schema: coerces displayOrder string and rejects empty name', () => {
      const valid = createCategorySchema.parse({
        name: 'Spatial Audio',
        displayOrder: '3' as unknown as number,
        image: '',
      });
      assert.equal(valid.name, 'Spatial Audio');
      assert.equal(valid.displayOrder, 3);
      assert.equal(valid.image, undefined);

      assert.throws(() => {
        createCategorySchema.parse({ name: '' });
      });
    });

    it('Guide Schema: parses valid guide and sanitizes empty strings to undefined', () => {
      const valid = createGuideSchema.parse({
        title: 'The Art of Analog Precision',
        coverImage: '',
        excerpt: '',
      });
      assert.equal(valid.title, 'The Art of Analog Precision');
      assert.equal(valid.coverImage, undefined);
      assert.equal(valid.excerpt, undefined);

      assert.throws(() => {
        createGuideSchema.parse({ title: '' });
      });
    });
  });

  // -------------------------------------------------------------
  // 2. AUTHENTICATION & AUTHORIZATION ENFORCEMENT
  // -------------------------------------------------------------
  describe('Admin Route Authentication & Authorization Enforcement', () => {
    it('rejects unauthenticated GET /api/admin/merchants with HTTP 401 UNAUTHORIZED', async () => {
      const res = await makeRequest('GET', '/api/admin/merchants');
      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    it('rejects unauthenticated POST /api/admin/products with HTTP 401 UNAUTHORIZED', async () => {
      const res = await makeRequest('POST', '/api/admin/products', { title: 'Test Product' });
      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNAUTHORIZED');
    });

    it('rejects unauthenticated DELETE /api/admin/offers/:id with HTTP 401', async () => {
      const res = await makeRequest('DELETE', '/api/admin/offers/60d5ec49f1b2c8b1f8e4e1a1');
      assert.equal(res.statusCode, 401);
    });

    it('rejects request with malformed / forged Bearer token with HTTP 401', async () => {
      const res = await makeRequest(
        'GET',
        '/api/admin/merchants',
        undefined,
        'invalid.bearer.token.signature'
      );
      assert.equal(res.statusCode, 401);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'TOKEN_INVALID');
    });
  });

  // -------------------------------------------------------------
  // 3. ROUTE VALIDATION FAILURES & ERROR HANDLING (HTTP 400)
  // -------------------------------------------------------------
  describe('Admin Route Payload Validation Failures (HTTP 400)', () => {
    it('returns HTTP 400 with VALIDATION_ERROR when creating product without title', async () => {
      const res = await makeRequest('POST', '/api/admin/products', {}, adminToken);
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(json.error.details));
      assert.ok(json.error.details.some((d: { field: string }) => d.field === 'title'));
    });

    it('returns HTTP 400 with VALIDATION_ERROR when creating merchant with invalid URL', async () => {
      const res = await makeRequest(
        'POST',
        '/api/admin/merchants',
        { name: 'Devialet Store', websiteUrl: 'not_a_valid_url' },
        adminToken
      );
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
      assert.ok(json.error.details.some((d: { field: string }) => d.field === 'websiteUrl'));
    });

    it('returns HTTP 400 when merchant payload is nested under wrapper object', async () => {
      const res = await makeRequest(
        'POST',
        '/api/admin/merchants',
        {
          merchant: {
            name: 'Amazon India',
            websiteUrl: 'https://amazon.in',
            affiliateProgramName: 'Amazon Associates',
          },
        },
        adminToken
      );
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
      assert.ok(json.error.details.some((d: any) => d.field === 'name' && d.message === 'Required'));
      assert.ok(json.error.details.some((d: any) => d.field === 'websiteUrl' && d.message === 'Required'));
    });

    it('returns HTTP 400 when Content-Type application/json is omitted (body parser ignores payload)', async () => {
      const res = await makeRequest(
        'POST',
        '/api/admin/merchants',
        {
          name: 'Amazon India',
          websiteUrl: 'https://amazon.in',
        },
        adminToken,
        { 'Content-Type': 'text/plain' }
      );
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
      assert.ok(json.error.details.some((d: any) => d.field === 'name' && d.message === 'Required'));
      assert.ok(json.error.details.some((d: any) => d.field === 'websiteUrl' && d.message === 'Required'));
    });

    it('successfully creates merchant with HTTP 201 when root-level payload and Content-Type are sent', async () => {
      const originalSave = Merchant.prototype.save;
      (Merchant.prototype as any).save = function () {
        return Promise.resolve(this);
      };

      try {
        const res = await makeRequest(
          'POST',
          '/api/admin/merchants',
          {
            name: 'Amazon India',
            websiteUrl: 'https://amazon.in',
            affiliateProgramName: 'Amazon Associates',
          },
          adminToken
        );
        assert.equal(res.statusCode, 201);
        const json = JSON.parse(res.body);
        assert.equal(json.success, true);
        assert.equal(json.message, 'Merchant created');
        assert.equal(json.data.name, 'Amazon India');
        assert.equal(json.data.websiteUrl, 'https://amazon.in');
        assert.equal(json.data.affiliateProgramName, 'Amazon Associates');
      } finally {
        Merchant.prototype.save = originalSave;
      }
    });

    it('returns HTTP 400 with VALIDATION_ERROR when creating offer with missing required fields', async () => {
      const res = await makeRequest('POST', '/api/admin/offers', { currentPrice: 1999 }, adminToken);
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns HTTP 400 with VALIDATION_ERROR when creating category without name', async () => {
      const res = await makeRequest('POST', '/api/admin/categories', {}, adminToken);
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns HTTP 400 with VALIDATION_ERROR when creating guide without title', async () => {
      const res = await makeRequest('POST', '/api/admin/guides', {}, adminToken);
      assert.equal(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------------
  // 4. NON-EXISTENT RECORD NOT FOUND (HTTP 404)
  // -------------------------------------------------------------
  describe('Admin Entity Non-Existent ID Handling (HTTP 404)', () => {
    it('returns HTTP 404 NOT_FOUND when product does not exist', async () => {
      (Product as any).findById = () => ({
        populate: () => ({
          lean: () => Promise.resolve(null),
        }),
      });

      const res = await makeRequest(
        'GET',
        '/api/admin/products/60d5ec49f1b2c8b1f8e4e199',
        undefined,
        adminToken
      );
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'NOT_FOUND');
    });

    it('returns HTTP 404 NOT_FOUND when merchant does not exist for deletion', async () => {
      (Offer as any).countDocuments = () => Promise.resolve(0);
      (Merchant as any).findByIdAndDelete = () => Promise.resolve(null);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/merchants/60d5ec49f1b2c8b1f8e4e199',
        undefined,
        adminToken
      );
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'NOT_FOUND');
    });

    it('returns HTTP 404 NOT_FOUND when offer does not exist for deletion', async () => {
      (Offer as any).findByIdAndDelete = () => Promise.resolve(null);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/offers/60d5ec49f1b2c8b1f8e4e199',
        undefined,
        adminToken
      );
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'NOT_FOUND');
    });

    it('returns HTTP 404 NOT_FOUND when category does not exist for deletion', async () => {
      (Product as any).countDocuments = () => Promise.resolve(0);
      (Category as any).findByIdAndDelete = () => Promise.resolve(null);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/categories/60d5ec49f1b2c8b1f8e4e199',
        undefined,
        adminToken
      );
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'NOT_FOUND');
    });

    it('returns HTTP 404 NOT_FOUND when guide does not exist for deletion', async () => {
      (Guide as any).findByIdAndDelete = () => Promise.resolve(null);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/guides/60d5ec49f1b2c8b1f8e4e199',
        undefined,
        adminToken
      );
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error.code, 'NOT_FOUND');
    });
  });

  // -------------------------------------------------------------
  // 5. RELATIONAL INTEGRITY RESTRICTION POLICIES (HTTP 409 CONFLICT)
  // -------------------------------------------------------------
  describe('Relational Integrity Restriction Policies (HTTP 409)', () => {
    it('blocks merchant deletion with HTTP 409 when active offers exist', async () => {
      // Mock Offer.countDocuments to return 3 active offers
      (Offer as any).countDocuments = () => Promise.resolve(3);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/merchants/60d5ec49f1b2c8b1f8e4e1a2',
        undefined,
        adminToken
      );

      assert.equal(res.statusCode, 409);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'RELATIONAL_RESTRICTION');
      assert.ok(json.error.message.includes('3 offer(s) are associated'));
    });

    it('blocks category deletion with HTTP 409 when products are categorized under it', async () => {
      // Mock Product.countDocuments to return 7 products
      (Product as any).countDocuments = () => Promise.resolve(7);

      const res = await makeRequest(
        'DELETE',
        '/api/admin/categories/60d5ec49f1b2c8b1f8e4e1a3',
        undefined,
        adminToken
      );

      assert.equal(res.statusCode, 409);
      const json = JSON.parse(res.body);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'RELATIONAL_RESTRICTION');
      assert.ok(json.error.message.includes('7 product(s) are associated'));
    });

    it('allows merchant deletion when zero offers exist', async () => {
      (Offer as any).countDocuments = () => Promise.resolve(0);
      (Merchant as any).findByIdAndDelete = () =>
        Promise.resolve({ _id: '60d5ec49f1b2c8b1f8e4e1a2', name: 'Clean Merchant' });

      const res = await makeRequest(
        'DELETE',
        '/api/admin/merchants/60d5ec49f1b2c8b1f8e4e1a2',
        undefined,
        adminToken
      );

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.message, 'Merchant deleted');
    });

    it('allows category deletion when zero products exist', async () => {
      (Product as any).countDocuments = () => Promise.resolve(0);
      (Category as any).findByIdAndDelete = () =>
        Promise.resolve({ _id: '60d5ec49f1b2c8b1f8e4e1a3', name: 'Clean Category' });

      const res = await makeRequest(
        'DELETE',
        '/api/admin/categories/60d5ec49f1b2c8b1f8e4e1a3',
        undefined,
        adminToken
      );

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.message, 'Category deleted');
    });
  });

  // -------------------------------------------------------------
  // 6. BUSINESS LOGIC & LIFECYCLE SERVICE METHODS
  // -------------------------------------------------------------
  describe('Entity Lifecycle Service Implementations', () => {
    it('productService.deleteProduct performs non-destructive soft archive', async () => {
      let updatedFilter: any = null;
      let updatedPayload: any = null;
      (Product as any).findByIdAndUpdate = (id: string, update: any, options: any) => {
        updatedFilter = id;
        updatedPayload = update;
        return Promise.resolve({ _id: id, status: 'archived' });
      };

      const result = await productService.deleteProduct('test-prod-123');
      assert.equal(updatedFilter, 'test-prod-123');
      assert.deepEqual(updatedPayload, { $set: { status: 'archived' } });
      assert.equal((result as any).status, 'archived');
    });

    it('merchantService.toggleMerchant toggles enabled state cleanly', async () => {
      let saved = false;
      const mockMerchant = {
        _id: 'merchant-123',
        enabled: true,
        save: function () {
          saved = true;
          return Promise.resolve(this);
        },
      };
      (Merchant as any).findById = () => Promise.resolve(mockMerchant);

      const toggled = await merchantService.toggleMerchant('merchant-123');
      assert.equal(saved, true);
      assert.equal(toggled.enabled, false);
    });
  });
});
