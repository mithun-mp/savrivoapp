import crypto from 'node:crypto';
import { Offer, type IOffer } from '../models/Offer.model';
import { Click } from '../models/Click.model';
import { isForbiddenIp } from '../modules/product-import/ssrf-guard';
import { isOfferAllowedForProduct } from '../utils/merchant-platform';

export interface RecordClickParams {
  offerId: string;
  productId?: string;
  referrer?: string;
  userAgent?: string;
  clientIp?: string;
  campaign?: string;
}

export interface ClickRedirectResult {
  success: boolean;
  targetUrl: string;
  offer?: IOffer;
  error?: string;
}

/**
 * Anonymizes an IP address using SHA-256 with a salt so individual IPs are never stored in plaintext.
 */
export function anonymizeIp(ip?: string): string {
  if (!ip) return 'anonymous';
  return crypto.createHash('sha256').update(`savrivo_salt_${ip}`).digest('hex').slice(0, 32);
}

/**
 * Validates that an affiliate URL is safe, absolute, and not an SSRF/internal network hazard.
 */
export function validateAffiliateRedirectUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    // Block loopback or private hostnames directly
    if (isForbiddenIp(parsed.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Records an affiliate purchase click and returns the validated stored destination URL.
 * Strictly ignores arbitrary user-provided redirect URLs to prevent open redirect vulnerabilities.
 * Enforces strict merchant-platform isolation.
 */
export async function trackOfferClick(params: RecordClickParams): Promise<ClickRedirectResult> {
  const { offerId, productId, referrer, userAgent, clientIp, campaign } = params;

  // Validate ObjectId format
  if (!offerId || !offerId.match(/^[0-9a-fA-F]{24}$/)) {
    return {
      success: false,
      targetUrl: '',
      error: 'Invalid offer ID format',
    };
  }

  const offer = await Offer.findById(offerId)
    .populate({ path: 'productId', populate: { path: 'sourceMerchantId' } })
    .populate('merchantId');
  if (!offer) {
    return {
      success: false,
      targetUrl: '',
      error: 'Offer not found',
    };
  }

  if (offer.status !== 'active') {
    return {
      success: false,
      targetUrl: '',
      error: 'Offer is inactive or expired',
    };
  }

  // 1. Verify offer belongs to requested product if productId was passed
  if (productId && offer.productId) {
    const offerProdId = (offer.productId as any)._id
      ? (offer.productId as any)._id.toString()
      : offer.productId.toString();
    if (offerProdId !== productId.toString()) {
      return {
        success: false,
        targetUrl: '',
        error: 'Offer does not belong to the requested product',
      };
    }
  }

  // 2. Strict merchant-platform isolation check
  if (offer.productId && typeof offer.productId === 'object') {
    const product = offer.productId;
    if (!isOfferAllowedForProduct(product, offer)) {
      return {
        success: false,
        targetUrl: '',
        error: 'Offer platform does not match product associated merchant platform',
      };
    }
  }

  // Resolve target URL strictly from stored offer
  const rawTarget = offer.affiliateUrl || offer.productUrl;
  if (!rawTarget || !validateAffiliateRedirectUrl(rawTarget)) {
    return {
      success: false,
      targetUrl: '',
      error: 'Stored offer has an invalid or unsafe affiliate URL',
    };
  }

  // Asynchronously record click (non-blocking for redirect)
  try {
    const ipHash = anonymizeIp(clientIp);
    await Click.create({
      productId: (offer.productId as any)?._id || offer.productId,
      merchantId: (offer.merchantId as any)?._id || offer.merchantId,
      offerId: offer._id,
      targetUrl: rawTarget,
      referrer: referrer?.slice(0, 500),
      userAgent: userAgent?.slice(0, 500),
      ipHash,
      campaign: campaign?.slice(0, 100) || 'product_detail',
    });
  } catch (logErr) {
    console.error('[ClickTracking] Failed to persist click record:', logErr);
  }

  return {
    success: true,
    targetUrl: rawTarget,
    offer,
  };
}
