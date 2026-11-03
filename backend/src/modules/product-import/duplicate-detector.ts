import { Product } from '../../models/Product.model';
import { Offer } from '../../models/Offer.model';
import type { DuplicateCheckResult } from './product-import.types';

export class DuplicateDetector {
  /**
   * Checks whether a product already exists in the database.
   */
  public async checkDuplicate(params: {
    canonicalUrl?: string;
    originalUrl?: string;
    skuOrAsin?: string;
    title?: string;
    brand?: string;
  }): Promise<DuplicateCheckResult> {
    const { canonicalUrl, originalUrl, skuOrAsin, title, brand } = params;

    // 1. Check by canonical URL or original URL in Product
    if (canonicalUrl || originalUrl) {
      const urlQuery: Record<string, unknown>[] = [];
      if (canonicalUrl) urlQuery.push({ canonicalUrl });
      if (originalUrl) urlQuery.push({ canonicalUrl: originalUrl });

      const existingProduct = await Product.findOne({ $or: urlQuery }).select('_id title slug').lean();
      if (existingProduct) {
        return {
          isDuplicate: true,
          duplicateProductId: String(existingProduct._id),
          duplicateProductTitle: existingProduct.title,
          duplicateProductSlug: existingProduct.slug,
          matchReason: 'canonical_url',
        };
      }

      // Check by Offer productUrl
      const offerQuery: Record<string, unknown>[] = [];
      if (canonicalUrl) offerQuery.push({ productUrl: canonicalUrl });
      if (originalUrl) offerQuery.push({ productUrl: originalUrl });

      const existingOffer = await Offer.findOne({ $or: offerQuery }).select('productId').lean();
      if (existingOffer && existingOffer.productId) {
        const prod = await Product.findById(existingOffer.productId).select('_id title slug').lean();
        if (prod) {
          return {
            isDuplicate: true,
            duplicateProductId: String(prod._id),
            duplicateProductTitle: prod.title,
            duplicateProductSlug: prod.slug,
            matchReason: 'canonical_url',
          };
        }
      }
    }

    // 2. Check by SKU / ASIN if present in searchKeywords or tags or specifications
    if (skuOrAsin && skuOrAsin.length >= 8) {
      const existingProduct = await Product.findOne({
        $or: [
          { searchKeywords: skuOrAsin.toLowerCase() },
          { tags: skuOrAsin.toLowerCase() },
          { 'specifications.value': skuOrAsin },
        ],
      })
        .select('_id title slug')
        .lean();

      if (existingProduct) {
        return {
          isDuplicate: true,
          duplicateProductId: String(existingProduct._id),
          duplicateProductTitle: existingProduct.title,
          duplicateProductSlug: existingProduct.slug,
          matchReason: 'sku_asin',
        };
      }
    }

    // 3. Check by exact title match (case-insensitive)
    if (title && title.length > 5) {
      const titleRegex = new RegExp(`^${escapeRegex(title.trim())}$`, 'i');
      const query: Record<string, unknown> = { title: titleRegex };
      if (brand) {
        query.brand = new RegExp(`^${escapeRegex(brand.trim())}$`, 'i');
      }

      const existingProduct = await Product.findOne(query).select('_id title slug').lean();
      if (existingProduct) {
        return {
          isDuplicate: true,
          duplicateProductId: String(existingProduct._id),
          duplicateProductTitle: existingProduct.title,
          duplicateProductSlug: existingProduct.slug,
          matchReason: 'title_match',
        };
      }
    }

    return { isDuplicate: false };
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export const defaultDuplicateDetector = new DuplicateDetector();

