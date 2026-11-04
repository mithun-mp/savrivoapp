/**
 * SAVRIVO Strict Merchant-Platform Isolation Utilities
 *
 * Rules:
 * 1. A product imported from Amazon must show Amazon-related product offers ONLY.
 * 2. A product imported from Flipkart must show Flipkart-related offers ONLY.
 * 3. Never mix cross-platform purchase options or logos.
 * 4. Never allow frontend to bypass isolation via offerId manipulation.
 */

export type SupportedPlatform = 'amazon' | 'flipkart' | 'myntra' | 'ajio' | 'generic';

/**
 * Checks whether a given hostname or domain string belongs to Amazon or its shortlinks.
 */
export function isAmazonHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return (
    h === 'amazon' ||
    h === 'link.amazon' ||
    h.endsWith('.amazon') ||
    h === 'amzn.in' ||
    h === 'amzn.to' ||
    h === 'a.co' ||
    h.endsWith('.amzn.in') ||
    h.endsWith('.amzn.to') ||
    h.endsWith('.a.co') ||
    /(?:^|\.)amazon\.[a-z.]{2,8}$/i.test(h)
  );
}

/**
 * Checks whether a given hostname or domain string belongs to Flipkart or its shortlinks.
 */
export function isFlipkartHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return (
    h === 'flipkart' ||
    h === 'fkrt.it' ||
    h.endsWith('.fkrt.it') ||
    /(?:^|\.)flipkart\.[a-z.]{2,8}$/i.test(h)
  );
}

/**
 * Checks whether a given hostname or domain string belongs to Myntra.
 */
export function isMyntraHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return h === 'myntra' || /(?:^|\.)myntra\.[a-z.]{2,8}$/i.test(h);
}

/**
 * Checks whether a given hostname or domain string belongs to AJIO.
 */
export function isAjioHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return h === 'ajio' || /(?:^|\.)ajio\.[a-z.]{2,8}$/i.test(h);
}

/**
 * Normalizes any merchant string, domain, or slug into a standard platform identifier.
 */
export function normalizePlatform(input?: string): SupportedPlatform {
  if (!input) return 'generic';
  const str = String(input).toLowerCase().trim();

  // Try parsing as URL or host
  try {
    const url = str.includes('://') ? new URL(str) : new URL(`https://${str}`);
    const host = url.hostname.toLowerCase();
    if (isAmazonHost(host)) return 'amazon';
    if (isFlipkartHost(host)) return 'flipkart';
    if (isMyntraHost(host)) return 'myntra';
    if (isAjioHost(host)) return 'ajio';
  } catch {
    // not a valid URL/host, continue with string token matching
  }

  if (isAmazonHost(str) || str.includes('amazon') || str.includes('amzn') || str === 'a.co') {
    return 'amazon';
  }
  if (isFlipkartHost(str) || str.includes('flipkart') || str.includes('fkrt')) {
    return 'flipkart';
  }
  if (isMyntraHost(str) || str.includes('myntra')) {
    return 'myntra';
  }
  if (isAjioHost(str) || str.includes('ajio')) {
    return 'ajio';
  }

  return 'generic';
}

/**
 * Validates that an offer's URL belongs to the expected merchant platform domain.
 */
export function validatePlatformDomain(urlStr: string, platform: SupportedPlatform): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();

    switch (platform) {
      case 'amazon':
        return isAmazonHost(host);
      case 'flipkart':
        return isFlipkartHost(host);
      case 'myntra':
        return isMyntraHost(host);
      case 'ajio':
        return isAjioHost(host);
      case 'generic':
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Inactive/safe fallback to infer product platform from legacy document fields.
 */
export function inferProductPlatform(
  product: {
    sourcePlatform?: string;
    sourceMerchantId?: any;
    canonicalUrl?: string;
  },
  primaryOffer?: {
    productUrl?: string;
    affiliateUrl?: string;
    merchantId?: any;
  }
): SupportedPlatform {
  // 1. Explicit sourcePlatform on Product
  if (product.sourcePlatform) {
    const p = normalizePlatform(product.sourcePlatform);
    if (p !== 'generic') return p;
  }

  // 2. Populated sourceMerchantId
  if (product.sourceMerchantId) {
    if (typeof product.sourceMerchantId === 'object') {
      const p = normalizePlatform(
        product.sourceMerchantId.slug ||
        product.sourceMerchantId.name ||
        product.sourceMerchantId.websiteUrl
      );
      if (p !== 'generic') return p;
    }
  }

  // 3. Product Canonical URL
  if (product.canonicalUrl) {
    const p = normalizePlatform(product.canonicalUrl);
    if (p !== 'generic') return p;
  }

  // 4. Primary Offer inspection (backward compatibility for legacy DB records)
  if (primaryOffer) {
    if (primaryOffer.productUrl) {
      const p = normalizePlatform(primaryOffer.productUrl);
      if (p !== 'generic') return p;
    }
    if (primaryOffer.affiliateUrl) {
      const p = normalizePlatform(primaryOffer.affiliateUrl);
      if (p !== 'generic') return p;
    }
    if (primaryOffer.merchantId && typeof primaryOffer.merchantId === 'object') {
      const p = normalizePlatform(
        primaryOffer.merchantId.slug ||
        primaryOffer.merchantId.name ||
        primaryOffer.merchantId.websiteUrl
      );
      if (p !== 'generic') return p;
    }
  }

  return 'generic';
}

/**
 * Determines whether an offer is strictly allowed for a given product under platform isolation rules.
 */
export function isOfferAllowedForProduct(product: any, offer: any): boolean {
  if (!product || !offer) return false;

  const targetPlatform = inferProductPlatform(product, offer);

  // If both have specific merchants and product.sourceMerchantId is an ID, check ID match
  if (product.sourceMerchantId && offer.merchantId) {
    const prodMerchantId = product.sourceMerchantId._id
      ? product.sourceMerchantId._id.toString()
      : product.sourceMerchantId.toString();
    const offerMerchantId = offer.merchantId._id
      ? offer.merchantId._id.toString()
      : offer.merchantId.toString();

    // If IDs match directly, it is from the exact associated merchant!
    if (prodMerchantId === offerMerchantId) {
      return true;
    }
  }

  // Check offer merchant name / slug / website
  let offerPlatform: SupportedPlatform = 'generic';
  if (offer.merchantId && typeof offer.merchantId === 'object') {
    offerPlatform = normalizePlatform(
      offer.merchantId.slug || offer.merchantId.name || offer.merchantId.websiteUrl
    );
  }
  if (offerPlatform === 'generic' && offer.productUrl) {
    offerPlatform = normalizePlatform(offer.productUrl);
  }
  if (offerPlatform === 'generic' && offer.affiliateUrl) {
    offerPlatform = normalizePlatform(offer.affiliateUrl);
  }

  // Reject cross-platform mismatch
  if (targetPlatform !== 'generic' && offerPlatform !== 'generic' && offerPlatform !== targetPlatform) {
    return false;
  }

  // Verify that the offer URLs match the platform domain
  if (targetPlatform !== 'generic') {
    if (offer.productUrl && !validatePlatformDomain(offer.productUrl, targetPlatform)) {
      return false;
    }
    if (offer.affiliateUrl && !validatePlatformDomain(offer.affiliateUrl, targetPlatform)) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of offers, strictly returning ONLY offers belonging to the product's associated merchant platform.
 */
export function filterOffersForProduct(product: any, offers: any[]): any[] {
  if (!Array.isArray(offers) || offers.length === 0) return [];
  return offers.filter((offer) => isOfferAllowedForProduct(product, offer));
}
