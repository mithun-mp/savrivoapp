import type { ExtractedProductData, ExtractedImage, ExtractedSpecification } from '../product-import.types';
import type { DetectedMerchantInfo } from '../merchant-detector';
import {
  stripHtml,
  decodeHtmlEntities,
  parsePriceNumber,
  extractMetaTag,
  extractJsonLdBlocks,
  findProductInJsonLd,
} from './html-utils';

export function extractGenericProduct(
  html: string,
  merchantInfo: DetectedMerchantInfo,
  originalUrl: string
): ExtractedProductData {
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const jsonLdProduct = findProductInJsonLd(jsonLdBlocks);

  let rawTitle = '';
  let brand = '';
  let rawDescription = '';
  let price: number | undefined;
  let originalPrice: number | undefined;
  let currency = 'INR';
  let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
  const images: ExtractedImage[] = [];
  const specifications: ExtractedSpecification[] = [];
  const features: string[] = [];
  let skuOrAsin = merchantInfo.skuOrAsin;

  // 1. Check JSON-LD Product if available
  if (jsonLdProduct) {
    if (typeof jsonLdProduct.name === 'string') {
      rawTitle = jsonLdProduct.name.trim();
    }
    if (typeof jsonLdProduct.description === 'string') {
      rawDescription = stripHtml(jsonLdProduct.description);
    }
    if (jsonLdProduct.brand) {
      if (typeof jsonLdProduct.brand === 'string') {
        brand = jsonLdProduct.brand.trim();
      } else if (typeof (jsonLdProduct.brand as Record<string, unknown>).name === 'string') {
        brand = ((jsonLdProduct.brand as Record<string, unknown>).name as string).trim();
      }
    }
    if (typeof jsonLdProduct.sku === 'string') {
      skuOrAsin = skuOrAsin || jsonLdProduct.sku.trim();
    }

    // Images from JSON-LD
    const rawImages = jsonLdProduct.image;
    if (Array.isArray(rawImages)) {
      for (const img of rawImages) {
        if (typeof img === 'string' && img.startsWith('http')) {
          images.push({ url: img, alt: rawTitle || 'Product Image' });
        } else if (typeof img === 'object' && img !== null && typeof (img as Record<string, unknown>).url === 'string') {
          images.push({ url: (img as Record<string, unknown>).url as string, alt: rawTitle || 'Product Image' });
        }
      }
    } else if (typeof rawImages === 'string' && rawImages.startsWith('http')) {
      images.push({ url: rawImages, alt: rawTitle || 'Product Image' });
    }

    // Offers from JSON-LD
    const offers = jsonLdProduct.offers;
    const offerObj = Array.isArray(offers) ? offers[0] : (offers as Record<string, unknown> | undefined);
    if (offerObj) {
      const offerPrice = offerObj.price || offerObj.lowPrice;
      price = parsePriceNumber(offerPrice as string | number);
      if (typeof offerObj.priceCurrency === 'string') {
        currency = offerObj.priceCurrency.toUpperCase();
      }
      const avail = typeof offerObj.availability === 'string' ? offerObj.availability : '';
      if (avail.includes('InStock')) {
        availability = 'in_stock';
      } else if (avail.includes('OutOfStock') || avail.includes('Discontinued')) {
        availability = 'out_of_stock';
      }
    }

    // Additional properties (specifications) from JSON-LD
    if (Array.isArray(jsonLdProduct.additionalProperty)) {
      for (const prop of jsonLdProduct.additionalProperty) {
        if (typeof prop === 'object' && prop !== null) {
          const k = String((prop as Record<string, unknown>).name || '');
          const v = String((prop as Record<string, unknown>).value || '');
          if (k && v) {
            specifications.push({ key: k.trim(), value: v.trim() });
          }
        }
      }
    }
  }

  // 2. OpenGraph / Twitter meta fallbacks
  if (!rawTitle) {
    rawTitle =
      extractMetaTag(html, 'og:title') ||
      extractMetaTag(html, 'twitter:title') ||
      '';
    // Clean up site name from title like "Product Name | SiteName"
    if (rawTitle && rawTitle.includes('|')) {
      rawTitle = rawTitle.split('|')[0].trim();
    } else if (rawTitle && rawTitle.includes(' - ')) {
      rawTitle = rawTitle.split(' - ')[0].trim();
    }
  }

  if (!rawDescription) {
    rawDescription =
      extractMetaTag(html, 'og:description') ||
      extractMetaTag(html, 'twitter:description') ||
      extractMetaTag(html, 'description') ||
      '';
  }

  if (images.length === 0) {
    const ogImage = extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image');
    if (ogImage && ogImage.startsWith('http')) {
      images.push({ url: ogImage, alt: rawTitle || 'Product Image' });
    }
  }

  if (price === undefined) {
    const ogPrice = extractMetaTag(html, 'product:price:amount') || extractMetaTag(html, 'og:price:amount');
    if (ogPrice) {
      price = parsePriceNumber(ogPrice);
    }
    const ogCurrency = extractMetaTag(html, 'product:price:currency') || extractMetaTag(html, 'og:price:currency');
    if (ogCurrency) {
      currency = ogCurrency.toUpperCase();
    }
  }

  // 3. Fallback to HTML Title tag if still empty
  if (!rawTitle) {
    const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch?.[1]) {
      let t = decodeHtmlEntities(titleTagMatch[1].trim());
      if (t.includes('|')) t = t.split('|')[0].trim();
      if (t.includes(' - ')) t = t.split(' - ')[0].trim();
      rawTitle = t;
    }
  }

  return {
    url: originalUrl,
    canonicalUrl: merchantInfo.canonicalUrl,
    merchantType: merchantInfo.merchantType,
    merchantName: merchantInfo.merchantName,
    rawTitle: rawTitle || 'Untitled Product',
    brand: brand || undefined,
    rawDescription: rawDescription || undefined,
    price,
    originalPrice,
    currency,
    availability,
    images,
    specifications,
    features,
    skuOrAsin,
    isAntiBotBlocked: false,
  };
}

