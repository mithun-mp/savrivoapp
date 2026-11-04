import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAffiliateRedirectUrl,
  anonymizeIp,
  trackOfferClick,
} from './click.service';
import { Offer } from '../models/Offer.model';
import { Click } from '../models/Click.model';

describe('Affiliate Click Tracking & Redirect Security', () => {
  describe('Redirect Destination Validation', () => {
    it('accepts valid HTTPS retailer destinations', () => {
      assert.equal(
        validateAffiliateRedirectUrl('https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21'),
        true
      );
      assert.equal(
        validateAffiliateRedirectUrl('https://www.flipkart.com/apple-iphone-14/p/itm123?affid=savrivo'),
        true
      );
    });

    it('rejects dangerous URL schemes and local network addresses', () => {
      assert.equal(validateAffiliateRedirectUrl('javascript:alert(1)'), false);
      assert.equal(validateAffiliateRedirectUrl('file:///etc/passwd'), false);
      assert.equal(validateAffiliateRedirectUrl('data:text/html,malicious'), false);
      assert.equal(validateAffiliateRedirectUrl('https://127.0.0.1/admin'), false);
      assert.equal(validateAffiliateRedirectUrl('https://169.254.169.254/latest/meta-data/'), false);
      assert.equal(validateAffiliateRedirectUrl('https://192.168.1.1/router'), false);
      assert.equal(validateAffiliateRedirectUrl('not-a-valid-url'), false);
    });
  });

  describe('IP Anonymization', () => {
    it('generates consistent pseudonymized hash without revealing plaintext IP', () => {
      const hash1 = anonymizeIp('203.0.113.42');
      const hash2 = anonymizeIp('203.0.113.42');
      const hash3 = anonymizeIp('198.51.100.99');

      assert.equal(hash1, hash2);
      assert.notEqual(hash1, hash3);
      assert.equal(hash1.length, 32);
      assert.equal(hash1.includes('203.0.113.42'), false);
    });

    it('handles undefined IP gracefully', () => {
      const hash = anonymizeIp(undefined);
      assert.equal(hash, 'anonymous');
    });
  });

  describe('Offer Click Resolution & Anti-Injection', () => {
    it('rejects malformed offer ID formats with validation error', async () => {
      const result = await trackOfferClick({
        offerId: 'invalid-id-format',
      });
      assert.equal(result.success, false);
      assert.equal(result.error, 'Invalid offer ID format');
    });

    it('rejects non-existent offer ID with not found error', async () => {
      // Mock Offer.findById returning null
      const originalFindById = Offer.findById;
      Offer.findById = (() => ({
        populate: () => ({
          populate: () => Promise.resolve(null),
        }),
      })) as any;

      try {
        const result = await trackOfferClick({
          offerId: '65f01234567890abcdef1234',
        });
        assert.equal(result.success, false);
        assert.equal(result.error, 'Offer not found');
      } finally {
        Offer.findById = originalFindById;
      }
    });

    it('resolves stored affiliate URL and prevents arbitrary destination injection', async () => {
      const mockOffer = {
        _id: '65f01234567890abcdef1234',
        productId: '65f01234567890abcdef0001',
        merchantId: '65f01234567890abcdef0002',
        productUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
        affiliateUrl: 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21',
        status: 'active',
      };

      const originalFindById = Offer.findById;
      const originalClickCreate = Click.create;
      let recordedClick: any = null;

      Offer.findById = (() => ({
        populate: () => ({
          populate: () => Promise.resolve(mockOffer),
        }),
      })) as any;

      Click.create = ((payload: any) => {
        recordedClick = payload;
        return Promise.resolve(payload);
      }) as any;

      try {
        const result = await trackOfferClick({
          offerId: '65f01234567890abcdef1234',
          referrer: 'https://savrivo.in/product/apple-iphone-14',
          userAgent: 'Mozilla/5.0 Test Browser',
          clientIp: '203.0.113.10',
          campaign: 'comparison_table',
        });

        assert.equal(result.success, true);
        assert.equal(result.targetUrl, 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21');

        assert.ok(recordedClick);
        assert.equal(recordedClick.productId, mockOffer.productId);
        assert.equal(recordedClick.merchantId, mockOffer.merchantId);
        assert.equal(recordedClick.targetUrl, mockOffer.affiliateUrl);
        assert.equal(recordedClick.campaign, 'comparison_table');
      } finally {
        Offer.findById = originalFindById;
        Click.create = originalClickCreate;
      }
    });

    it('rejects inactive or expired offers', async () => {
      const mockExpiredOffer = {
        _id: '65f01234567890abcdef1234',
        productId: '65f01234567890abcdef0001',
        merchantId: '65f01234567890abcdef0002',
        productUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
        affiliateUrl: 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21',
        status: 'expired',
      };

      const originalFindById = Offer.findById;
      Offer.findById = (() => ({
        populate: () => ({
          populate: () => Promise.resolve(mockExpiredOffer),
        }),
      })) as any;

      try {
        const result = await trackOfferClick({
          offerId: '65f01234567890abcdef1234',
        });
        assert.equal(result.success, false);
        assert.equal(result.error, 'Offer is inactive or expired');
      } finally {
        Offer.findById = originalFindById;
      }
    });
  });
});

