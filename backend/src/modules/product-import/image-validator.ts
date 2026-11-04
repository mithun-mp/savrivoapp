import dns from 'node:dns/promises';
import net from 'node:net';
import { isForbiddenIp } from './ssrf-guard';

export interface ValidatedImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

const KNOWN_MERCHANT_IMAGE_DOMAINS = [
  'media-amazon.com',
  'ssl-images-amazon.com',
  'images-amazon.com',
  'amazon.in',
  'flixcart.com',
  'flipkart.com',
];

/**
 * Validates that an image URL is a valid, secure, merchant-appropriate image destination.
 * Uses SSRF checking to ensure outbound requests never hit private/internal hosts.
 */
export async function validateImageUrl(urlStr: string): Promise<boolean> {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (trimmed.length < 8) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  // Enforce secure HTTP/HTTPS protocol
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Direct SSRF check on hostname
  if (isForbiddenIp(hostname)) {
    return false;
  }

  // 2. DNS check if not a known merchant image CDN domain
  const isKnownCdn = KNOWN_MERCHANT_IMAGE_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  if (!isKnownCdn) {
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (records.length === 0) return false;
      for (const rec of records) {
        if (isForbiddenIp(rec.address)) {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  // 3. Reject known tracking pixel markers or empty 1x1 gifs
  const pathLower = parsed.pathname.toLowerCase();
  if (
    pathLower.includes('transparent-pixel') ||
    pathLower.includes('1x1') ||
    pathLower.includes('pixel.gif') ||
    pathLower.includes('spacer.gif') ||
    pathLower.includes('beacon')
  ) {
    return false;
  }

  // 4. Check for image path or extension
  const hasImageExt = /\.(jpe?g|png|webp|avif|gif|svg)(\?.*)?$/i.test(parsed.pathname);
  if (!hasImageExt && !isKnownCdn) {
    // If not a known CDN and lacks standard image extension, perform a lightweight HEAD request
    try {
      const headRes = await fetch(trimmed, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      if (!headRes.ok) return false;
      const contentType = headRes.headers.get('content-type') || '';
      return contentType.startsWith('image/');
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes and validates a list of product images.
 * Deduplicates URLs, rejects broken or forbidden targets, and ensures valid alt tags.
 */
export async function sanitizeProductImages(
  rawImages: Array<{ url: string; alt?: string; isPrimary?: boolean }>,
  productTitle = 'Product Image'
): Promise<ValidatedImage[]> {
  const result: ValidatedImage[] = [];
  const seenUrls = new Set<string>();

  for (const img of rawImages) {
    if (!img?.url || typeof img.url !== 'string') continue;
    const cleanUrl = img.url.trim();

    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    const isValid = await validateImageUrl(cleanUrl);
    if (isValid) {
      result.push({
        url: cleanUrl,
        alt: img.alt?.trim() || productTitle,
        isPrimary: result.length === 0,
      });
    }

    if (result.length >= 10) break; // Maximum 10 images
  }

  return result;
}

