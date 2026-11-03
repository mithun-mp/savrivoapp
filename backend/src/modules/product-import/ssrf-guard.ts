import dns from 'node:dns/promises';
import { URL } from 'node:url';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Checks if an IPv4 address string falls into private/reserved/loopback/link-local ranges.
 */
function isForbiddenIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b, c, d] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local & cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Carrier grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation)
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // 198.18.0.0/15 (Benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;
  // Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address falls into private/loopback/link-local ranges.
 */
function isForbiddenIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Loopback and unspecified
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.128 or ::ffff:c000:0280)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (v4Part.includes('.')) {
      return isForbiddenIpv4(v4Part);
    }
  }

  // Unique local addresses (fc00::/7 -> fc00 to fdff)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local unicast (fe80::/10 -> fe80 to febf)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  return false;
}

export function isForbiddenIp(ip: string): boolean {
  if (ip.includes(':')) {
    return isForbiddenIpv6(ip);
  }
  return isForbiddenIpv4(ip);
}

/**
 * Validates that a URL does not resolve to an internal/private/loopback/metadata IP address.
 */
export async function validateUrlSsrf(inputUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new SsrfError('Invalid URL format');
  }

  // Scheme must be http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfError(`Forbidden protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`);
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new SsrfError('Credentials in URL are strictly prohibited.');
  }

  const hostname = parsed.hostname;

  // Direct IP checks (handles numeric IPs in hostname like 127.0.0.1 or 169.254.169.254)
  if (isForbiddenIp(hostname)) {
    throw new SsrfError(`Access to private/internal IP address (${hostname}) is forbidden.`);
  }

  // Localhost names
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new SsrfError(`Access to localhost/local domain (${hostname}) is forbidden.`);
  }

  // DNS lookup
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SsrfError(`Unable to resolve domain: ${hostname}`);
    }

    for (const record of addresses) {
      if (isForbiddenIp(record.address)) {
        throw new SsrfError(
          `Domain ${hostname} resolved to forbidden internal/private address (${record.address}).`
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof SsrfError) throw err;
    throw new SsrfError(`DNS resolution failed for ${hostname}: ${(err as Error).message}`);
  }

  return parsed;
}

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
}

/**
 * Fetches HTML from a target URL safely:
 * - Performs SSRF validation on initial URL and every redirect
 * - Limits maximum redirects (default 5)
 * - Limits maximum response size (default 5MB)
 * - Uses realistic browser headers
 */
export async function safeFetchHtml(
  targetUrl: string,
  maxRedirects = 5,
  maxSizeBytes = 5 * 1024 * 1024
): Promise<SafeFetchResult> {
  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // Validate target before making any network request
    await validateUrlSsrf(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch URL ${currentUrl}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    // Handle redirects manually to enforce SSRF validation at every hop
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`Received redirect status ${res.status} with no Location header.`);
      }
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(`Too many redirects (exceeded limit of ${maxRedirects}).`);
      }
      // Resolve relative redirect against current URL
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    // Check Content-Length if available
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      throw new Error(`Response size (${contentLength} bytes) exceeds maximum limit of ${maxSizeBytes} bytes.`);
    }

    // Read response text with size tracking
    const text = await res.text();
    if (text.length > maxSizeBytes) {
      throw new Error(`Response body exceeds maximum limit of ${maxSizeBytes} bytes.`);
    }

    return {
      url: targetUrl,
      finalUrl: currentUrl,
      html: text,
      statusCode: res.status,
    };
  }

  throw new Error('Redirect loop or limit exceeded.');
}

