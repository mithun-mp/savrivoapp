import type { ExtractedProductData, ExtractedImage, ExtractedSpecification } from '../product-import.types';
import type { DetectedMerchantInfo } from '../merchant-detector';
import { extractGenericProduct } from './generic.extractor';
import { stripHtml, decodeHtmlEntities, parsePriceNumber } from './html-utils';

export function isAmazonAntiBot(html: string): boolean {
  return (
    html.includes('api-services-support@amazon.com') ||
    html.includes('Type the characters you see in this image') ||
    html.includes('Enter the characters you see below') ||
    html.includes('/errors/validateCaptcha')
  );
}

export function extractAmazonProduct(
  html: string,
  merchantInfo: DetectedMerchantInfo,
  originalUrl: string
): ExtractedProductData {
  // 1. Check Anti-Bot
  if (isAmazonAntiBot(html)) {
    return {
      url: originalUrl,
      canonicalUrl: merchantInfo.canonicalUrl,
      merchantType: 'amazon',
      merchantName: merchantInfo.merchantName,
      rawTitle: 'Amazon Product (Anti-Bot Verification Triggered)',
      currency: 'INR',
      availability: 'unknown',
      images: [],
      specifications: [],
      features: [],
      skuOrAsin: merchantInfo.skuOrAsin,
      isAntiBotBlocked: true,
    };
  }

  // Base fallback from generic extractor (JSON-LD & OpenGraph)
  const baseData = extractGenericProduct(html, merchantInfo, originalUrl);

  let rawTitle = baseData.rawTitle;
  let brand = baseData.brand;
  let price = baseData.price;
  let originalPrice = baseData.originalPrice;
  let availability = baseData.availability;
  const images: ExtractedImage[] = [...baseData.images];
  const specifications: ExtractedSpecification[] = [...baseData.specifications];
  const features: string[] = [...baseData.features];

  // 2. Extract DOM Title
  const titleMatch = html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (titleMatch?.[1]) {
    const extracted = stripHtml(titleMatch[1]);
    if (extracted.length > 5) {
      rawTitle = extracted;
    }
  }

  // 3. Extract Brand
  const brandMatch =
    html.match(/<a[^>]+id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<tr[^>]+class=["'][^"']*po-brand[^"']*["'][\s\S]*?<td[^>]+class=["'][^"']*a-span9[^"']*["'][^>]*>([\s\S]*?)<\/td>/i);
  if (brandMatch?.[1]) {
    let b = stripHtml(brandMatch[1]);
    b = b.replace(/^Visit the\s+/i, '').replace(/\s+Store$/i, '').replace(/^Brand:\s*/i, '').trim();
    if (b.length > 1) {
      brand = b;
    }
  }

  // 4. Extract Price
  // Look for .a-price .a-offscreen or specific price elements
  const currentPriceMatches = [
    ...html.matchAll(/<span[^>]+class=["'][^"']*a-price[^"']*["'][^>]*>[\s\S]*?<span[^>]+class=["']a-offscreen["'][^>]*>([\s\S]*?)<\/span>/gi),
    ...html.matchAll(/<span[^>]+id=["'](?:priceblock_ourprice|priceblock_dealprice|priceblock_saleprice)["'][^>]*>([\s\S]*?)<\/span>/gi),
  ];

  for (const m of currentPriceMatches) {
    const val = parsePriceNumber(m[1]);
    if (val && (!price || val < price)) {
      price = val;
    }
  }

  // Look for strike-through / MRP price
  const mrpMatches = [
    ...html.matchAll(/<span[^>]+class=["'][^"']*(?:basisPrice|a-text-price)[^"']*["'][^>]*>[\s\S]*?<span[^>]+class=["']a-offscreen["'][^>]*>([\s\S]*?)<\/span>/gi),
  ];
  for (const m of mrpMatches) {
    const val = parsePriceNumber(m[1]);
    if (val && (!originalPrice || val > originalPrice)) {
      originalPrice = val;
    }
  }

  // 5. Extract Availability
  const availDiv = html.match(/<div[^>]+id=["']availability["'][^>]*>([\s\S]*?)<\/div>/i);
  if (availDiv?.[1]) {
    const text = stripHtml(availDiv[1]).toLowerCase();
    if (text.includes('in stock') || text.includes('available')) {
      availability = 'in_stock';
    } else if (text.includes('currently unavailable') || text.includes('out of stock')) {
      availability = 'out_of_stock';
    }
  }

  // 6. Extract Bullet Points / Feature Highlights
  const featureBulletsMatch = html.match(/<div[^>]+id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/div>/i);
  if (featureBulletsMatch?.[1]) {
    const liMatches = featureBulletsMatch[1].matchAll(/<li[^>]*>[\s\S]*?<span[^>]+class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi);
    for (const li of liMatches) {
      const point = stripHtml(li[1]);
      if (point.length > 10 && !point.toLowerCase().includes('replacement parts')) {
        features.push(point);
      }
    }
  }

  // 7. Extract High-Res Images from data-a-dynamic-image
  const dynamicImgMatch = html.match(/data-a-dynamic-image=["'](\{[\s\S]*?\})["']/i);
  if (dynamicImgMatch?.[1]) {
    try {
      const decodedJson = decodeHtmlEntities(dynamicImgMatch[1]);
      const imgMap = JSON.parse(decodedJson) as Record<string, number[]>;
      for (const [imgUrl] of Object.entries(imgMap)) {
        if (imgUrl.startsWith('http') && !images.some((existing) => existing.url === imgUrl)) {
          images.push({ url: imgUrl, alt: rawTitle });
        }
      }
    } catch {
      // Ignore dynamic image JSON parse failure
    }
  }

  // 8. Extract Technical Specifications Table
  const tableMatches = html.matchAll(/<table[^>]+(?:id|class)=["'][^"']*(?:prodDetTable|techSpec)[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi);
  for (const tableMatch of tableMatches) {
    const rowMatches = tableMatch[1].matchAll(/<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi);
    for (const row of rowMatches) {
      const key = stripHtml(row[1]).replace(/[\r\n\t]+/g, ' ').trim();
      const value = stripHtml(row[2]).replace(/[\r\n\t]+/g, ' ').trim();
      if (key && value && !specifications.some((s) => s.key === key)) {
        specifications.push({ key, value });
      }
    }
  }

  return {
    url: originalUrl,
    canonicalUrl: merchantInfo.canonicalUrl,
    merchantType: 'amazon',
    merchantName: merchantInfo.merchantName,
    rawTitle,
    brand: brand || undefined,
    rawDescription: baseData.rawDescription,
    price,
    originalPrice,
    currency: 'INR',
    availability,
    images: images.slice(0, 8),
    specifications: specifications.slice(0, 25),
    features: features.slice(0, 10),
    skuOrAsin: merchantInfo.skuOrAsin || baseData.skuOrAsin,
    isAntiBotBlocked: false,
  };
}

