import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import http from 'node:http';
import {
  validateUrlSsrf,
  safeFetchHtml,
  isForbiddenIp,
  isForbiddenIpv4,
  isForbiddenIpv6,
  parseIpv6ToIpv4,
  SsrfError,
} from './ssrf-guard';
import {
  detectMerchant,
  extractAmazonAsin,
  extractFlipkartPid,
  cleanGenericTrackingParams,
} from './merchant-detector';
import { extractGenericProduct } from './extractors/generic.extractor';
import { extractAmazonProduct, isAmazonAntiBot } from './extractors/amazon.extractor';
import { extractFlipkartProduct } from './extractors/flipkart.extractor';
import { GeminiModelManager, DEFAULT_MODEL_PRIORITY } from './gemini-model-manager';
import { GeminiKeyManager } from './gemini-key-manager';
import {
  GeminiRotationService,
  classifyGeminiError,
  classifyGeminiApiError,
} from './gemini-rotation.service';
import { GeminiClient } from './gemini.client';
import { DuplicateDetector } from './duplicate-detector';
import { Product } from '../../models/Product.model';
import { Offer } from '../../models/Offer.model';

describe('SSRF Guard', () => {
  it('correctly identifies forbidden IPv4 ranges', () => {
    assert.equal(isForbiddenIp('127.0.0.1'), true, 'Loopback should be forbidden');
    assert.equal(isForbiddenIp('10.0.0.1'), true, '10.x private IP should be forbidden');
    assert.equal(isForbiddenIp('172.16.0.1'), true, '172.16.x private IP should be forbidden');
    assert.equal(isForbiddenIp('172.31.255.255'), true, '172.31.x private IP should be forbidden');
    assert.equal(isForbiddenIp('192.168.1.1'), true, '192.168.x private IP should be forbidden');
    assert.equal(isForbiddenIp('169.254.169.254'), true, 'AWS metadata IP should be forbidden');
    assert.equal(isForbiddenIp('0.0.0.0'), true, '0.0.0.0 should be forbidden');
    assert.equal(isForbiddenIp('100.64.0.1'), true, 'Carrier-grade NAT should be forbidden');
    assert.equal(isForbiddenIp('192.0.2.1'), true, 'TEST-NET-1 should be forbidden');
    assert.equal(isForbiddenIp('198.51.100.1'), true, 'TEST-NET-2 should be forbidden');
    assert.equal(isForbiddenIp('203.0.113.1'), true, 'TEST-NET-3 should be forbidden');
    assert.equal(isForbiddenIp('224.0.0.1'), true, 'Multicast should be forbidden');
    assert.equal(isForbiddenIp('240.0.0.1'), true, 'Reserved Class E should be forbidden');
    assert.equal(isForbiddenIp('255.255.255.255'), true, 'Broadcast should be forbidden');
    assert.equal(isForbiddenIp('8.8.8.8'), false, 'Public IP should be allowed');
    assert.equal(isForbiddenIp('1.1.1.1'), false, 'Public IP should be allowed');
    assert.equal(isForbiddenIp('18.161.239.140'), false, 'Amazon CloudFront public IP should be allowed');
  });

  it('correctly identifies forbidden IPv6 ranges', () => {
    assert.equal(isForbiddenIp('::1'), true, 'IPv6 loopback should be forbidden');
    assert.equal(isForbiddenIp('::'), true, 'IPv6 unspecified should be forbidden');
    assert.equal(isForbiddenIp('fc00::1'), true, 'IPv6 unique local should be forbidden');
    assert.equal(isForbiddenIp('fd12:3456:789a::1'), true, 'IPv6 ULA fd00 should be forbidden');
    assert.equal(isForbiddenIp('fe80::1'), true, 'IPv6 link-local should be forbidden');
    assert.equal(isForbiddenIp('ff02::1'), true, 'IPv6 multicast should be forbidden');
    assert.equal(isForbiddenIp('100::1'), true, 'IPv6 discard-only prefix should be forbidden');
    assert.equal(isForbiddenIp('2001:db8::1'), true, 'IPv6 documentation prefix should be forbidden');
    assert.equal(isForbiddenIp('2607:f8b0:4005:805::200e'), false, 'Public IPv6 should be allowed');
  });

  it('identifies IPv4-mapped and translated IPv6 addresses in dot-decimal and hex', () => {
    assert.equal(isForbiddenIp('::ffff:127.0.0.1'), true, 'IPv4-mapped loopback should be forbidden');
    assert.equal(isForbiddenIp('::ffff:10.0.0.1'), true, 'IPv4-mapped 10.x private IP should be forbidden');
    assert.equal(isForbiddenIp('::ffff:169.254.169.254'), true, 'IPv4-mapped cloud metadata should be forbidden');
    assert.equal(isForbiddenIp('::ffff:7f00:1'), true, 'IPv4-mapped hex 127.0.0.1 should be forbidden');
    assert.equal(isForbiddenIp('::ffff:c0a8:0101'), true, 'IPv4-mapped hex 192.168.1.1 should be forbidden');
    assert.equal(isForbiddenIp('64:ff9b::127.0.0.1'), true, 'NAT64 translated loopback should be forbidden');
    assert.equal(isForbiddenIp('::ffff:8.8.8.8'), false, 'IPv4-mapped public IP should be allowed');
    assert.equal(isForbiddenIp('::ffff:0808:0808'), false, 'IPv4-mapped hex public IP should be allowed');
  });

  it('permits legitimate public domains including www.amazon.in', async () => {
    assert.equal(isForbiddenIp('www.amazon.in'), false, 'Domain name should not be treated as forbidden IP');
    assert.equal(isForbiddenIp('amazon.in'), false, 'Domain name should not be treated as forbidden IP');
    assert.equal(isForbiddenIp('flipkart.com'), false, 'Domain name should not be treated as forbidden IP');

    const amazonUrl = await validateUrlSsrf('https://www.amazon.in/dp/B0BDK62PDX');
    assert.equal(amazonUrl.hostname, 'www.amazon.in');

    const flipkartUrl = await validateUrlSsrf('https://www.flipkart.com/apple-iphone-15/p/itm6ac6485515ae4');
    assert.equal(flipkartUrl.hostname, 'www.flipkart.com');
  });

  it('blocks dangerous URL schemes and local addresses', async () => {
    await assert.rejects(
      async () => validateUrlSsrf('ftp://example.com/test'),
      (err: Error) => err instanceof SsrfError && err.message.includes('Forbidden protocol')
    );

    await assert.rejects(
      async () => validateUrlSsrf('file:///etc/passwd'),
      (err: Error) => err instanceof SsrfError && err.message.includes('Forbidden protocol')
    );

    await assert.rejects(
      async () => validateUrlSsrf('http://127.0.0.1:8080/admin'),
      (err: Error) => err instanceof SsrfError && err.message.includes('private/internal IP')
    );

    await assert.rejects(
      async () => validateUrlSsrf('http://[::1]:8080/admin'),
      (err: Error) => err instanceof SsrfError && err.message.includes('private/internal IP')
    );

    await assert.rejects(
      async () => validateUrlSsrf('http://[::ffff:127.0.0.1]/'),
      (err: Error) => err instanceof SsrfError && err.message.includes('private/internal IP')
    );

    await assert.rejects(
      async () => validateUrlSsrf('http://localhost:3000'),
      (err: Error) => err instanceof SsrfError && err.message.includes('localhost')
    );

    await assert.rejects(
      async () => validateUrlSsrf('http://user:pass@example.com'),
      (err: Error) => err instanceof SsrfError && err.message.includes('Credentials in URL')
    );
  });

  it('blocks domains that resolve to mixed public and private IP addresses', async () => {
    const origLookup = dns.lookup;
    try {
      (dns as any).lookup = async (hostname: string, options?: any) => {
        if (hostname === 'mixed-threat.example.com') {
          return [
            { address: '93.184.216.34', family: 4 }, // Public
            { address: '127.0.0.1', family: 4 },    // Private
          ];
        }
        return origLookup(hostname, options);
      };

      await assert.rejects(
        async () => validateUrlSsrf('https://mixed-threat.example.com/item'),
        (err: Error) =>
          err instanceof SsrfError &&
          err.message.includes('resolved to forbidden internal/private address (127.0.0.1)')
      );
    } finally {
      (dns as any).lookup = origLookup;
    }
  });

  it('blocks redirects to private or internal destinations', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(302, { Location: 'http://127.0.0.1:8080/admin/dump' });
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;

    try {
      await assert.rejects(
        async () => safeFetchHtml(`http://127.0.0.1:${port}/redirect`),
        (err: Error) => err instanceof SsrfError
      );
    } finally {
      server.close();
    }
  });

  it('detects and prevents DNS rebinding during connection phase', async () => {
    const origLookup = dns.lookup;
    try {
      (dns as any).lookup = async (hostname: string, options?: any) => {
        if (hostname === 'rebind-test.example.com') {
          return [{ address: '169.254.169.254', family: 4 }];
        }
        return origLookup(hostname, options);
      };

      await assert.rejects(
        async () => safeFetchHtml('https://rebind-test.example.com/metadata'),
        (err: Error) => err instanceof SsrfError && err.message.includes('169.254.169.254')
      );
    } finally {
      (dns as any).lookup = origLookup;
    }
  });

  it('fetches legitimate Amazon India product page via safeFetchHtml without SSRF block', async () => {
    const url = 'https://www.amazon.in/dp/B0BDK62PDX';
    const fetchRes = await safeFetchHtml(url);
    assert.equal(fetchRes.statusCode, 200);
    assert.ok(fetchRes.html.length > 1000);
    assert.ok(fetchRes.finalUrl.includes('amazon.in'));

    const merchantInfo = detectMerchant(url);
    const extracted = extractAmazonProduct(fetchRes.html, merchantInfo, url);
    assert.equal(extracted.skuOrAsin, 'B0BDK62PDX');
    assert.equal(extracted.merchantType, 'amazon');
    assert.ok(extracted.canonicalUrl.includes('B0BDK62PDX'));
  });
});

describe('Merchant Detector', () => {
  it('extracts Amazon ASIN and formats canonical URL', () => {
    const url = 'https://www.amazon.in/Apple-iPhone-16-128-GB/dp/B0BDK62PDX?tag=affiliate-21&ref_=nav_signin';
    const asin = extractAmazonAsin(url);
    assert.equal(asin, 'B0BDK62PDX');

    const detected = detectMerchant(url);
    assert.equal(detected.merchantType, 'amazon');
    assert.equal(detected.merchantName, 'Amazon India');
    assert.equal(detected.skuOrAsin, 'B0BDK62PDX');
    assert.equal(detected.canonicalUrl, 'https://www.amazon.in/dp/B0BDK62PDX');
  });

  it('extracts Flipkart PID and formats canonical URL', () => {
    const url = 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPNUUMGX7F&lid=LSTMOBGTAGPNUUMGX7F&marketplace=FLIPKART';
    const pid = extractFlipkartPid(url);
    assert.equal(pid, 'MOBGTAGPNUUMGX7F');

    const detected = detectMerchant(url);
    assert.equal(detected.merchantType, 'flipkart');
    assert.equal(detected.merchantName, 'Flipkart');
    assert.equal(detected.skuOrAsin, 'MOBGTAGPNUUMGX7F');
    assert.ok(detected.canonicalUrl.includes('pid=MOBGTAGPNUUMGX7F'));
    assert.ok(!detected.canonicalUrl.includes('marketplace=FLIPKART'));
  });

  it('cleans tracking parameters on generic merchant URLs', () => {
    const raw = 'https://www.croma.com/apple-macbook-air-m2/p/256608?utm_source=google&utm_medium=cpc&utm_campaign=brand&gclid=12345';
    const cleaned = cleanGenericTrackingParams(raw);
    assert.equal(cleaned, 'https://www.croma.com/apple-macbook-air-m2/p/256608');

    const detected = detectMerchant(raw);
    assert.equal(detected.merchantType, 'generic');
    assert.equal(detected.merchantName, 'Croma');
  });
});

describe('Product Extractors', () => {
  it('extracts product from JSON-LD Schema.org data in generic extractor', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "AudioTech Pro Wireless Headphones",
            "description": "Industry leading noise cancelling headphones with auto NC optimizer.",
            "brand": { "@type": "Brand", "name": "AudioTech" },
            "image": ["https://images.example.com/audiotech-pro.jpg"],
            "sku": "AUDIO-PRO-BLK",
            "offers": {
              "@type": "Offer",
              "price": "29990.00",
              "priceCurrency": "INR",
              "availability": "https://schema.org/InStock"
            },
            "additionalProperty": [
              { "@type": "PropertyValue", "name": "Battery Life", "value": "30 Hours" },
              { "@type": "PropertyValue", "name": "Connectivity", "value": "Bluetooth 5.2" }
            ]
          }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const merchantInfo = detectMerchant('https://www.audiotech.example.com/headphones/pro');
    const result = extractGenericProduct(sampleHtml, merchantInfo, 'https://www.audiotech.example.com/headphones/pro');

    assert.equal(result.rawTitle, 'AudioTech Pro Wireless Headphones');
    assert.equal(result.brand, 'AudioTech');
    assert.equal(result.price, 29990);
    assert.equal(result.currency, 'INR');
    assert.equal(result.availability, 'in_stock');
    assert.equal(result.skuOrAsin, 'AUDIO-PRO-BLK');
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].url, 'https://images.example.com/audiotech-pro.jpg');
    assert.equal(result.specifications.length, 2);
    assert.equal(result.specifications[0].key, 'Battery Life');
    assert.equal(result.specifications[0].value, '30 Hours');
  });

  it('detects Amazon anti-bot challenge page', () => {
    const botHtml = `
      <html>
        <body>
          <h4>Type the characters you see in this image:</h4>
          <form action="/errors/validateCaptcha">
            <input name="field-keywords" />
          </form>
          <p>To discuss automated access to Amazon data please contact api-services-support@amazon.com</p>
        </body>
      </html>
    `;

    assert.equal(isAmazonAntiBot(botHtml), true);
    const merchantInfo = detectMerchant('https://www.amazon.in/dp/B0BDK62PDX');
    const result = extractAmazonProduct(botHtml, merchantInfo, 'https://www.amazon.in/dp/B0BDK62PDX');
    assert.equal(result.isAntiBotBlocked, true);
  });

  it('extracts Amazon product details from DOM markup', () => {
    const amazonHtml = `
      <html>
        <body>
          <span id="productTitle">Apple Watch Ultra 2 [GPS + Cellular 49mm] Smartwatch</span>
          <a id="bylineInfo">Visit the Apple Store</a>
          <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay">
            <span class="a-offscreen">₹89,900.00</span>
          </span>
          <span class="basisPrice">
            <span class="a-offscreen">₹89,999.00</span>
          </span>
          <div id="availability">
            <span>In stock</span>
          </div>
          <div id="feature-bullets">
            <ul>
              <li><span class="a-list-item">Rugged and capable titanium case</span></li>
              <li><span class="a-list-item">Up to 36 hours of normal battery life</span></li>
            </ul>
          </div>
          <table class="prodDetTable">
            <tr>
              <th>Operating System</th>
              <td>watchOS 10</td>
            </tr>
            <tr>
              <th>Water Resistance</th>
              <td>100 Metres</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const merchantInfo = detectMerchant('https://www.amazon.in/dp/B0CHX5R34P');
    const result = extractAmazonProduct(amazonHtml, merchantInfo, 'https://www.amazon.in/dp/B0CHX5R34P');

    assert.equal(result.rawTitle, 'Apple Watch Ultra 2 [GPS + Cellular 49mm] Smartwatch');
    assert.equal(result.brand, 'Apple');
    assert.equal(result.price, 89900);
    assert.equal(result.originalPrice, 89999);
    assert.equal(result.availability, 'in_stock');
    assert.equal(result.features.length, 2);
    assert.equal(result.features[0], 'Rugged and capable titanium case');
    assert.equal(result.specifications.length, 2);
    assert.equal(result.specifications[0].key, 'Operating System');
    assert.equal(result.specifications[0].value, 'watchOS 10');
    assert.equal(result.isAntiBotBlocked, false);
  });

  it('extracts Flipkart product details from DOM markup', () => {
    const flipkartHtml = `
      <html>
        <body>
          <span class="B_NuCI">Google Pixel 8 Pro (Bay, 128 GB)</span>
          <div class="_30jeq3 _16Jk6d">₹99,999</div>
          <div class="_3I9_wc _2p6cR8">₹1,06,999</div>
          <div class="_241VTa">
            <ul>
              <li>128 GB ROM</li>
              <li>17.02 cm (6.7 inch) Full HD+ Display</li>
              <li>50MP + 48MP + 48MP Rear Camera</li>
            </ul>
          </div>
          <table class="_14cfVK">
            <tr class="_1s_Smc">
              <td class="_1hKmbr col-3-12">In The Box</td>
              <td class="_21lJbe col-9-12">Handset, 1 m USB-C to USB-C Cable</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const merchantInfo = detectMerchant('https://www.flipkart.com/google-pixel-8-pro/p/itm123?pid=MOBGTAG123456789');
    const result = extractFlipkartProduct(flipkartHtml, merchantInfo, 'https://www.flipkart.com/google-pixel-8-pro/p/itm123?pid=MOBGTAG123456789');

    assert.equal(result.rawTitle, 'Google Pixel 8 Pro (Bay, 128 GB)');
    assert.equal(result.brand, 'Google');
    assert.equal(result.price, 99999);
    assert.equal(result.originalPrice, 106999);
    assert.equal(result.features.length, 3);
    assert.equal(result.features[0], '128 GB ROM');
    assert.equal(result.specifications.length, 1);
    assert.equal(result.specifications[0].key, 'In The Box');
    assert.equal(result.isAntiBotBlocked, false);
  });
});

describe('Gemini Model Manager', () => {
  it('validates model identifiers, collapses aliases, and preserves priority order', () => {
    const manager = new GeminiModelManager([
      'gemini-3.8-flash',
      'gemini-3.7-flash', // Alias of 3.8 Flash -> collapses & deduplicates
      'invalid model spaces',
      'gemini-flash-latest', // Dynamic pointer alias -> rejected
      'gemini-pro-latest', // Dynamic pointer alias -> rejected
      'gemini-3.6-flash',
      'gemini-3.5-flash', // Alias of 3.6 Flash -> collapses & deduplicates
      'gemini-3-flash-preview', // Alias of 3.6 Flash -> collapses & deduplicates
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
      'custom-model-latest', // Dynamic pointer alias -> rejected
    ]);

    const ordered = manager.getOrderedModels();
    assert.deepEqual(ordered, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
    ]);
  });

  it('manages model cooldowns per key slot with bounded backoff and never shortens active cooldown', () => {
    const manager = new GeminiModelManager(['gemini-3.8-flash', 'gemini-3.6-flash']);
    assert.equal(manager.isModelEligible(1, 'gemini-3.8-flash'), true);

    manager.reportCooldown(1, 'gemini-3.8-flash', 120);
    assert.equal(manager.isModelEligible(1, 'gemini-3.8-flash'), false);
    const cooldown1 = manager.getCooldownRemaining(1, 'gemini-3.8-flash');
    assert.ok(cooldown1 >= 100);

    // Subsequent shorter report must NOT shorten existing cooldown
    manager.reportCooldown(1, 'gemini-3.8-flash', 10);
    const cooldown2 = manager.getCooldownRemaining(1, 'gemini-3.8-flash');
    assert.ok(cooldown2 >= cooldown1 - 2, 'Cooldown must not be shortened');

    // Same model on Slot 2 remains eligible
    assert.equal(manager.isModelEligible(2, 'gemini-3.8-flash'), true);
    // Other model on Slot 1 remains eligible
    assert.equal(manager.isModelEligible(1, 'gemini-3.6-flash'), true);
  });

  it('coordinates concurrent in-flight requests atomically with tryAcquireInFlight', () => {
    const manager = new GeminiModelManager(['gemini-3.8-flash', 'gemini-3.6-flash']);
    assert.equal(manager.isModelEligible(1, 'gemini-3.8-flash'), true);

    // Atomically acquire 3 concurrent slots on model 1
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.8-flash'), true);
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.8-flash'), true);
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.8-flash'), true);
    assert.equal(manager.getInFlightCount(1, 'gemini-3.8-flash'), 3);
    assert.equal(manager.getPeakInFlight(1, 'gemini-3.8-flash'), 3);

    // 4th concurrent attempt fails atomically (load shedding)
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.8-flash'), false);
    assert.equal(manager.isModelEligible(1, 'gemini-3.8-flash'), false);

    // Fallback model 2 is available
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.6-flash'), true);
    assert.equal(manager.getInFlightCount(1, 'gemini-3.6-flash'), 1);

    // Release 1 slot on model 1
    manager.releaseInFlight(1, 'gemini-3.8-flash');
    assert.equal(manager.getInFlightCount(1, 'gemini-3.8-flash'), 2);
    // Peak remains 3
    assert.equal(manager.getPeakInFlight(1, 'gemini-3.8-flash'), 3);

    // Now model 1 has room again
    assert.equal(manager.tryAcquireInFlight(1, 'gemini-3.8-flash'), true);
    assert.equal(manager.getInFlightCount(1, 'gemini-3.8-flash'), 3);

    // Clean up
    manager.releaseInFlight(1, 'gemini-3.8-flash');
    manager.releaseInFlight(1, 'gemini-3.8-flash');
    manager.releaseInFlight(1, 'gemini-3.8-flash');
    manager.releaseInFlight(1, 'gemini-3.6-flash');
    assert.equal(manager.getInFlightCount(1, 'gemini-3.8-flash'), 0);
  });

  it('uses updated official model priority list (stable ahead of preview)', () => {
    assert.deepEqual(DEFAULT_MODEL_PRIORITY, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
    ]);
  });
});

describe('Gemini Key Manager', () => {
  it('deduplicates identical keys and exposes zero secrets in diagnostics', () => {
    const manager = new GeminiKeyManager({
      key1: 'AIzaSyA_unique_key_1_1234567890abcdef',
      key2: 'AIzaSyA_unique_key_1_1234567890abcdef', // Duplicate key string
      key3: 'AIzaSyB_unique_key_2_1234567890abcdef',
    });

    const diag = manager.getDiagnostics();
    assert.equal(diag.length, 3);
    assert.equal(diag[0].configured, true);
    assert.equal(diag[1].configured, true);
    assert.ok(diag[1].lastError?.includes('Duplicate of Key Slot 1'));

    // Verify zero key material leaks
    const jsonStr = JSON.stringify(diag);
    assert.ok(!jsonStr.includes('AIzaSyA'));
    assert.ok(!jsonStr.includes('AIzaSyB'));
  });

  it('marks slot quota exhausted and isolates from eligible slots', () => {
    const manager = new GeminiKeyManager({
      key1: 'key1-secret',
      key2: 'key2-secret',
    });

    assert.deepEqual(manager.getEligibleSlots(), [1, 2]);

    manager.reportProjectQuotaExhausted(1, 86400, 'Daily limit reached');
    assert.deepEqual(manager.getEligibleSlots(), [2]);
  });
});

describe('Structured Error Classification Engine', () => {
  it('HTTP 401 distinguishes invalid credentials from other auth failures', () => {
    const invalidKey = classifyGeminiApiError(401, {
      error: {
        code: 401,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'UNAUTHENTICATED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'API_KEY_INVALID',
            domain: 'googleapis.com',
          },
        ],
      },
    });
    assert.equal(invalidKey.type, 'AUTH_INVALID_KEY');
    assert.equal(invalidKey.isProjectFatal, true);
    assert.equal(invalidKey.isPermanentAuth, true);

    const otherAuth = classifyGeminiApiError(401, {
      error: {
        code: 401,
        message: 'Request had invalid authentication credentials.',
        status: 'UNAUTHENTICATED',
      },
    });
    assert.equal(otherAuth.type, 'AUTH_OTHER');
    assert.equal(otherAuth.isProjectFatal, true);
  });

  it('HTTP 403 distinguishes key restrictions, project restrictions, billing, and model permissions', () => {
    // 403 IP/Referrer restriction
    const keyRestriction = classifyGeminiApiError(403, {
      error: {
        code: 403,
        message: 'Requests to this API method are blocked by API key restrictions.',
        status: 'PERMISSION_DENIED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'API_KEY_IP_BLOCKED',
            domain: 'googleapis.com',
          },
        ],
      },
    });
    assert.equal(keyRestriction.type, 'KEY_RESTRICTION_ERROR');
    assert.equal(keyRestriction.isProjectFatal, true);

    // 403 Service Disabled
    const serviceDisabled = classifyGeminiApiError(403, {
      error: {
        code: 403,
        message: 'Generative Language API has not been used in project 12345 before or it is disabled.',
        status: 'PERMISSION_DENIED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'SERVICE_DISABLED',
            domain: 'googleapis.com',
          },
        ],
      },
    });
    assert.equal(serviceDisabled.type, 'PROJECT_DISABLED_ERROR');
    assert.equal(serviceDisabled.isProjectFatal, true);

    // 403 Billing Disabled
    const billingDisabled = classifyGeminiApiError(403, {
      error: {
        code: 403,
        message: 'Google Cloud project billing account is disabled.',
        status: 'PERMISSION_DENIED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'BILLING_DISABLED',
            domain: 'googleapis.com',
          },
        ],
      },
    });
    assert.equal(billingDisabled.type, 'PROJECT_BILLING_ERROR');
    assert.equal(billingDisabled.isProjectFatal, true);

    // 403 Model Permission Denied (model-specific, not project-fatal)
    const modelDenied = classifyGeminiApiError(403, {
      error: {
        code: 403,
        message: 'User does not have permission to access model gemini-3.1-pro-preview.',
        status: 'PERMISSION_DENIED',
      },
    });
    assert.equal(modelDenied.type, 'MODEL_PERMISSION_DENIED');
    assert.equal(modelDenied.isModelSpecific, true);
    assert.equal(modelDenied.isProjectFatal, false);
  });

  it('HTTP 429 accurately distinguishes model RPM/TPM from project-wide daily quota exhaustion', () => {
    // Model RPM limit
    const modelRateLimit = classifyGeminiApiError(429, {
      error: {
        code: 429,
        message: 'Resource has been exhausted (e.g. check quota). Rate limit exceeded.',
        status: 'RESOURCE_EXHAUSTED',
      },
    });
    assert.equal(modelRateLimit.type, 'MODEL_RATE_LIMIT');
    assert.equal(modelRateLimit.isModelSpecific, true);
    assert.equal(modelRateLimit.isProjectFatal, false);

    // Project daily quota limit (via structured ErrorInfo and QuotaFailure)
    const projectQuota = classifyGeminiApiError(429, {
      error: {
        code: 429,
        message: 'Quota exceeded for quota metric "Queries" and limit "Queries per day" of service',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'QUOTA_EXCEEDED',
            metadata: { quota_metric: 'queries_per_day' },
          },
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ description: 'Daily limit reached for queries' }],
          },
        ],
      },
    });
    assert.equal(projectQuota.type, 'PROJECT_QUOTA_EXHAUSTED');
    assert.equal(projectQuota.isModelSpecific, false);
    assert.equal(projectQuota.isProjectFatal, true);
  });

  it('HTTP 400 distinguishes malformed payload from model unsupported config/schema', () => {
    // Unsupported schema config (model-specific)
    const unsupportedSchema = classifyGeminiApiError(400, {
      error: {
        code: 400,
        message: 'Invalid argument: responseSchema is not supported for this model.',
        status: 'INVALID_ARGUMENT',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.BadRequest',
            fieldViolations: [{ field: 'generationConfig.responseSchema', description: 'unsupported' }],
          },
        ],
      },
    });
    assert.equal(unsupportedSchema.type, 'MODEL_UNSUPPORTED_CONFIG');
    assert.equal(unsupportedSchema.isModelSpecific, true);

    // Malformed client payload (fast-fail, not model-specific)
    const badReq = classifyGeminiApiError(400, {
      error: {
        code: 400,
        message: 'Invalid JSON payload received. Unexpected token.',
        status: 'INVALID_ARGUMENT',
      },
    });
    assert.equal(badReq.type, 'INVALID_REQUEST_PAYLOAD');
    assert.equal(badReq.isModelSpecific, false);
  });

  it('HTTP 503 is treated as transient service unavailability with retry backoff', () => {
    const serviceUnavailable = classifyGeminiApiError(
      503,
      {
        error: {
          code: 503,
          message: 'The model is overloaded. Please try again later.',
          status: 'UNAVAILABLE',
        },
      },
      '15'
    );
    assert.equal(serviceUnavailable.type, 'TRANSIENT_SERVICE_UNAVAILABLE');
    assert.equal(serviceUnavailable.isModelSpecific, true);
    assert.equal(serviceUnavailable.isProjectFatal, false);
    assert.equal(serviceUnavailable.retryAfterSeconds, 15);
  });

  it('backward compatibility helper classifyGeminiError preserves compatibility', () => {
    const legacyModel = classifyGeminiError(429, {
      error: { message: 'Resource exhausted: rate limit exceeded for model gemini-3.8-flash' },
    });
    assert.equal(legacyModel.type, 'MODEL_SPECIFIC_ERROR');

    const legacyQuota = classifyGeminiError(429, {
      error: {
        message: 'Quota exceeded for quota metric "Queries" and limit "Queries per day" of service',
        details: [{ reason: 'QUOTA_EXCEEDED', metadata: { quota_metric: 'queries_per_day' } }],
      },
    });
    assert.equal(legacyQuota.type, 'PROJECT_QUOTA_EXHAUSTED');
  });
});


describe('Gemini Model-First, Key-Second Rotation Engine (14 Mandatory Scenarios)', () => {
  // Mock generation payload
  const mockPrompt = 'Test prompt';
  const mockProps = { title: { type: 'STRING' } };
  const mockReq = ['title'];

  it('1. Model A succeeds using Key 1 on first attempt', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    // Stub callGeminiApi
    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      return { title: 'Success on Model A Key 1' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Success on Model A Key 1');
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].key, 'k1');
    assert.equal(attempts[0].model, 'model-a');
  });

  it('2. Model A fails and Model B succeeds using Key 1 (Model-first failover)', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (model === 'model-a') {
        const err: any = new Error('Model A capacity limit');
        err.classified = { type: 'MODEL_SPECIFIC_ERROR', message: 'Rate limit on model A' };
        throw err;
      }
      return { title: 'Success on Model B Key 1' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Success on Model B Key 1');
    assert.equal(attempts.length, 2);
    // Key remained k1!
    assert.equal(attempts[0].key, 'k1');
    assert.equal(attempts[0].model, 'model-a');
    assert.equal(attempts[1].key, 'k1');
    assert.equal(attempts[1].model, 'model-b');
  });

  it('3. All eligible models fail on Key 1, then Model A succeeds on Key 2', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (key === 'k1') {
        const err: any = new Error(`Failed ${model} on k1`);
        err.classified = { type: 'MODEL_SPECIFIC_ERROR', message: 'Model rate limit' };
        throw err;
      }
      return { title: 'Success on Model A Key 2' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Success on Model A Key 2');
    assert.equal(attempts.length, 3);
    assert.deepEqual(attempts, [
      { key: 'k1', model: 'model-a' },
      { key: 'k1', model: 'model-b' },
      { key: 'k2', model: 'model-a' },
    ]);
  });

  it('4. All eligible models fail on Key 1 & Key 2, then Key 3 is attempted', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2', key3: 'k3' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (key === 'k1' || key === 'k2') {
        const err: any = new Error('Model rate limited');
        err.classified = { type: 'MODEL_SPECIFIC_ERROR', message: 'Rate limit' };
        throw err;
      }
      return { title: 'Success on Key 3' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Success on Key 3');
    assert.equal(attempts.length, 5);
    assert.deepEqual(attempts, [
      { key: 'k1', model: 'model-a' },
      { key: 'k1', model: 'model-b' },
      { key: 'k2', model: 'model-a' },
      { key: 'k2', model: 'model-b' },
      { key: 'k3', model: 'model-a' },
    ]);
  });

  it('5. Model-specific 429 triggers eligible model fallback on same key', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (model === 'model-a') {
        const err: any = new Error('HTTP 429');
        err.classified = {
          type: 'MODEL_SPECIFIC_ERROR',
          statusCode: 429,
          message: 'Model RPM limit reached',
          retryAfterSeconds: 60,
        };
        throw err;
      }
      return { title: 'Fallback model succeeded' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Fallback model succeeded');
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].model, 'model-a');
    assert.equal(attempts[1].model, 'model-b');
  });

  it('6. Project-wide quota exhaustion skips remaining models and moves to next eligible key', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b', 'model-c']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (key === 'k1') {
        const err: any = new Error('Daily quota exceeded');
        err.classified = {
          type: 'PROJECT_QUOTA_EXHAUSTED',
          statusCode: 429,
          message: 'Project daily quota reached',
        };
        throw err;
      }
      return { title: 'Key 2 Success' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Key 2 Success');
    // Crucial: Key 1 was NOT attempted for model-b and model-c!
    assert.deepEqual(attempts, [
      { key: 'k1', model: 'model-a' },
      { key: 'k2', model: 'model-a' },
    ]);
  });

  it('7. Invalid key is isolated and skips remaining models for that key', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'invalid-key', key2: 'valid-key' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      if (key === 'invalid-key') {
        const err: any = new Error('API key invalid');
        err.classified = {
          type: 'AUTH_INVALID_KEY',
          statusCode: 400,
          message: 'API_KEY_INVALID',
        };
        throw err;
      }
      return { title: 'Valid key success' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Valid key success');
    // Did not retry model-b on invalid-key
    assert.deepEqual(attempts, [
      { key: 'invalid-key', model: 'model-a' },
      { key: 'valid-key', model: 'model-a' },
    ]);
    // Key 1 is marked permanently unhealthy
    assert.equal(keyManager.getDiagnostics()[0].healthy, false);
  });

  it('8. Unsupported model is skipped', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    // Mark model-a as unsupported for slot 1
    modelManager.reportUnsupported(1, 'model-a');

    const attempts: Array<{ key: string; model: string }> = [];
    (service as any).callGeminiApi = async (key: string, model: string) => {
      attempts.push({ key, model });
      return { title: 'Model B success' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Model B success');
    // Model-a was never called because it was marked unsupported
    assert.deepEqual(attempts, [{ key: 'k1', model: 'model-b' }]);
  });

  it('9. HTTP 400 does not trigger indiscriminate key rotation', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2', key3: 'k3' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    let callCount = 0;
    (service as any).callGeminiApi = async () => {
      callCount++;
      const err: any = new Error('Invalid JSON input payload');
      err.classified = {
        type: 'INVALID_REQUEST',
        statusCode: 400,
        message: 'Invalid JSON payload received.',
      };
      throw err;
    };

    await assert.rejects(
      async () => service.executeStructuredGeneration(mockPrompt, mockProps, mockReq),
      /Gemini Bad Request \(400\)/
    );

    // Call count must be exactly 1; must NOT rotate through all keys and models for bad request!
    assert.equal(callCount, 1);
  });

  it('10. HTTP 503 uses bounded retries and cooldown', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const attempts: string[] = [];
    (service as any).callGeminiApi = async (_key: string, model: string) => {
      attempts.push(model);
      if (model === 'model-a') {
        const err: any = new Error('503 Service Unavailable');
        err.classified = {
          type: 'TRANSIENT_SERVER_ERROR',
          statusCode: 503,
          message: 'Server capacity issue',
        };
        throw err;
      }
      return { title: 'Recovered on model B' };
    };

    const res = await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    assert.equal(res.data.title, 'Recovered on model B');
    assert.deepEqual(attempts, ['model-a', 'model-b']);
  });

  it('11. Retry-After header is respected on model rate limits', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    (service as any).callGeminiApi = async (_key: string, model: string) => {
      if (model === 'model-a') {
        const err: any = new Error('429 Rate Limit');
        err.classified = {
          type: 'MODEL_SPECIFIC_ERROR',
          statusCode: 429,
          message: 'Rate limit',
          retryAfterSeconds: 120, // 2 minutes
        };
        throw err;
      }
      return { title: 'Success' };
    };

    await service.executeStructuredGeneration(mockPrompt, mockProps, mockReq);
    // Model A on slot 1 should have >= 60 seconds cooldown
    const cooldown = modelManager.getCooldownRemaining(1, 'model-a');
    assert.ok(cooldown > 50, 'Cooldown should respect 120s Retry-After');
  });

  it('12. Concurrent imports do not corrupt rotation state (20-request burst concurrency)', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const models = ['model-a', 'model-b', 'model-c', 'model-d'];
    const modelManager = new GeminiModelManager(models);
    const service = new GeminiRotationService(keyManager, modelManager);

    (service as any).callGeminiApi = async (_key: string, model: string) => {
      // Simulate asynchronous network execution latency
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { title: `Result for ${model}` };
    };

    // Run 20 simultaneous requests concurrently (substantially larger than MAX_CONCURRENT_PER_MODEL = 3)
    const burstPromises = Array.from({ length: 20 }, (_, i) =>
      service.executeStructuredGeneration(`Burst prompt ${i}`, mockProps, mockReq)
    );

    const results = await Promise.all(burstPromises);

    assert.equal(results.length, 20);
    for (const res of results) {
      assert.ok(res.data.title.includes('Result for'));
      assert.ok(res.breadcrumb.includes('Success'));
    }

    // Verify maximum in-flight requests never exceeded MAX_CONCURRENT_PER_MODEL (3) for any model
    for (const slot of [1, 2]) {
      for (const m of models) {
        const peak = modelManager.getPeakInFlight(slot, m);
        assert.ok(
          peak <= GeminiModelManager.MAX_CONCURRENT_PER_MODEL,
          `Peak slot ${slot} model ${m} was ${peak}, must be <= 3`
        );
        assert.equal(
          modelManager.getInFlightCount(slot, m),
          0,
          `In-flight count for slot ${slot} model ${m} should return to 0`
        );
      }
    }
  });

  it('13. Exhausting all eligible combinations returns a clear error with breadcrumb history', async () => {
    const keyManager = new GeminiKeyManager({ key1: 'k1', key2: 'k2' });
    const modelManager = new GeminiModelManager(['model-a', 'model-b']);
    const service = new GeminiRotationService(keyManager, modelManager);

    (service as any).callGeminiApi = async () => {
      const err: any = new Error('Capacity limit');
      err.classified = { type: 'MODEL_SPECIFIC_ERROR', message: 'Out of capacity' };
      throw err;
    };

    await assert.rejects(
      async () => service.executeStructuredGeneration(mockPrompt, mockProps, mockReq),
      (err: Error) => {
        assert.ok(err.message.includes('All eligible Gemini models and API key combinations failed'));
        assert.ok(err.message.includes('Key 1 (model-a)'));
        assert.ok(err.message.includes('Key 2 (model-b)'));
        return true;
      }
    );
  });

  it('14. No API key or secret appears in logs, error messages, or diagnostics', () => {
    const secretKey = 'AIzaSySecretApiKey1234567890abcdef';
    const keyManager = new GeminiKeyManager({ key1: secretKey });
    const modelManager = new GeminiModelManager(['gemini-1.5-flash']);
    const service = new GeminiRotationService(keyManager, modelManager);

    const diag = service.getDiagnostics();
    const diagStr = JSON.stringify(diag);
    assert.ok(!diagStr.includes('AIzaSySecretApiKey'), 'Diagnostics MUST NEVER contain key string');
    assert.ok(!diagStr.includes(secretKey), 'Diagnostics MUST NEVER leak secret key');
  });
});

describe('Gemini Client Heuristic Enrichment', () => {
  it('produces high quality enriched content without hallucinating', () => {
    const client = new GeminiClient(
      new GeminiRotationService(
        new GeminiKeyManager({ key1: '' }),
        new GeminiModelManager(['gemini-1.5-flash'])
      )
    );

    const rawData = {
      url: 'https://www.amazon.in/dp/B0BDK62PDX',
      canonicalUrl: 'https://www.amazon.in/dp/B0BDK62PDX',
      merchantType: 'amazon' as const,
      merchantName: 'Amazon India',
      rawTitle: 'Apple iPhone 16 (128 GB) - Teal (Latest Model with A18 Chip) [Amazon Special Edition]',
      brand: 'Apple',
      rawDescription: 'iPhone 16 features Camera Control, 48MP Fusion camera, and A18 chip.',
      price: 79900,
      currency: 'INR',
      availability: 'in_stock' as const,
      images: [{ url: 'https://example.com/img1.jpg', alt: 'iPhone 16' }],
      specifications: [{ key: 'Chipset', value: 'Apple A18' }],
      features: ['Camera Control for easy photo capture', '48MP 2-in-1 Fusion camera'],
    };

    const categories = [
      { name: 'Electronics', slug: 'electronics' },
      { name: 'Smartphones', slug: 'smartphones' },
    ];

    const enriched = client.heuristicEnrichment(rawData, categories);

    assert.ok(enriched.title.length > 5);
    assert.ok(!enriched.title.includes('[Amazon Special Edition]'), 'SEO noise should be stripped');
    assert.equal(enriched.brand, 'Apple');
    assert.equal(enriched.slug.length > 0, true);
    assert.ok(enriched.highlights.length >= 2);
    assert.ok(enriched.seoTitle.includes('SAVRIVO'));
    assert.ok(enriched.searchKeywords.length >= 3);
  });
});

describe('Duplicate Detector', () => {
  it('detects duplicate when canonicalUrl or title matches in database', async () => {
    const originalFindOne = Product.findOne;
    const originalOfferFindOne = Offer.findOne;

    try {
      Product.findOne = ((query: any) => {
        if (query?.$or?.some((q: any) => q.canonicalUrl === 'https://www.amazon.in/dp/B0EXISTING123')) {
          return {
            select: () => ({
              lean: async () => ({
                _id: '507f1f77bcf86cd799439011',
                title: 'Existing Flagship Smartphone',
                slug: 'existing-flagship-smartphone',
              }),
            }),
          } as any;
        }
        return {
          select: () => ({
            lean: async () => null,
          }),
        } as any;
      }) as any;

      Offer.findOne = (() => ({
        select: () => ({
          lean: async () => null,
        }),
      })) as any;

      const detector = new DuplicateDetector();
      const dup = await detector.checkDuplicate({
        canonicalUrl: 'https://www.amazon.in/dp/B0EXISTING123',
      });

      assert.equal(dup.isDuplicate, true);
      assert.equal(dup.duplicateProductId, '507f1f77bcf86cd799439011');
      assert.equal(dup.duplicateProductTitle, 'Existing Flagship Smartphone');
      assert.equal(dup.matchReason, 'canonical_url');

      const nonDup = await detector.checkDuplicate({
        canonicalUrl: 'https://www.amazon.in/dp/B0NEW1234567',
      });
      assert.equal(nonDup.isDuplicate, false);
    } finally {
      Product.findOne = originalFindOne;
      Offer.findOne = originalOfferFindOne;
    }
  });
});
