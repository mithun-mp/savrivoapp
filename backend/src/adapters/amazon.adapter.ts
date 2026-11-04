import crypto from 'node:crypto';
import { config } from '../config/env';
import type {
  MerchantAdapter,
  MerchantProductDetails,
  MerchantImage,
  MerchantOfferData,
  MerchantRefreshResult,
} from './merchant-adapter.interface';

// Amazon Associates Program Operating Agreement: 24-hour cache limit (86,400,000 ms)
export const AMAZON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class AmazonAdapter implements MerchantAdapter {
  readonly merchantType = 'amazon';
  private readonly defaultMarketplace = 'www.amazon.in';
  private readonly defaultRegion = 'eu-west-1'; // AWS region for amazon.in PA-API

  /**
   * Checks whether official Amazon PA-API / Creators API credentials are fully configured.
   */
  public isApiConfigured(): boolean {
    return Boolean(
      config.amazon.accessKey &&
      config.amazon.secretKey &&
      config.amazon.associateTag
    );
  }

  /**
   * Generates a compliant Amazon Associates affiliate link.
   */
  public generateAffiliateLink(
    asinOrUrl: string,
    options?: { customTag?: string; subId?: string }
  ): string {
    const asin = this.extractAsin(asinOrUrl);
    const tag = options?.customTag || config.amazon.associateTag;
    const marketplace = config.amazon.marketplace || this.defaultMarketplace;

    if (!asin) {
      // If full Amazon URL, attach tag query parameter safely
      try {
        const parsed = new URL(asinOrUrl);
        if (tag) parsed.searchParams.set('tag', tag);
        if (options?.subId) parsed.searchParams.set('ascsubtag', options.subId);
        return parsed.toString();
      } catch {
        return asinOrUrl;
      }
    }

    const base = `https://${marketplace}/dp/${asin}`;
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (options?.subId) params.set('ascsubtag', options.subId);

    const queryStr = params.toString();
    return queryStr ? `${base}?${queryStr}` : base;
  }

  /**
   * Evaluates whether cached Amazon data has exceeded the 24-hour licensing limit.
   */
  public isCacheValid(lastUpdated?: Date): boolean {
    if (!lastUpdated) return false;
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    return ageMs >= 0 && ageMs < AMAZON_CACHE_TTL_MS;
  }

  /**
   * Fetches official product details via Amazon PA-API / Creators API if configured.
   * Degrades gracefully without bot scraping if credentials are not configured.
   */
  public async fetchProductDetails(externalId: string): Promise<MerchantProductDetails | null> {
    const asin = this.extractAsin(externalId);
    if (!asin) return null;

    if (!this.isApiConfigured()) {
      return null;
    }

    try {
      const apiResult = await this.executePaApiGetItems(asin);
      return apiResult ? this.mapPaApiItemToProductDetails(apiResult) : null;
    } catch (err) {
      console.warn(`[AmazonAdapter] PA-API fetch failed for ASIN ${asin}:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Fetches official product images via PA-API.
   */
  public async fetchProductImages(externalId: string): Promise<MerchantImage[]> {
    const details = await this.fetchProductDetails(externalId);
    return details?.images || [];
  }

  /**
   * Fetches official product offers and current price via PA-API.
   */
  public async fetchOffers(externalId: string): Promise<MerchantOfferData[]> {
    const asin = this.extractAsin(externalId);
    if (!asin) return [];

    if (!this.isApiConfigured()) {
      return [];
    }

    try {
      const apiResult = await this.executePaApiGetItems(asin);
      if (!apiResult) return [];

      const offer = this.mapPaApiItemToOffer(apiResult, asin);
      return offer ? [offer] : [];
    } catch (err) {
      console.warn(`[AmazonAdapter] Failed to fetch offers for ASIN ${asin}:`, (err as Error).message);
      return [];
    }
  }

  /**
   * Fetches live availability status.
   */
  public async fetchAvailability(externalId: string): Promise<'in_stock' | 'out_of_stock' | 'unknown'> {
    const offers = await this.fetchOffers(externalId);
    return offers[0]?.availability || 'unknown';
  }

  /**
   * Refreshes live merchant data for a product offer.
   * Respects 24-hour cache limit and preserves existing data on API failure or when credentials are missing.
   */
  public async refreshProductData(
    externalId: string,
    currentOffer?: { currentPrice?: number; originalPrice?: number; offerLastVerifiedAt?: Date }
  ): Promise<MerchantRefreshResult> {
    const asin = this.extractAsin(externalId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AMAZON_CACHE_TTL_MS);

    if (!asin) {
      return {
        success: false,
        refreshedAt: now,
        isStale: true,
        warning: 'Invalid Amazon ASIN',
      };
    }

    // 1. If credentials are not configured, degrade gracefully without bot scraping
    if (!this.isApiConfigured()) {
      const isStale = !this.isCacheValid(currentOffer?.offerLastVerifiedAt);
      return {
        success: false,
        refreshedAt: now,
        isStale,
        warning: 'Amazon Creators API / PA-API credentials not configured. Live data refresh is unavailable; showing last verified data.',
        cacheExpiresAt: currentOffer?.offerLastVerifiedAt
          ? new Date(new Date(currentOffer.offerLastVerifiedAt).getTime() + AMAZON_CACHE_TTL_MS)
          : undefined,
      };
    }

    // 2. If existing cached data is still fresh (within 24h), return valid cache status
    if (currentOffer?.offerLastVerifiedAt && this.isCacheValid(currentOffer.offerLastVerifiedAt)) {
      return {
        success: true,
        refreshedAt: new Date(currentOffer.offerLastVerifiedAt),
        isStale: false,
        cacheExpiresAt: new Date(new Date(currentOffer.offerLastVerifiedAt).getTime() + AMAZON_CACHE_TTL_MS),
      };
    }

    // 3. Perform official API fetch
    try {
      const apiResult = await this.executePaApiGetItems(asin);
      if (!apiResult) {
        return {
          success: false,
          refreshedAt: now,
          isStale: true,
          warning: 'Product not found in Amazon PA-API catalog',
        };
      }

      const details = this.mapPaApiItemToProductDetails(apiResult);
      const offer = this.mapPaApiItemToOffer(apiResult, asin);

      return {
        success: true,
        refreshedAt: now,
        details,
        offers: offer ? [offer] : [],
        images: details.images,
        isStale: false,
        cacheExpiresAt: expiresAt,
      };
    } catch (err) {
      // API failure: do not drop product or erase data, mark as stale with warning
      return {
        success: false,
        refreshedAt: now,
        isStale: true,
        warning: `Amazon PA-API request failed: ${(err as Error).message}. Preserving last known data.`,
      };
    }
  }

  /**
   * Helper: extracts 10-character ASIN from an ASIN string or Amazon product URL.
   */
  public extractAsin(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const match = trimmed.match(/(?:\/dp\/|\/gp\/product\/|\/asin\/)([A-Z0-9]{10})/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Signs and executes an AWS SigV4 PA-API v5 request.
   */
  private async executePaApiGetItems(asin: string): Promise<Record<string, unknown> | null> {
    const host = 'webservices.amazon.in';
    const region = this.defaultRegion;
    const service = 'ProductAdvertisingAPI';
    const endpoint = `https://${host}/paapi5/getitems`;

    const payload = JSON.stringify({
      ItemIds: [asin],
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'ItemInfo.TechnicalInfo',
        'Images.Primary.Large',
        'Images.Variants.Large',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Message',
      ],
      PartnerTag: config.amazon.associateTag,
      PartnerType: 'Associates',
      Marketplace: config.amazon.marketplace || this.defaultMarketplace,
    });

    const headers = this.signAwsRequest({
      method: 'POST',
      host,
      region,
      service,
      path: '/paapi5/getitems',
      payload,
      target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
      accessKey: config.amazon.accessKey,
      secretKey: config.amazon.secretKey,
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as { ItemsResult?: { Items?: Array<Record<string, unknown>> } };
    return data.ItemsResult?.Items?.[0] || null;
  }

  /**
   * Maps official PA-API GetItems item response to SAVRIVO MerchantProductDetails.
   */
  public mapPaApiItemToProductDetails(item: Record<string, unknown>): MerchantProductDetails {
    const itemInfo = (item.ItemInfo || {}) as Record<string, unknown>;
    const title = (itemInfo.Title as { DisplayValue?: string })?.DisplayValue;
    const byLine = (itemInfo.ByLineInfo as { Brand?: { DisplayValue?: string } })?.Brand?.DisplayValue;

    const featuresObj = (itemInfo.Features as { DisplayValues?: string[] })?.DisplayValues;
    const features = Array.isArray(featuresObj) ? featuresObj : [];

    const images: MerchantImage[] = [];
    const imagesContainer = (item.Images || {}) as Record<string, unknown>;
    const primaryImg = (imagesContainer.Primary as { Large?: { URL?: string; Width?: number; Height?: number } })?.Large;

    if (primaryImg?.URL) {
      images.push({
        url: primaryImg.URL,
        alt: title || 'Amazon Product Image',
        width: primaryImg.Width,
        height: primaryImg.Height,
        isPrimary: true,
      });
    }

    const variants = (imagesContainer.Variants as Array<{ Large?: { URL?: string; Width?: number; Height?: number } }>) || [];
    for (const v of variants) {
      if (v.Large?.URL && !images.some((i) => i.url === v.Large!.URL)) {
        images.push({
          url: v.Large.URL,
          alt: title || 'Amazon Product Variant Image',
          width: v.Large.Width,
          height: v.Large.Height,
          isPrimary: false,
        });
      }
    }

    const asin = String(item.ASIN || '');
    return {
      title,
      brand: byLine,
      features,
      images,
      skuOrAsin: asin,
      canonicalUrl: `https://${config.amazon.marketplace || this.defaultMarketplace}/dp/${asin}`,
    };
  }

  /**
   * Maps official PA-API item response to SAVRIVO MerchantOfferData.
   */
  public mapPaApiItemToOffer(item: Record<string, unknown>, asin: string): MerchantOfferData | null {
    const offersContainer = (item.Offers || {}) as Record<string, unknown>;
    const listings = (offersContainer.Listings as Array<Record<string, unknown>>) || [];
    const firstListing = listings[0];

    let currentPrice: number | undefined;
    let currency = 'INR';
    let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';

    if (firstListing) {
      const priceObj = (firstListing.Price as { Amount?: number; Currency?: string });
      if (typeof priceObj?.Amount === 'number') {
        currentPrice = priceObj.Amount;
      }
      if (priceObj?.Currency) {
        currency = priceObj.Currency;
      }

      const availMsg = ((firstListing.Availability as { Message?: string })?.Message || '').toLowerCase();
      if (availMsg.includes('in stock') || availMsg.includes('available')) {
        availability = 'in_stock';
      } else if (availMsg.includes('out of stock') || availMsg.includes('unavailable')) {
        availability = 'out_of_stock';
      }
    }

    return {
      currentPrice,
      currency,
      availability,
      affiliateUrl: this.generateAffiliateLink(asin),
      lastUpdated: new Date(),
      isStale: false,
    };
  }

  /**
   * Helper: AWS SigV4 signing implementation for Amazon PA-API.
   */
  private signAwsRequest(params: {
    method: string;
    host: string;
    region: string;
    service: string;
    path: string;
    payload: string;
    target: string;
    accessKey: string;
    secretKey: string;
  }): Record<string, string> {
    const { method, host, region, service, path, payload, target, accessKey, secretKey } = params;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri = path;
    const canonicalQueryString = '';
    const payloadHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

    const canonicalHeaders =
      `content-encoding:amz-1.0\n` +
      `content-type:application/json; charset=utf-8\n` +
      `host:${host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${target}\n`;

    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

    const canonicalRequest =
      `${method}\n` +
      `${canonicalUri}\n` +
      `${canonicalQueryString}\n` +
      `${canonicalHeaders}\n` +
      `${signedHeaders}\n` +
      `${payloadHash}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

    const stringToSign =
      `${algorithm}\n` +
      `${amzDate}\n` +
      `${credentialScope}\n` +
      `${canonicalRequestHash}`;

    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp, 'utf8').digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region, 'utf8').digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service, 'utf8').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorizationHeader =
      `${algorithm} ` +
      `Credential=${accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    return {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host,
      'x-amz-date': amzDate,
      'x-amz-target': target,
      Authorization: authorizationHeader,
    };
  }
}

export const defaultAmazonAdapter = new AmazonAdapter();
