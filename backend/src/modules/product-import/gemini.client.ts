import { slugify } from '../../utils/slugify';
import type { ExtractedProductData, EnrichedProductData } from './product-import.types';
import { GeminiRotationService, defaultRotationService } from './gemini-rotation.service';
import { GeminiKeyManager, defaultKeyManager } from './gemini-key-manager';

export interface CategoryContext {
  name: string;
  slug: string;
}

const PRODUCT_SCHEMA_PROPERTIES = {
  title: { type: 'STRING' },
  shortDescription: { type: 'STRING' },
  fullDescription: { type: 'STRING' },
  brand: { type: 'STRING' },
  suggestedCategorySlug: { type: 'STRING' },
  subcategory: { type: 'STRING' },
  highlights: {
    type: 'ARRAY',
    items: { type: 'STRING' },
  },
  specifications: {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        key: { type: 'STRING' },
        value: { type: 'STRING' },
      },
      required: ['key', 'value'],
    },
  },
  searchKeywords: {
    type: 'ARRAY',
    items: { type: 'STRING' },
  },
  tags: {
    type: 'ARRAY',
    items: { type: 'STRING' },
  },
  seoTitle: { type: 'STRING' },
  seoDescription: { type: 'STRING' },
};

const PRODUCT_SCHEMA_REQUIRED = [
  'title',
  'shortDescription',
  'fullDescription',
  'highlights',
  'searchKeywords',
  'tags',
  'seoTitle',
  'seoDescription',
];

export class GeminiClient {
  private rotationService: GeminiRotationService;
  private keyManager: GeminiKeyManager;

  constructor(
    rotationService: GeminiRotationService = defaultRotationService,
    keyManager: GeminiKeyManager = defaultKeyManager
  ) {
    this.rotationService = rotationService;
    this.keyManager = keyManager;
  }

  /**
   * Generates enriched product metadata using Gemini with model-first, API-key-second failover.
   */
  public async enrichProduct(
    extracted: ExtractedProductData,
    categories: CategoryContext[]
  ): Promise<{ enriched: EnrichedProductData; warning?: string }> {
    // If no keys configured, use heuristic rule-based enrichment
    if (!this.keyManager.hasConfiguredKeys()) {
      return {
        enriched: this.heuristicEnrichment(extracted, categories),
        warning: 'Gemini API keys are not configured. Content was enriched using heuristic fallback.',
      };
    }

    const categoryListStr = categories.map((c) => `"${c.slug}" (${c.name})`).join(', ');

    const prompt = `You are the lead product catalog editor for SAVRIVO, an Electric Luxury affiliate discovery platform in India.
Your mission is to transform raw, noisy e-commerce product extraction into premium, high-converting, editorially polished catalog content.

### INSTRUCTIONS:
1. TITLE: Clean all SEO spam, duplicate keywords, merchant junk, and promotional tags. Produce a clean, authoritative product title (e.g., "Apple iPhone 16 Pro Max 256GB - Desert Titanium").
2. BRAND: Extract or verify the canonical brand name.
3. DESCRIPTIONS:
   - shortDescription: A punchy 1-2 sentence hook highlighting the core value proposition.
   - fullDescription: A compelling 2-3 paragraph overview formatted in clean markdown, covering design, key capabilities, and target buyer.
4. CATEGORY MAPPING:
   - Select the most accurate category from this SAVRIVO category list: [${categoryListStr}].
   - Provide the exact slug in 'suggestedCategorySlug'.
   - Suggest a specific subcategory (e.g., "Smartphones", "Mechanical Keyboards", "Espresso Machines").
5. HIGHLIGHTS: Provide 4-6 bullet highlights showcasing defining features and user benefits.
6. SPECIFICATIONS: Merge, organize, and cleanly format the key technical specifications (e.g. Processor, Display, Battery, Dimensions, Weight). Do NOT invent fake specs.
7. SEARCH & TAGS:
   - searchKeywords: 6-10 high-intent search phrases Indian shoppers would use.
   - tags: 4-6 concise classification tags.
8. SEO:
   - seoTitle: High-CTR page title under 60 characters.
   - seoDescription: Compelling meta description under 155 characters.
9. FACTUAL INTEGRITY: NEVER fabricate unsupported hardware specs, fictitious warranty promises, or altered pricing.

### RAW PRODUCT DATA TO ENRICH:
- Raw Title: ${extracted.rawTitle}
- Extracted Brand: ${extracted.brand || 'Unknown'}
- Merchant: ${extracted.merchantName} (${extracted.merchantType})
- Price: ${extracted.price ? `${extracted.currency} ${extracted.price}` : 'Not detected'}
- Raw Description: ${extracted.rawDescription || 'None'}
- Raw Bullet Points: ${extracted.features.length > 0 ? extracted.features.join(' | ') : 'None'}
- Raw Specifications: ${extracted.specifications.length > 0 ? JSON.stringify(extracted.specifications) : 'None'}`;

    try {
      const { data } = await this.rotationService.executeStructuredGeneration(
        prompt,
        PRODUCT_SCHEMA_PROPERTIES,
        PRODUCT_SCHEMA_REQUIRED
      );

      const finalSlug = slugify(data.title || extracted.rawTitle);

      return {
        enriched: {
          ...data,
          slug: finalSlug,
          specifications: Array.isArray(data.specifications) ? data.specifications : extracted.specifications,
        },
      };
    } catch (err: unknown) {
      // If rotation exhausted all model and key combinations, gracefully fallback to heuristic enrichment
      const fallback = this.heuristicEnrichment(extracted, categories);
      return {
        enriched: fallback,
        warning: `Gemini rotation warning: ${(err as Error).message}. Generated using heuristic fallback.`,
      };
    }
  }

  /**
   * Safe heuristic enrichment fallback when Gemini is unavailable or rate-limited.
   */
  public heuristicEnrichment(
    extracted: ExtractedProductData,
    categories: CategoryContext[]
  ): EnrichedProductData {
    let cleanTitle = extracted.rawTitle
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s*\[.*?\]\s*/g, ' ')
      .replace(/\s*\|\s*.*$/g, '')
      .replace(/\s+-\s+.*?(Amazon|Flipkart).*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanTitle || cleanTitle.length < 3) {
      cleanTitle = extracted.rawTitle;
    }

    const brand = extracted.brand || cleanTitle.split(/\s+/)[0] || 'SAVRIVO';
    const slug = slugify(cleanTitle);

    // Pick closest category
    let matchedCategorySlug = categories[0]?.slug || 'electronics';
    const lowerTitle = cleanTitle.toLowerCase();
    for (const cat of categories) {
      if (lowerTitle.includes(cat.name.toLowerCase()) || lowerTitle.includes(cat.slug)) {
        matchedCategorySlug = cat.slug;
        break;
      }
    }

    const highlights =
      extracted.features.length > 0
        ? extracted.features.slice(0, 5)
        : [
            `Engineered for premium performance and reliable everyday use.`,
            `Genuine authentic product sourced via ${extracted.merchantName}.`,
            `High build quality with verified specifications.`,
          ];

    const shortDescription =
      extracted.rawDescription && extracted.rawDescription.length > 20
        ? extracted.rawDescription.slice(0, 180) + '...'
        : `Discover the ${cleanTitle} by ${brand}, offering precision engineering and premium value on SAVRIVO.`;

    const fullDescription =
      extracted.rawDescription && extracted.rawDescription.length > 50
        ? extracted.rawDescription
        : `### Overview\n\nThe **${cleanTitle}** brings together premium craftsmanship, robust performance, and everyday dependability.\n\n### Key Highlights\n\n${highlights.map((h) => `- ${h}`).join('\n')}\n\nAvailable with verified pricing and real-time merchant deals on SAVRIVO.`;

    const searchKeywords = [
      cleanTitle.toLowerCase(),
      brand.toLowerCase(),
      `${brand.toLowerCase()} ${matchedCategorySlug}`,
      'buy online india',
      'best price',
    ];

    const tags = [brand.toLowerCase(), matchedCategorySlug, 'featured'];

    const seoTitle = `${cleanTitle.slice(0, 50)} | Best Deals | SAVRIVO`;
    const seoDescription = `Compare prices and deals for ${cleanTitle} by ${brand}. Verified offers on SAVRIVO.`.slice(
      0,
      155
    );

    return {
      title: cleanTitle,
      slug,
      brand,
      shortDescription,
      fullDescription,
      suggestedCategorySlug: matchedCategorySlug,
      subcategory: undefined,
      highlights,
      specifications: extracted.specifications,
      searchKeywords,
      tags,
      seoTitle,
      seoDescription,
    };
  }
}

export const defaultGeminiClient = new GeminiClient();
