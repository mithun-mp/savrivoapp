import type { ExtractedProductData, ExtractedImage, ExtractedSpecification } from '../product-import.types';
import type { DetectedMerchantInfo } from '../merchant-detector';
import { extractGenericProduct } from './generic.extractor';
import { stripHtml, parsePriceNumber } from './html-utils';

export function isFlipkartAntiBot(html: string): boolean {
  return (
    html.includes('Access Denied') ||
    html.includes('Please verify you are a human') ||
    html.includes('robot_check')
  );
}

export function extractFlipkartProduct(
  html: string,
  merchantInfo: DetectedMerchantInfo,
  originalUrl: string
): ExtractedProductData {
  if (isFlipkartAntiBot(html)) {
    return {
      url: originalUrl,
      canonicalUrl: merchantInfo.canonicalUrl,
      merchantType: 'flipkart',
      merchantName: merchantInfo.merchantName,
      rawTitle: 'Flipkart Product (Anti-Bot Verification Triggered)',
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

  // 1. Flipkart Title DOM classes (B_NuCI, VU-ZEz, _6EBuvT)
  const titleMatch = html.match(/<(?:span|h1)[^>]+class=["'][^"']*(?:B_NuCI|VU-ZEz|_6EBuvT)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|h1)>/i);
  if (titleMatch?.[1]) {
    const extracted = stripHtml(titleMatch[1]);
    if (extracted.length > 5) {
      rawTitle = extracted;
    }
  }

  // 2. Flipkart Current Price (_30jeq3, Nx9bqj)
  const priceMatch = html.match(/<div[^>]+class=["'][^"']*(?:_30jeq3|Nx9bqj)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (priceMatch?.[1]) {
    const val = parsePriceNumber(priceMatch[1]);
    if (val) {
      price = val;
    }
  }

  // 3. Flipkart MRP (_3I9_wc, yRaY8j)
  const mrpMatch = html.match(/<div[^>]+class=["'][^"']*(?:_3I9_wc|yRaY8j)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (mrpMatch?.[1]) {
    const val = parsePriceNumber(mrpMatch[1]);
    if (val) {
      originalPrice = val;
    }
  }

  // 4. Flipkart Highlights (_241VTa, _21A30W)
  const highlightsDiv = html.match(/<div[^>]+class=["'][^"']*(?:_241VTa|_21A30W)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (highlightsDiv?.[1]) {
    const liMatches = highlightsDiv[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const li of liMatches) {
      const text = stripHtml(li[1]);
      if (text.length > 3 && !features.includes(text)) {
        features.push(text);
      }
    }
  }

  // 5. Flipkart Specifications Table (_14cfVK, _3k-BhJ)
  const specRows = html.matchAll(/<tr[^>]+class=["'][^"']*(?:_1s_Smc|W_R1IA)[^"']*["'][^>]*>[\s\S]*?<td[^>]+class=["'][^"']*(?:_1hKmbr|col-3-12)[^"']*["'][^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]+class=["'][^"']*(?:_21lJbe|col-9-12)[^"']*["'][^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi);
  for (const row of specRows) {
    const key = stripHtml(row[1]);
    const value = stripHtml(row[2]);
    if (key && value && !specifications.some((s) => s.key === key)) {
      specifications.push({ key, value });
    }
  }

  // Infer Brand if not set
  if (!brand && rawTitle) {
    const firstWord = rawTitle.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 2 && /^[A-Za-z0-9]+$/.test(firstWord)) {
      brand = firstWord;
    }
  }

  if (price !== undefined && availability === 'unknown') {
    availability = 'in_stock';
  }

  return {
    url: originalUrl,
    canonicalUrl: merchantInfo.canonicalUrl,
    merchantType: 'flipkart',
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

