import dns from 'node:dns/promises';
import dnsSync from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { URL } from 'node:url';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Parses an IPv6 address string and extracts an embedded IPv4 address if present:
 * - IPv4-mapped IPv6: ::ffff:192.168.1.1 or ::ffff:c0a8:0101
 * - NAT64 well-known prefix: 64:ff9b::192.168.1.1
 */
export function parseIpv6ToIpv4(ip: string): string | null {
  const norm = ip.toLowerCase().trim();

  // Dot-decimal IPv4-mapped IPv6: e.g. ::ffff:192.168.1.1 or 0:0:0:0:0:ffff:192.168.1.1
  const dotMatch = norm.match(/^(?:0*:)*ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (dotMatch) return dotMatch[1];

  // Hex IPv4-mapped IPv6: e.g. ::ffff:7f00:1 or ::ffff:7f00:0001
  const hexMatch = norm.match(/^(?:0*:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMatch) {
    const h1 = parseInt(hexMatch[1], 16);
    const h2 = parseInt(hexMatch[2], 16);
    const a = (h1 >> 8) & 0xff;
    const b = h1 & 0xff;
    const c = (h2 >> 8) & 0xff;
    const d = h2 & 0xff;
    return `${a}.${b}.${c}.${d}`;
  }

  // NAT64 well-known prefix: 64:ff9b::192.168.1.1
  const nat64Match = norm.match(/^64:ff9b::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (nat64Match) return nat64Match[1];

  return null;
}

/**
 * Checks if an IPv4 address string falls into private/reserved/loopback/link-local ranges.
 */
export function isForbiddenIpv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return true;

  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network / "this host")
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network, RFC 1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT, RFC 6598: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback, RFC 1122: 127.0.0.0 - 127.255.255.255)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local & cloud metadata 169.254.169.254, RFC 3927)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network, RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments, RFC 6890)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1 / Documentation, RFC 5737)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 Relay Anycast, RFC 3068 / RFC 7526)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (Private network, RFC 1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network benchmark tests, RFC 2544: 198.18.0.0 - 198.19.255.255)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2 / Documentation, RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3 / Documentation, RFC 5737)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast, RFC 5771: 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved for future use / Class E, RFC 1112: 240.0.0.0 - 255.255.255.254)
  if (a >= 240) return true;
  // 255.255.255.255 (Limited Broadcast, RFC 919)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address falls into private/loopback/link-local/multicast/reserved ranges.
 */
export function isForbiddenIpv6(ip: string): boolean {
  let normalized = ip.toLowerCase().trim();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  // Check IPv4-mapped or translated IPv6
  const mappedIpv4 = parseIpv6ToIpv4(normalized);
  if (mappedIpv4) {
    return isForbiddenIpv4(mappedIpv4);
  }

  if (!net.isIPv6(normalized)) return true;

  // Unspecified (::) and Loopback (::1)
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:0' ||
    normalized === '0:0:0:0:0:0:0:1'
  ) {
    return true;
  }

  // Unique local addresses (fc00::/7 -> fc00 to fdff)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // Link-local unicast (fe80::/10 -> fe80 to febf)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }

  // Discard prefix (100::/64, RFC 6666)
  if (normalized.startsWith('100::')) {
    return true;
  }

  // Documentation prefix (2001:db8::/32, RFC 3849)
  if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) {
    return true;
  }

  return false;
}

/**
 * Validates whether an IP address is private, loopback, link-local, reserved, or otherwise forbidden.
 * Returns false if the input is a domain name (not an IP literal).
 */
export function isForbiddenIp(ip: string): boolean {
  const clean = ip.trim();

  // Direct IPv4 check
  if (net.isIPv4(clean)) {
    return isForbiddenIpv4(clean);
  }

  // Direct IPv6 check
  if (net.isIPv6(clean)) {
    return isForbiddenIpv6(clean);
  }

  // Bracketed IPv6 (e.g. [::1])
  if (clean.startsWith('[') && clean.endsWith(']')) {
    const unbracketed = clean.slice(1, -1);
    if (net.isIPv6(unbracketed)) {
      return isForbiddenIpv6(unbracketed);
    }
  }

  // IPv4-mapped IPv6 in hex or dot-decimal notation
  const mapped = parseIpv6ToIpv4(clean);
  if (mapped) {
    return isForbiddenIpv4(mapped);
  }

  // Not an IP address (e.g. domain name like "www.amazon.in")
  return false;
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

  // 1. Direct IP check: if the hostname is an IP literal (e.g. 127.0.0.1 or [::1])
  if (net.isIP(hostname) !== 0 || hostname.startsWith('[')) {
    if (isForbiddenIp(hostname)) {
      throw new SsrfError(`Access to private/internal IP address (${hostname}) is forbidden.`);
    }
  }

  // 2. Reject localhost and local/internal domain names
  const lowerHost = hostname.toLowerCase();
  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal') ||
    lowerHost.endsWith('.lan') ||
    lowerHost.endsWith('.corp') ||
    lowerHost.endsWith('.home') ||
    lowerHost.endsWith('.arpa')
  ) {
    throw new SsrfError(`Access to localhost/local domain (${hostname}) is forbidden.`);
  }

  // 3. DNS resolution & validation of all resolved addresses
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

interface SafeHttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * Performs a safe outbound HTTP/HTTPS request:
 * - Prevents DNS rebinding via connection-time safe lookup
 * - Inspects socket remoteAddress on connect/secureConnect
 * - Decompresses gzip, deflate, and brotli streams
 * - Enforces byte size limits and bounded timeouts
 */
function performSafeHttpRequest(
  parsedUrl: URL,
  timeoutMs = 15000,
  maxSizeBytes = 5 * 1024 * 1024
): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    // Custom DNS lookup handler to prevent DNS rebinding
    const customLookup: (
      hostname: string,
      options: dnsSync.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dnsSync.LookupAddress[], family?: number) => void
    ) => void = (hostname, options, callback) => {
      dns.lookup(hostname, { all: true })
        .then((addresses) => {
          if (!addresses || addresses.length === 0) {
            return callback(new SsrfError(`Unable to resolve domain: ${hostname}`), []);
          }

          // Verify that NO resolved address is private/internal
          for (const record of addresses) {
            if (isForbiddenIp(record.address)) {
              return callback(
                new SsrfError(
                  `DNS rebinding prevented: domain ${hostname} resolved to forbidden address (${record.address}).`
                ),
                []
              );
            }
          }

          if (options && options.all) {
            return callback(null, addresses);
          }
          return callback(null, addresses[0].address, addresses[0].family);
        })
        .catch((err: Error) => {
          callback(err as NodeJS.ErrnoException, []);
        });
    };

    const reqOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      lookup: customLookup,
      timeout: timeoutMs,
    };

    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      req.destroy();
      reject(err);
    };

    const req = client.request(reqOptions, (res) => {
      const contentLength = res.headers['content-length'];
      if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
        return fail(
          new Error(`Response size (${contentLength} bytes) exceeds limit of ${maxSizeBytes} bytes.`)
        );
      }

      // Stream decompression
      const encoding = res.headers['content-encoding'];
      let stream: Readable = res;
      if (encoding === 'gzip') {
        const gunzip = zlib.createGunzip();
        res.pipe(gunzip);
        stream = gunzip;
      } else if (encoding === 'deflate') {
        const inflate = zlib.createInflate();
        res.pipe(inflate);
        stream = inflate;
      } else if (encoding === 'br') {
        const brotli = zlib.createBrotliDecompress();
        res.pipe(brotli);
        stream = brotli;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      stream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxSizeBytes) {
          stream.destroy(new Error(`Response body exceeds maximum limit of ${maxSizeBytes} bytes.`));
        } else {
          chunks.push(chunk);
        }
      });

      stream.on('end', () => {
        if (settled) return;
        settled = true;
        cleanup();
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          body,
        });
      });

      stream.on('error', (err) => {
        fail(err);
      });
    });

    // Socket-level destination verification against DNS rebinding
    req.on('socket', (socket: net.Socket) => {
      const verifyRemote = () => {
        const remote = socket.remoteAddress;
        if (remote && isForbiddenIp(remote)) {
          socket.destroy(
            new SsrfError(
              `DNS rebinding prevented: socket connected to forbidden remote IP (${remote}).`
            )
          );
        }
      };

      if (socket.connecting) {
        socket.once('connect', verifyRemote);
        socket.once('secureConnect', verifyRemote);
      } else {
        verifyRemote();
      }
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms.`));
    });

    req.on('error', (err) => {
      fail(err);
    });

    timer = setTimeout(() => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms.`));
    }, timeoutMs + 1000);

    req.end();
  });
}

/**
 * Fetches HTML from a target URL safely:
 * - Performs SSRF validation on initial URL and every redirect hop independently
 * - Enforces DNS rebinding protection on every network attempt
 * - Limits maximum redirects (default 5)
 * - Limits maximum response size (default 5MB)
 * - Transparently handles gzip, deflate, and brotli decompression
 */
export async function safeFetchHtml(
  targetUrl: string,
  maxRedirects = 5,
  maxSizeBytes = 5 * 1024 * 1024
): Promise<SafeFetchResult> {
  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // 1. SSRF pre-validation before making network request
    const validated = await validateUrlSsrf(currentUrl);

    // 2. Outbound request with anti-rebinding lookup and socket checks
    const res = await performSafeHttpRequest(validated, 15000, maxSizeBytes);

    // 3. Handle redirects manually to enforce SSRF validation on every hop
    if (res.statusCode >= 300 && res.statusCode < 400) {
      const location = res.headers['location'];
      if (!location) {
        throw new Error(`Received redirect status ${res.statusCode} with no Location header.`);
      }

      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(`Too many redirects (exceeded limit of ${maxRedirects}).`);
      }

      // Resolve relative redirect against current URL
      const nextUrl = new URL(location, currentUrl).toString();

      // Validate redirect destination independently BEFORE next request is made
      await validateUrlSsrf(nextUrl);

      currentUrl = nextUrl;
      continue;
    }

    return {
      url: targetUrl,
      finalUrl: currentUrl,
      html: res.body,
      statusCode: res.statusCode,
    };
  }

  throw new Error('Redirect loop or limit exceeded.');
}
