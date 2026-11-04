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
 * Normalizes any merchant string, domain, or slug into a standard platform identifier.
 */
export function normalizePlatform(input?: string): SupportedPlatform {
  if (!input) return 'generic';
  const str = String(input).toLowerCase().trim();

  if (str.includes('amazon') || str.includes('amzn')) return 'amazon';
  if (str.includes('flipkart') || str.includes('fkrt')) return 'flipkart';
  if (str.includes('myntra')) return 'myntra';
  if (str.includes('ajio')) return 'ajio';

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
        return host.includes('amazon.') || host === 'amzn.in' || host === 'amzn.to';
      case 'flipkart':
        return host.includes('flipkart.') || host === 'fkrt.it';
      case 'myntra':
        return host.includes('myntra.com');
      case 'ajio':
        return host.includes('ajio.com');
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
      const p = normalizePlatform(product.sourceMerchantId.slug || product.sourceMerchantId.name || product.sourceMerchantId.websiteUrl);
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
      const p = normalizePlatform(primaryOffer.merchantId.slug || primaryOffer.merchantId.name);
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
  } else if (offer.productUrl) {
    offerPlatform = normalizePlatform(offer.productUrl);
  }

  if (targetPlatform !== 'generic' && offerPlatform !== targetPlatform) {
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

