import { URL } from 'node:url';
import type { MerchantType } from './product-import.types';

export interface DetectedMerchantInfo {
  merchantType: MerchantType;
  merchantName: string;
  canonicalUrl: string;
  skuOrAsin?: string;
  domain: string;
}

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'ref',
  'ref_',
  'tag',
  'ascsubtag',
  'crid',
  'sprefix',
  'keywords',
  'qid',
  'sr',
  'affid',
  'tracking_id',
  'semcmpid',
  'cmpid',
];

export function cleanGenericTrackingParams(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    for (const param of TRACKING_PARAMS) {
      urlObj.searchParams.delete(param);
    }
    // Also remove trailing hash
    urlObj.hash = '';
    return urlObj.toString();
  } catch {
    return rawUrl;
  }
}

export function extractAmazonAsin(rawUrl: string): string | undefined {
  const match = rawUrl.match(/(?:dp|gp\/product|exec\/obidos\/asin|o\/asin|gp\/offer-listing)\/([A-Za-z0-9]{10})/i);
  if (match?.[1]) return match[1].toUpperCase();

  // Try direct 10-char alphanumeric if in path
  const pathParts = rawUrl.split(/[/?#]/);
  for (const part of pathParts) {
    if (/^[B0-9][A-Z0-9]{9}$/i.test(part)) {
      return part.toUpperCase();
    }
  }
  return undefined;
}

export function extractFlipkartPid(rawUrl: string): string | undefined {
  try {
    const urlObj = new URL(rawUrl);
    const pid = urlObj.searchParams.get('pid');
    if (pid && pid.length >= 8) {
      return pid;
    }
  } catch {
    // fallback regex
  }
  const match = rawUrl.match(/[?&]pid=([A-Za-z0-9]{8,24})/i);
  if (match?.[1]) return match[1];

  return undefined;
}

export function formatMerchantNameFromHost(hostname: string): string {
  const clean = hostname.replace(/^www\./, '').split('.')[0];
  if (!clean) return 'Generic Merchant';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function detectMerchant(inputUrl: string): DetectedMerchantInfo {
  let urlObj: URL;
  try {
    urlObj = new URL(inputUrl);
  } catch {
    return {
      merchantType: 'generic',
      merchantName: 'Unknown',
      canonicalUrl: inputUrl,
      domain: '',
    };
  }

  const host = urlObj.hostname.toLowerCase();

  // 1. Amazon detection
  if (host.includes('amazon.') || host === 'amzn.in' || host === 'amzn.to') {
    const asin = extractAmazonAsin(inputUrl);
    const isIndia = host.endsWith('.in') || inputUrl.includes('amazon.in');
    const merchantName = isIndia ? 'Amazon India' : 'Amazon';
    const canonicalDomain = isIndia ? 'https://www.amazon.in' : 'https://www.amazon.com';
    const canonicalUrl = asin ? `${canonicalDomain}/dp/${asin}` : cleanGenericTrackingParams(inputUrl);

    return {
      merchantType: 'amazon',
      merchantName,
      canonicalUrl,
      skuOrAsin: asin,
      domain: host,
    };
  }

  // 2. Flipkart detection
  if (host.includes('flipkart.') || host === 'fkrt.it') {
    const pid = extractFlipkartPid(inputUrl);
    // Build clean canonical URL
    let canonicalUrl: string;
    if (pid) {
      const cleanPath = urlObj.pathname.split('/p/')[0];
      if (cleanPath && cleanPath !== '/') {
        canonicalUrl = `https://www.flipkart.com${cleanPath}/p/itm?pid=${pid}`;
      } else {
        canonicalUrl = `https://www.flipkart.com/p/itm?pid=${pid}`;
      }
    } else {
      canonicalUrl = cleanGenericTrackingParams(inputUrl);
    }

    return {
      merchantType: 'flipkart',
      merchantName: 'Flipkart',
      canonicalUrl,
      skuOrAsin: pid,
      domain: host,
    };
  }

  // 3. Generic Merchant
  return {
    merchantType: 'generic',
    merchantName: formatMerchantNameFromHost(host),
    canonicalUrl: cleanGenericTrackingParams(inputUrl),
    domain: host,
  };
}

