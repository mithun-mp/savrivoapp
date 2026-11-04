import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProductBySlug } from './product.service';
import { Product } from '../models/Product.model';
import { Offer } from '../models/Offer.model';
import { validateImageUrl, sanitizeProductImages } from '../modules/product-import/image-validator';
import { MerchantRefreshService } from './merchant-refresh.service';

describe('Product Detail Resolution, Images & Merchant Data Refresh', () => {
  describe('Product Detail Route Resolution & Strict Merchant-Platform Isolation', () => {
    it('resolves product by slug and enforces strict merchant platform isolation on offers', async () => {
      const mockProduct = {
        _id: '65f01234567890abcdef0001',
        title: 'Noise Cancelling Wireless Headphones',
        slug: 'noise-cancelling-wireless-headphones',
        brand: 'SoundMaster',
        status: 'published',
        sourcePlatform: 'amazon',
        images: [{ url: 'https://m.media-amazon.com/images/I/61bK6PMOC3L.jpg', alt: 'Headphones' }],
        highlights: ['Industry-leading noise cancellation', '30-hour battery life'],
      };

      const mockOffers = [
        {
          _id: '65f01234567890abcdef1001',
          productId: '65f01234567890abcdef0001',
          merchantId: { name: 'Amazon India', slug: 'amazon-india', logoUrl: 'https://amazon.in/logo.png' },
          productUrl: 'https://www.amazon.in/dp/B09XS7JWHH',
          affiliateUrl: 'https://www.amazon.in/dp/B09XS7JWHH?tag=savrivo-21',
          currentPrice: 26990,
          originalPrice: 34990,
          currency: 'INR',
          availability: 'in_stock',
          status: 'active',
        },
        {
          _id: '65f01234567890abcdef1002',
          productId: '65f01234567890abcdef0001',
          merchantId: { name: 'Flipkart', slug: 'flipkart', logoUrl: 'https://flipkart.com/logo.png' },
          productUrl: 'https://www.flipkart.com/headphones/p/itm123',
          affiliateUrl: 'https://www.flipkart.com/headphones/p/itm123?affid=savrivo',
          currentPrice: 27990,
          originalPrice: 34990,
          currency: 'INR',
          availability: 'in_stock',
          status: 'active',
        },
      ];

      const originalProductFindOne = Product.findOne;
      const originalOfferFind = Offer.find;

      Product.findOne = (() => ({
        populate: () => ({
          lean: () => Promise.resolve(mockProduct),
        }),
      })) as any;

      Offer.find = (() => ({
        populate: () => ({
          sort: () => ({
            lean: () => Promise.resolve(mockOffers),
          }),
        }),
      })) as any;

      try {
        const result = await getProductBySlug('noise-cancelling-wireless-headphones');
        assert.ok(result);
        assert.equal(result.title, mockProduct.title);
        assert.equal(result.slug, mockProduct.slug);
        assert.equal(result.sourcePlatform, 'amazon');
        // Under strict isolation, only the Amazon offer is returned; cross-platform Flipkart offer is filtered out
        assert.equal((result as any).offers?.length, 1);
        assert.equal((result as any).offers[0].currentPrice, 26990);
        assert.equal((result as any).offers[0].merchantId.name, 'Amazon India');
      } finally {
        Product.findOne = originalProductFindOne;
        Offer.find = originalOfferFind;
      }
    });

    it('returns null for unknown product slug', async () => {
      const originalProductFindOne = Product.findOne;
      Product.findOne = (() => ({
        populate: () => ({
          lean: () => Promise.resolve(null),
        }),
      })) as any;

      try {
        const result = await getProductBySlug('nonexistent-product-slug');
        assert.equal(result, null);
      } finally {
        Product.findOne = originalProductFindOne;
      }
    });
  });

  describe('Merchant Image Validation & Fallback Scrubbing', () => {
    it('accepts legitimate Amazon and Flipkart image CDN URLs', async () => {
      const validAmazon = await validateImageUrl(
        'https://m.media-amazon.com/images/I/61bK6PMOC3L._SX679_.jpg'
      );
      assert.equal(validAmazon, true);

      const validFlixcart = await validateImageUrl(
        'https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/apple-iphone-14.jpeg'
      );
      assert.equal(validFlixcart, true);
    });

    it('rejects tracking pixels, empty data URIs and non-image endpoints', async () => {
      assert.equal(await validateImageUrl('https://m.media-amazon.com/images/G/01/1x1.gif'), false);
      assert.equal(await validateImageUrl('https://tracker.com/pixel.gif?id=123'), false);
      assert.equal(await validateImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE='), false);
      assert.equal(await validateImageUrl(''), false);
    });

    it('sanitizes and deduplicates image lists, preserving primary image order', async () => {
      const rawImages = [
        { url: 'https://m.media-amazon.com/images/I/61bK6PMOC3L.jpg', alt: 'Front view' },
        { url: 'https://m.media-amazon.com/images/I/61bK6PMOC3L.jpg', alt: 'Duplicate' },
        { url: 'https://m.media-amazon.com/images/G/01/1x1.gif', alt: 'Pixel' },
        { url: 'https://m.media-amazon.com/images/I/71G4AnScWUL.jpg', alt: 'Back view' },
      ];

      const cleaned = await sanitizeProductImages(rawImages, 'Apple iPhone 14');
      assert.equal(cleaned.length, 2);
      assert.equal(cleaned[0].url, 'https://m.media-amazon.com/images/I/61bK6PMOC3L.jpg');
      assert.equal(cleaned[0].isPrimary, true);
      assert.equal(cleaned[1].url, 'https://m.media-amazon.com/images/I/71G4AnScWUL.jpg');
      assert.equal(cleaned[1].isPrimary, false);
    });
  });

  describe('Live Merchant Refresh Service', () => {
    const refreshService = new MerchantRefreshService();

    it('preserves existing offer data and marks stale when provider API is unavailable', async () => {
      const mockOffer = {
        _id: '65f01234567890abcdef1001',
        productId: '65f01234567890abcdef0001',
        merchantId: { name: 'Amazon India', slug: 'amazon' },
        productUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
        affiliateUrl: 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21',
        currentPrice: 59999,
        originalPrice: 69900,
        offerLastVerifiedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago (> 24h)
        save: () => Promise.resolve(),
      };

      const originalOfferFindById = Offer.findById;
      Offer.findById = (() => ({
        populate: () => ({
          populate: () => Promise.resolve(mockOffer),
        }),
      })) as any;

      try {
        const { offer, refreshResult } = await refreshService.refreshOffer(
          '65f01234567890abcdef1001'
        );

        // Does not wipe existing price
        assert.equal(offer.currentPrice, 59999);
        assert.equal(refreshResult.isStale, true);
        assert.ok(refreshResult.warning?.includes('Amazon Creators API / PA-API credentials not configured'));
      } finally {
        Offer.findById = originalOfferFindById;
      }
    });
  });
});
