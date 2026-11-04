import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAmazonHost,
  isFlipkartHost,
  isMyntraHost,
  isAjioHost,
  normalizePlatform,
  validatePlatformDomain,
  inferProductPlatform,
  isOfferAllowedForProduct,
  filterOffersForProduct,
} from './merchant-platform';

describe('SAVRIVO Strict Merchant-Platform Isolation', () => {
  describe('Host matchers', () => {
    it('isAmazonHost identifies all Amazon domains and shortlinks', () => {
      assert.equal(isAmazonHost('www.amazon.in'), true);
      assert.equal(isAmazonHost('amazon.in'), true);
      assert.equal(isAmazonHost('amazon.com'), true);
      assert.equal(isAmazonHost('link.amazon'), true);
      assert.equal(isAmazonHost('sub.link.amazon'), true);
      assert.equal(isAmazonHost('a.co'), true);
      assert.equal(isAmazonHost('amzn.in'), true);
      assert.equal(isAmazonHost('amzn.to'), true);
      assert.equal(isAmazonHost('flipkart.com'), false);
      assert.equal(isAmazonHost('notamazon.org'), false);
    });

    it('isFlipkartHost identifies Flipkart domains and shortlinks', () => {
      assert.equal(isFlipkartHost('www.flipkart.com'), true);
      assert.equal(isFlipkartHost('dl.flipkart.com'), true);
      assert.equal(isFlipkartHost('fkrt.it'), true);
      assert.equal(isFlipkartHost('sub.fkrt.it'), true);
      assert.equal(isFlipkartHost('amazon.in'), false);
    });

    it('isMyntraHost identifies Myntra domains', () => {
      assert.equal(isMyntraHost('www.myntra.com'), true);
      assert.equal(isMyntraHost('myntra.com'), true);
      assert.equal(isMyntraHost('amazon.in'), false);
    });

    it('isAjioHost identifies AJIO domains', () => {
      assert.equal(isAjioHost('www.ajio.com'), true);
      assert.equal(isAjioHost('ajio.com'), true);
      assert.equal(isAjioHost('amazon.in'), false);
    });
  });

  describe('normalizePlatform', () => {
    it('normalizes Amazon domain/slug variations to amazon', () => {
      assert.equal(normalizePlatform('amazon'), 'amazon');
      assert.equal(normalizePlatform('amazon-india'), 'amazon');
      assert.equal(normalizePlatform('https://www.amazon.in/dp/B0BDK62PDX'), 'amazon');
      assert.equal(normalizePlatform('https://link.amazon/B08sWmK9f'), 'amazon');
      assert.equal(normalizePlatform('link.amazon'), 'amazon');
      assert.equal(normalizePlatform('a.co'), 'amazon');
      assert.equal(normalizePlatform('https://a.co/d/12345'), 'amazon');
      assert.equal(normalizePlatform('amzn.to/3xyz'), 'amazon');
    });

    it('normalizes Flipkart domain/slug variations to flipkart', () => {
      assert.equal(normalizePlatform('flipkart'), 'flipkart');
      assert.equal(normalizePlatform('https://www.flipkart.com/p/itm123'), 'flipkart');
      assert.equal(normalizePlatform('https://dl.flipkart.com/s/123'), 'flipkart');
      assert.equal(normalizePlatform('fkrt.it/123'), 'flipkart');
    });

    it('normalizes Myntra and AJIO platforms', () => {
      assert.equal(normalizePlatform('myntra'), 'myntra');
      assert.equal(normalizePlatform('https://www.myntra.com/shoes/nike/123'), 'myntra');
      assert.equal(normalizePlatform('ajio'), 'ajio');
      assert.equal(normalizePlatform('https://www.ajio.com/p/461234'), 'ajio');
    });

    it('falls back to generic for unknown or empty input', () => {
      assert.equal(normalizePlatform(undefined), 'generic');
      assert.equal(normalizePlatform(''), 'generic');
      assert.equal(normalizePlatform('walmart.com'), 'generic');
      assert.equal(normalizePlatform('other-store'), 'generic');
    });
  });

  describe('validatePlatformDomain', () => {
    it('validates Amazon domains correctly', () => {
      assert.equal(validatePlatformDomain('https://www.amazon.in/dp/B0BDK62PDX', 'amazon'), true);
      assert.equal(validatePlatformDomain('https://link.amazon/B08sWmK9f', 'amazon'), true);
      assert.equal(validatePlatformDomain('https://a.co/d/abc1234', 'amazon'), true);
      assert.equal(validatePlatformDomain('https://amzn.in/d/abc1234', 'amazon'), true);
      assert.equal(validatePlatformDomain('https://amzn.to/abc1234', 'amazon'), true);
      assert.equal(validatePlatformDomain('https://www.flipkart.com/item', 'amazon'), false);
    });

    it('validates Flipkart domains correctly', () => {
      assert.equal(validatePlatformDomain('https://www.flipkart.com/item', 'flipkart'), true);
      assert.equal(validatePlatformDomain('https://dl.flipkart.com/s/123', 'flipkart'), true);
      assert.equal(validatePlatformDomain('https://fkrt.it/123', 'flipkart'), true);
      assert.equal(validatePlatformDomain('https://www.amazon.in/item', 'flipkart'), false);
    });

    it('validates Myntra and AJIO domains correctly', () => {
      assert.equal(validatePlatformDomain('https://www.myntra.com/shoes', 'myntra'), true);
      assert.equal(validatePlatformDomain('https://www.ajio.com/clothing', 'ajio'), true);
      assert.equal(validatePlatformDomain('https://evil-site.com', 'myntra'), false);
      assert.equal(validatePlatformDomain('https://evil-site.com', 'ajio'), false);
    });

    it('handles invalid URL strings gracefully without crashing', () => {
      assert.equal(validatePlatformDomain('not-a-valid-url', 'amazon'), false);
      assert.equal(validatePlatformDomain('', 'amazon'), false);
    });
  });

  describe('inferProductPlatform', () => {
    it('prefers explicit sourcePlatform on product document', () => {
      const product = {
        sourcePlatform: 'amazon',
        canonicalUrl: 'https://www.flipkart.com/confusing',
      };
      assert.equal(inferProductPlatform(product), 'amazon');
    });

    it('falls back to populated sourceMerchantId if sourcePlatform is missing', () => {
      const product = {
        sourceMerchantId: { slug: 'flipkart', name: 'Flipkart' },
      };
      assert.equal(inferProductPlatform(product), 'flipkart');
    });

    it('falls back to product canonicalUrl if merchant is missing', () => {
      const product = {
        canonicalUrl: 'https://www.myntra.com/product/123',
      };
      assert.equal(inferProductPlatform(product), 'myntra');
    });

    it('falls back to primary offer if legacy product has no platform info', () => {
      const product = {};
      const primaryOffer = {
        productUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
      };
      assert.equal(inferProductPlatform(product, primaryOffer), 'amazon');
    });

    it('correctly handles link.amazon URL in primary offer for legacy records', () => {
      const product = {};
      const primaryOffer = {
        affiliateUrl: 'https://link.amazon/B08sWmK9f',
      };
      assert.equal(inferProductPlatform(product, primaryOffer), 'amazon');
    });
  });

  describe('isOfferAllowedForProduct & filterOffersForProduct', () => {
    const amazonProduct = {
      _id: 'prod-001',
      title: 'iPhone 14',
      sourcePlatform: 'amazon',
      canonicalUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
    };

    const amazonOffer = {
      _id: 'offer-amz',
      productId: 'prod-001',
      merchantId: { slug: 'amazon', name: 'Amazon India' },
      productUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
      affiliateUrl: 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21',
      currentPrice: 58999,
    };

    const amazonShortlinkOffer = {
      _id: 'offer-shortlink',
      productId: 'prod-001',
      merchantId: { slug: 'link', name: 'Link' }, // previously misidentified
      productUrl: 'https://link.amazon/B08sWmK9f',
      affiliateUrl: 'https://link.amazon/B08sWmK9f',
      currentPrice: 2999,
    };

    const flipkartOffer = {
      _id: 'offer-fkrt',
      productId: 'prod-001',
      merchantId: { slug: 'flipkart', name: 'Flipkart' },
      productUrl: 'https://www.flipkart.com/apple-iphone-14/p/itm123',
      affiliateUrl: 'https://www.flipkart.com/apple-iphone-14/p/itm123?affid=savrivo',
      currentPrice: 57999,
    };

    const spoofedAmazonOffer = {
      _id: 'offer-spoof',
      productId: 'prod-001',
      merchantId: { slug: 'amazon', name: 'Amazon India' },
      productUrl: 'https://attacker.example.com/steal-creds', // spoofed URL
      affiliateUrl: 'https://attacker.example.com/affiliate',
      currentPrice: 19999,
    };

    it('allows offer matching the product merchant platform and domain', () => {
      assert.equal(isOfferAllowedForProduct(amazonProduct, amazonOffer), true);
    });

    it('allows link.amazon offer on Amazon product without OFFER_UNAVAILABLE error', () => {
      assert.equal(isOfferAllowedForProduct(amazonProduct, amazonShortlinkOffer), true);
    });

    it('strictly rejects cross-platform offer (Flipkart offer on Amazon product)', () => {
      assert.equal(isOfferAllowedForProduct(amazonProduct, flipkartOffer), false);
    });

    it('strictly rejects cross-platform offer (Amazon offer on Flipkart product)', () => {
      const flipkartProduct = {
        _id: 'prod-002',
        title: 'Flipkart Product',
        sourcePlatform: 'flipkart',
        canonicalUrl: 'https://www.flipkart.com/p/123',
      };
      assert.equal(isOfferAllowedForProduct(flipkartProduct, amazonOffer), false);
    });

    it('strictly rejects domain spoofing even if merchantId claims to be Amazon', () => {
      assert.equal(isOfferAllowedForProduct(amazonProduct, spoofedAmazonOffer), false);
    });

    it('filterOffersForProduct filters out cross-platform and spoofed offers cleanly', () => {
      const allOffers = [amazonOffer, amazonShortlinkOffer, flipkartOffer, spoofedAmazonOffer];
      const allowed = filterOffersForProduct(amazonProduct, allOffers);

      assert.equal(allowed.length, 2);
      assert.equal(allowed[0]._id, 'offer-amz');
      assert.equal(allowed[1]._id, 'offer-shortlink');
    });
  });
});
