import { Category } from '../../models/Category.model';
import { Product } from '../../models/Product.model';
import { Merchant } from '../../models/Merchant.model';
import { Offer } from '../../models/Offer.model';
import { slugify } from '../../utils/slugify';
import { safeFetchHtml, validateUrlSsrf } from './ssrf-guard';
import { detectMerchant } from './merchant-detector';
import { extractAmazonProduct } from './extractors/amazon.extractor';
import { extractFlipkartProduct } from './extractors/flipkart.extractor';
import { extractGenericProduct } from './extractors/generic.extractor';
import { GeminiKeyManager, defaultKeyManager } from './gemini-key-manager';
import { GeminiModelManager, defaultModelManager } from './gemini-model-manager';
import { GeminiRotationService, defaultRotationService } from './gemini-rotation.service';
import { GeminiClient, defaultGeminiClient, type CategoryContext } from './gemini.client';
import { DuplicateDetector, defaultDuplicateDetector } from './duplicate-detector';
import { sanitizeProductImages } from './image-validator';
import { defaultAdapterRegistry } from '../../adapters/merchant-adapter.registry';
import type { AmazonAdapter } from '../../adapters/amazon.adapter';
import type {
  ExtractedProductData,
  ImportPreviewResult,
  TwoLevelDiagnosticsSummary,
} from './product-import.types';
import type { z } from 'zod';
import type { saveDraftProductSchema } from './product-import.types';

export class ProductImportService {
  private keyManager: GeminiKeyManager;
  private modelManager: GeminiModelManager;
  private rotationService: GeminiRotationService;
  private geminiClient: GeminiClient;
  private duplicateDetector: DuplicateDetector;

  constructor(
    keyManager = defaultKeyManager,
    modelManager = defaultModelManager,
    rotationService = defaultRotationService,
    geminiClient = defaultGeminiClient,
    duplicateDetector = defaultDuplicateDetector
  ) {
    this.keyManager = keyManager;
    this.modelManager = modelManager;
    this.rotationService = rotationService;
    this.geminiClient = geminiClient;
    this.duplicateDetector = duplicateDetector;
  }

  /**
   * Previews a product URL: executes SSRF validation, fetches HTML,
   * extracts factual specs, runs Gemini enrichment, checks duplicates, and calculates confidence.
   */
  public async previewProduct(inputUrl: string): Promise<ImportPreviewResult> {
    // 1. Validate URL & SSRF
    await validateUrlSsrf(inputUrl);

    // 2. Detect merchant & canonical URL
    const merchantInfo = detectMerchant(inputUrl);

    // 3. Safe fetch HTML
    const fetchResult = await safeFetchHtml(inputUrl);

    // 4. Extract factual product data
    let extracted: ExtractedProductData;
    if (merchantInfo.merchantType === 'amazon') {
      extracted = extractAmazonProduct(fetchResult.html, merchantInfo, inputUrl);

      // Check official Amazon Creators API if configured
      const amazonAdapter = defaultAdapterRegistry.getAdapter('amazon') as AmazonAdapter;
      if (amazonAdapter && amazonAdapter.isApiConfigured() && merchantInfo.skuOrAsin) {
        try {
          const officialDetails = await amazonAdapter.fetchProductDetails(merchantInfo.skuOrAsin);
          if (officialDetails?.images && officialDetails.images.length > 0) {
            extracted.images = officialDetails.images.map((img) => ({
              url: img.url,
              alt: img.alt || extracted.rawTitle,
            }));
          }
        } catch {
          // Keep extracted DOM images if official API call fails
        }
      }
    } else if (merchantInfo.merchantType === 'flipkart') {
      extracted = extractFlipkartProduct(fetchResult.html, merchantInfo, inputUrl);
    } else {
      extracted = extractGenericProduct(fetchResult.html, merchantInfo, inputUrl);
    }

    // 4b. Sanitize and validate image URLs
    const sanitizedImages = await sanitizeProductImages(extracted.images, extracted.rawTitle);
    extracted.images = sanitizedImages.map((img) => ({ url: img.url, alt: img.alt }));

    // 5. Duplicate Check
    const duplicateCheck = await this.duplicateDetector.checkDuplicate({
      canonicalUrl: extracted.canonicalUrl,
      originalUrl: inputUrl,
      skuOrAsin: extracted.skuOrAsin,
      title: extracted.rawTitle,
      brand: extracted.brand,
    });

    // 6. Fetch existing SAVRIVO categories
    let categoryList: CategoryContext[] = [];
    try {
      const dbCategories = await Category.find({ active: true }).select('name slug').lean();
      categoryList = dbCategories.map((c) => ({ name: c.name, slug: c.slug }));
    } catch {
      // If DB lookup fails (e.g. in test env), use default categories
      categoryList = [
        { name: 'Electronics', slug: 'electronics' },
        { name: 'Audio', slug: 'audio' },
        { name: 'Wearables', slug: 'wearables' },
        { name: 'Computing', slug: 'computing' },
        { name: 'Home & Kitchen', slug: 'home-kitchen' },
      ];
    }

    // 7. Gemini Enrichment
    const enrichmentResult = await this.geminiClient.enrichProduct(extracted, categoryList);
    const enriched = enrichmentResult.enriched;

    // 8. Confidence scoring & warnings
    const warnings: string[] = [];
    let confidenceScore = 0;

    if (extracted.isAntiBotBlocked) {
      warnings.push(
        'Anti-bot challenge triggered by merchant. Factual data may be incomplete; please review carefully.'
      );
      confidenceScore = 15;
    } else {
      if (extracted.rawTitle && extracted.rawTitle !== 'Untitled Product') confidenceScore += 25;
      if (extracted.images && extracted.images.length > 0) confidenceScore += 20;
      else {
        if (merchantInfo.merchantType === 'amazon') {
          warnings.push(
            'Amazon merchant images are unavailable. To retrieve official product images, configure Amazon PA-API / Creators API credentials or upload images manually.'
          );
        } else {
          warnings.push('No product images were detected. Please upload an image.');
        }
      }

      if (extracted.price !== undefined && extracted.price > 0) confidenceScore += 20;
      else warnings.push('Product price could not be detected automatically.');

      if (extracted.brand) confidenceScore += 10;
      if (extracted.specifications && extracted.specifications.length > 0) confidenceScore += 10;
      if (extracted.features && extracted.features.length > 0) confidenceScore += 10;
      if (extracted.rawDescription) confidenceScore += 5;
    }

    if (enrichmentResult.warning) {
      warnings.push(enrichmentResult.warning);
    }

    if (duplicateCheck.isDuplicate) {
      warnings.push(
        `Potential duplicate detected: "${duplicateCheck.duplicateProductTitle}" (Reason: ${duplicateCheck.matchReason})`
      );
    }

    const diagnostics = this.rotationService.getDiagnostics();

    return {
      url: inputUrl,
      success: !extracted.isAntiBotBlocked && confidenceScore >= 20,
      confidenceScore: Math.min(100, confidenceScore),
      factual: extracted,
      enriched,
      warnings,
      duplicateCheck,
      diagnostics,
    };
  }

  /**
   * Bulk preview for up to 10 URLs.
   */
  public async bulkPreview(urls: string[]): Promise<ImportPreviewResult[]> {
    const results: ImportPreviewResult[] = [];
    for (const url of urls) {
      try {
        const res = await this.previewProduct(url);
        results.push(res);
      } catch (err) {
        const merchantInfo = detectMerchant(url);
        results.push({
          url,
          success: false,
          confidenceScore: 0,
          factual: {
            url,
            canonicalUrl: merchantInfo.canonicalUrl,
            merchantType: merchantInfo.merchantType,
            merchantName: merchantInfo.merchantName,
            rawTitle: 'Import Failed',
            currency: 'INR',
            availability: 'unknown',
            images: [],
            specifications: [],
            features: [],
          },
          enriched: {
            title: 'Import Failed',
            slug: slugify(url),
            shortDescription: '',
            fullDescription: '',
            brand: '',
            highlights: [],
            specifications: [],
            searchKeywords: [],
            tags: [],
            seoTitle: '',
            seoDescription: '',
          },
          warnings: [(err as Error).message],
          duplicateCheck: { isDuplicate: false },
          diagnostics: this.rotationService.getDiagnostics(),
        });
      }
    }
    return results;
  }

  /**
   * Saves product as draft in MongoDB and creates or links the merchant offer.
   */
  public async saveProduct(
    data: z.infer<typeof saveDraftProductSchema>,
    targetStatus: 'draft' | 'published' = 'draft'
  ): Promise<{ product: unknown; offer?: unknown }> {
    // 1. Resolve Category ID
    let categoryId = data.categoryId;
    if (categoryId && typeof categoryId === 'string' && !categoryId.match(/^[0-9a-fA-F]{24}$/)) {
      // Looks like a slug rather than an ObjectId
      const cat = await Category.findOne({ slug: categoryId }).select('_id');
      if (cat) {
        categoryId = String(cat._id);
      } else {
        categoryId = null;
      }
    }

    // 2. Ensure Unique Slug
    let finalSlug = slugify(data.slug || data.title);
    const existingWithSlug = await Product.findOne({ slug: finalSlug }).select('_id');
    if (existingWithSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    // 3. Sanitize Images
    const sanitized = await sanitizeProductImages(data.images, data.title);
    const finalImages = sanitized.length > 0 ? sanitized.map((img) => ({ url: img.url, alt: img.alt })) : data.images;

    // 4. Create Product Document
    const product = new Product({
      title: data.title,
      slug: finalSlug,
      brand: data.brand || undefined,
      shortDescription: data.shortDescription || undefined,
      fullDescription: data.fullDescription || undefined,
      categoryId: categoryId || undefined,
      subcategory: data.subcategory || undefined,
      images: finalImages,
      specifications: data.specifications,
      highlights: data.highlights,
      searchKeywords: data.searchKeywords,
      tags: data.tags,
      featured: data.featured || false,
      status: targetStatus,
      seoTitle: data.seoTitle || undefined,
      seoDescription: data.seoDescription || undefined,
      canonicalUrl: data.canonicalUrl || undefined,
    });

    await product.save();

    // 5. Create Offer if provided
    let createdOffer: unknown = undefined;
    if (data.offer && data.offer.productUrl) {
      let merchantId = data.offer.merchantId;

      // Auto-detect or resolve merchant if merchantId not supplied
      const detected = detectMerchant(data.offer.productUrl);
      if (!merchantId) {
        let merchant = await Merchant.findOne({
          $or: [
            { name: new RegExp(`^${detected.merchantName}$`, 'i') },
            { websiteUrl: new RegExp(detected.domain, 'i') },
          ],
        });

        if (!merchant) {
          // Auto-register merchant if absent
          merchant = new Merchant({
            name: detected.merchantName,
            slug: slugify(detected.merchantName),
            websiteUrl: `https://${detected.domain || 'amazon.in'}`,
            affiliateProgramName: `${detected.merchantName} Associates`,
            enabled: true,
          });
          await merchant.save();
        }
        merchantId = String(merchant._id);
      }

      if (merchantId) {
        const adapter = defaultAdapterRegistry.getAdapter(detected.merchantName);
        const compliantAffiliateUrl = adapter.generateAffiliateLink(data.offer.productUrl);

        const offer = new Offer({
          productId: product._id,
          merchantId,
          productUrl: data.offer.productUrl,
          affiliateUrl: compliantAffiliateUrl || data.offer.affiliateUrl || data.offer.productUrl,
          currentPrice: data.offer.currentPrice || undefined,
          originalPrice: data.offer.originalPrice || undefined,
          currency: data.offer.currency || 'INR',
          availability: data.offer.availability || 'unknown',
          sourceType: 'manual',
          status: 'active',
          priceLastUpdatedAt: new Date(),
          offerLastVerifiedAt: new Date(),
        });

        await offer.save();
        createdOffer = offer;
      }
    }

    return { product, offer: createdOffer };
  }

  /**
   * Returns current Gemini key and model rotation diagnostics summary.
   */
  public getDiagnostics(): TwoLevelDiagnosticsSummary {
    return this.rotationService.getDiagnostics();
  }
}

export const defaultProductImportService = new ProductImportService();
