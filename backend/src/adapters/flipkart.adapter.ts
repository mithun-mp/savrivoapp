import { config } from '../config/env';
import type {
  MerchantAdapter,
  MerchantProductDetails,
  MerchantImage,
  MerchantOfferData,
  MerchantRefreshResult,
} from './merchant-adapter.interface';

export const FLIPKART_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class FlipkartAdapter implements MerchantAdapter {
  readonly merchantType = 'flipkart';

  public isApiConfigured(): boolean {
    return Boolean(config.flipkart.affiliateId && config.flipkart.token);
  }

  public generateAffiliateLink(productUrl: string, options?: { customTag?: string; subId?: string }): string {
    const affiliateId = options?.customTag || config.flipkart.affiliateId;
    if (!affiliateId) {
      return productUrl;
    }

    try {
      const parsed = new URL(productUrl);
      parsed.searchParams.set('affid', affiliateId);
      if (options?.subId) {
        parsed.searchParams.set('affExtParam1', options.subId);
      }
      return parsed.toString();
    } catch {
      return productUrl;
    }
  }

  public generateCanonicalUrl(productUrl: string): string {
    try {
      const parsed = new URL(productUrl);
      const pid = parsed.searchParams.get('pid');
      if (pid) {
        const cleanPath = parsed.pathname.split('/p/')[0];
        if (cleanPath && cleanPath !== '/') {
          return `https://www.flipkart.com${cleanPath}/p/itm?pid=${pid}`;
        }
        return `https://www.flipkart.com/p/itm?pid=${pid}`;
      }
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return productUrl;
    }
  }

  public generateSearchUrl(query: string, options?: { customTag?: string }): string {
    const affiliateId = options?.customTag || config.flipkart.affiliateId;
    const base = `https://www.flipkart.com/search?q=${encodeURIComponent(query.trim())}`;
    return affiliateId ? `${base}&affid=${affiliateId}` : base;
  }

  public isCacheValid(lastUpdated?: Date): boolean {
    if (!lastUpdated) return false;
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    return ageMs >= 0 && ageMs < FLIPKART_CACHE_TTL_MS;
  }

  public async fetchProductDetails(_externalId: string): Promise<MerchantProductDetails | null> {
    return null;
  }

  public async fetchProductImages(_externalId: string): Promise<MerchantImage[]> {
    return [];
  }

  public async fetchOffers(_externalId: string): Promise<MerchantOfferData[]> {
    return [];
  }

  public async fetchAvailability(_externalId: string): Promise<'in_stock' | 'out_of_stock' | 'unknown'> {
    return 'unknown';
  }

  public async refreshProductData(
    externalId: string,
    currentOffer?: { currentPrice?: number; originalPrice?: number; offerLastVerifiedAt?: Date }
  ): Promise<MerchantRefreshResult> {
    const now = new Date();
    const isStale = !this.isCacheValid(currentOffer?.offerLastVerifiedAt);

    return {
      success: false,
      refreshedAt: now,
      isStale,
      warning: 'Flipkart live affiliate API integration is currently operating in manual feed mode.',
      cacheExpiresAt: currentOffer?.offerLastVerifiedAt
        ? new Date(new Date(currentOffer.offerLastVerifiedAt).getTime() + FLIPKART_CACHE_TTL_MS)
        : undefined,
    };
  }
}

export const defaultFlipkartAdapter = new FlipkartAdapter();
