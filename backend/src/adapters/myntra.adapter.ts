import type {
  MerchantAdapter,
  MerchantProductDetails,
  MerchantImage,
  MerchantOfferData,
  MerchantRefreshResult,
} from './merchant-adapter.interface';

export const MYNTRA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class MyntraAdapter implements MerchantAdapter {
  readonly merchantType = 'myntra';

  public isApiConfigured(): boolean {
    return false;
  }

  public generateAffiliateLink(productUrl: string, _options?: { customTag?: string; subId?: string }): string {
    return productUrl;
  }

  public generateCanonicalUrl(productUrl: string): string {
    try {
      const parsed = new URL(productUrl);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return productUrl;
    }
  }

  public generateSearchUrl(query: string, _options?: { customTag?: string }): string {
    const slug = encodeURIComponent(query.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
    return `https://www.myntra.com/${slug}`;
  }

  public isCacheValid(lastUpdated?: Date): boolean {
    if (!lastUpdated) return false;
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    return ageMs >= 0 && ageMs < MYNTRA_CACHE_TTL_MS;
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
    _externalId: string,
    currentOffer?: { currentPrice?: number; originalPrice?: number; offerLastVerifiedAt?: Date }
  ): Promise<MerchantRefreshResult> {
    const now = new Date();
    const isStale = !this.isCacheValid(currentOffer?.offerLastVerifiedAt);

    return {
      success: false,
      refreshedAt: now,
      isStale,
      warning: 'Myntra live affiliate API is operating in manual feed mode.',
      cacheExpiresAt: currentOffer?.offerLastVerifiedAt
        ? new Date(new Date(currentOffer.offerLastVerifiedAt).getTime() + MYNTRA_CACHE_TTL_MS)
        : undefined,
    };
  }
}

export const defaultMyntraAdapter = new MyntraAdapter();

