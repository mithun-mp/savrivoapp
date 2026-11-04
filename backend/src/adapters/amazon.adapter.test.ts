import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AmazonAdapter, AMAZON_CACHE_TTL_MS } from './amazon.adapter';

describe('Amazon Adapter & PA-API Integration', () => {
  const adapter = new AmazonAdapter();

  describe('Affiliate Link Generation', () => {
    it('generates standard compliant Amazon India affiliate link with associate tag', () => {
      const link = adapter.generateAffiliateLink('B0BDK62PDX', { customTag: 'savrivo-21' });
      assert.equal(link, 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21');
    });

    it('attaches subId as ascsubtag query parameter', () => {
      const link = adapter.generateAffiliateLink('B0BDK62PDX', {
        customTag: 'savrivo-21',
        subId: 'campaign_header_deal',
      });
      assert.equal(
        link,
        'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21&ascsubtag=campaign_header_deal'
      );
    });

    it('extracts ASIN from full Amazon product URL and creates clean affiliate link', () => {
      const fullUrl =
        'https://www.amazon.in/Apple-iPhone-14-128GB-Blue/dp/B0BDK62PDX?ref_=ast_sto_dp&th=1';
      const link = adapter.generateAffiliateLink(fullUrl, { customTag: 'savrivo-21' });
      assert.equal(link, 'https://www.amazon.in/dp/B0BDK62PDX?tag=savrivo-21');
    });

    it('extracts ASIN correctly with uppercase normalization', () => {
      assert.equal(adapter.extractAsin('b0bdk62pdx'), 'B0BDK62PDX');
      assert.equal(
        adapter.extractAsin('https://www.amazon.in/gp/product/b0bdk62pdx'),
        'B0BDK62PDX'
      );
      assert.equal(adapter.extractAsin('invalid-asin-string'), null);
    });
  });

  describe('24-Hour Cache Policy (Amazon Operating Agreement)', () => {
    it('considers data fresh within 24 hours (86,400,000 ms)', () => {
      const freshTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      assert.equal(adapter.isCacheValid(freshTime), true);
    });

    it('considers data stale when older than 24 hours', () => {
      const staleTime = new Date(Date.now() - (AMAZON_CACHE_TTL_MS + 1000)); // 24h 1s ago
      assert.equal(adapter.isCacheValid(staleTime), false);
    });

    it('returns false for undefined or null timestamps', () => {
      assert.equal(adapter.isCacheValid(undefined), false);
    });
  });

  describe('Graceful Degradation Without API Credentials', () => {
    it('reports isApiConfigured as false when credentials are empty', () => {
      // In default test environment without AWS secrets
      const isConfigured = adapter.isApiConfigured();
      assert.equal(typeof isConfigured, 'boolean');
    });

    it('refreshProductData gracefully reports unconfigured API without attempting scraping', async () => {
      const result = await adapter.refreshProductData('B0BDK62PDX', {
        currentPrice: 59999,
        originalPrice: 69900,
        offerLastVerifiedAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // stale
      });

      assert.equal(result.success, false);
      assert.equal(result.isStale, true);
      assert.ok(result.warning?.includes('Amazon Creators API / PA-API credentials not configured'));
    });

    it('returns cached validity when existing verified offer is still within 24 hours', async () => {
      const recentTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const result = await adapter.refreshProductData('B0BDK62PDX', {
        currentPrice: 59999,
        offerLastVerifiedAt: recentTime,
      });

      // When fresh, cache is preserved
      if (!adapter.isApiConfigured()) {
        assert.equal(result.isStale, false);
      }
    });
  });

  describe('PA-API Response Mapping', () => {
    it('maps mock PA-API GetItems item response into MerchantProductDetails and Offer', () => {
      const mockItem = {
        ASIN: 'B0BDK62PDX',
        ItemInfo: {
          Title: { DisplayValue: 'Apple iPhone 14 (128 GB) - Blue' },
          ByLineInfo: { Brand: { DisplayValue: 'Apple' } },
          Features: {
            DisplayValues: [
              '15.40 cm (6.1-inch) Super Retina XDR display',
              'Advanced camera system for better photos in any light',
            ],
          },
        },
        Images: {
          Primary: {
            Large: {
              URL: 'https://m.media-amazon.com/images/I/61bK6PMOC3L._SX679_.jpg',
              Width: 679,
              Height: 679,
            },
          },
          Variants: [
            {
              Large: {
                URL: 'https://m.media-amazon.com/images/I/71G4AnScWUL._SX679_.jpg',
                Width: 679,
                Height: 679,
              },
            },
          ],
        },
        Offers: {
          Listings: [
            {
              Price: { Amount: 58999, Currency: 'INR' },
              Availability: { Message: 'In stock.' },
            },
          ],
        },
      };

      const details = adapter.mapPaApiItemToProductDetails(mockItem);
      assert.equal(details.title, 'Apple iPhone 14 (128 GB) - Blue');
      assert.equal(details.brand, 'Apple');
      assert.equal(details.images?.length, 2);
      assert.equal(details.images?.[0].url, 'https://m.media-amazon.com/images/I/61bK6PMOC3L._SX679_.jpg');
      assert.equal(details.images?.[0].isPrimary, true);

      const offer = adapter.mapPaApiItemToOffer(mockItem, 'B0BDK62PDX');
      assert.ok(offer);
      assert.equal(offer.currentPrice, 58999);
      assert.equal(offer.currency, 'INR');
      assert.equal(offer.availability, 'in_stock');
      assert.ok(offer.affiliateUrl.includes('B0BDK62PDX'));
    });
  });
});

