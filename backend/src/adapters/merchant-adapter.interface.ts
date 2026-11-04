export interface MerchantProductDetails {
  title?: string;
  brand?: string;
  description?: string;
  images?: MerchantImage[];
  specifications?: Array<{ key: string; value: string }>;
  features?: string[];
  skuOrAsin?: string;
  canonicalUrl?: string;
}

export interface MerchantImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

export interface MerchantOfferData {
  currentPrice?: number;
  originalPrice?: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  affiliateUrl: string;
  sellerName?: string;
  lastUpdated?: Date;
  isStale?: boolean;
}

export interface MerchantRefreshResult {
  success: boolean;
  refreshedAt: Date;
  details?: MerchantProductDetails;
  offers?: MerchantOfferData[];
  images?: MerchantImage[];
  isStale: boolean;
  cacheExpiresAt?: Date;
  warning?: string;
}

export interface MerchantAdapter {
  readonly merchantType: string;
  isApiConfigured(): boolean;
  fetchProductDetails(externalId: string): Promise<MerchantProductDetails | null>;
  fetchProductImages(externalId: string): Promise<MerchantImage[]>;
  fetchOffers(externalId: string): Promise<MerchantOfferData[]>;
  fetchAvailability(externalId: string): Promise<'in_stock' | 'out_of_stock' | 'unknown'>;
  generateAffiliateLink(externalId: string, options?: { customTag?: string; subId?: string }): string;
  generateCanonicalUrl(externalIdOrUrl: string): string;
  generateSearchUrl(query: string, options?: { customTag?: string }): string;
  refreshProductData(externalId: string, currentOffer?: unknown): Promise<MerchantRefreshResult>;
  isCacheValid(lastUpdated?: Date): boolean;
}
