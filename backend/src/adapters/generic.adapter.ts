import type {
  MerchantAdapter,
  MerchantProductDetails,
  MerchantImage,
  MerchantOfferData,
  MerchantRefreshResult,
} from './merchant-adapter.interface';

export class GenericAdapter implements MerchantAdapter {
  readonly merchantType = 'generic';

  public isApiConfigured(): boolean {
    return false;
  }

  public generateAffiliateLink(baseUrl: string, _options?: { customTag?: string; subId?: string }): string {
    return baseUrl;
  }

  public validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  public isCacheValid(_lastUpdated?: Date): boolean {
    return true;
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
    _currentOffer?: unknown
  ): Promise<MerchantRefreshResult> {
    return {
      success: false,
      refreshedAt: new Date(),
      isStale: false,
      warning: 'Generic merchant adapter does not provide automated API refresh.',
    };
  }
}

export const defaultGenericAdapter = new GenericAdapter();
