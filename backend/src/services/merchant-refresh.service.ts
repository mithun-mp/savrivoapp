import { Product, type IProduct } from '../models/Product.model';
import { Offer, type IOffer } from '../models/Offer.model';
import { Merchant } from '../models/Merchant.model';
import { defaultAdapterRegistry } from '../adapters/merchant-adapter.registry';
import type { MerchantRefreshResult } from '../adapters/merchant-adapter.interface';

export interface RefreshProductResult {
  success: boolean;
  product: IProduct | null;
  offers: IOffer[];
  refreshedCount: number;
  warnings: string[];
}

export class MerchantRefreshService {
  /**
   * Refreshes a single offer by its ObjectId using the merchant adapter.
   * Respects 24-hour cache limit and preserves existing data on API failure.
   */
  public async refreshOffer(offerId: string): Promise<{ offer: IOffer; refreshResult: MerchantRefreshResult }> {
    const offer = await Offer.findById(offerId).populate('merchantId').populate('productId');
    if (!offer) {
      throw new Error('Offer not found');
    }

    const merchant = offer.merchantId as unknown as { name?: string; slug?: string };
    const merchantType = merchant?.slug || merchant?.name || 'generic';
    const adapter = defaultAdapterRegistry.getAdapter(merchantType);

    // Extract external ID (ASIN for Amazon, or URL)
    const externalId = offer.productUrl;

    const refreshResult = await adapter.refreshProductData(externalId, {
      currentPrice: offer.currentPrice,
      originalPrice: offer.originalPrice,
      offerLastVerifiedAt: offer.offerLastVerifiedAt,
    });

    if (refreshResult.success && refreshResult.offers && refreshResult.offers.length > 0) {
      const liveOffer = refreshResult.offers[0];
      if (typeof liveOffer.currentPrice === 'number') {
        offer.currentPrice = liveOffer.currentPrice;
        offer.priceLastUpdatedAt = new Date();
      }
      if (liveOffer.availability) {
        offer.availability = liveOffer.availability;
      }
      offer.offerLastVerifiedAt = new Date();
      offer.status = 'active';
      await offer.save();
    } else {
      // API call unavailable or failed: preserve existing data
      offer.offerLastVerifiedAt = offer.offerLastVerifiedAt || new Date();
      await offer.save();
    }

    return { offer, refreshResult };
  }

  /**
   * Refreshes all active offers for a given product by slug or ObjectId.
   */
  public async refreshProductOffers(slugOrId: string): Promise<RefreshProductResult> {
    const isId = slugOrId.match(/^[0-9a-fA-F]{24}$/);
    const product = isId
      ? await Product.findById(slugOrId).populate('categoryId')
      : await Product.findOne({ slug: slugOrId, status: 'published' }).populate('categoryId');

    if (!product) {
      return {
        success: false,
        product: null,
        offers: [],
        refreshedCount: 0,
        warnings: ['Product not found'],
      };
    }

    const offers = await Offer.find({ productId: product._id, status: 'active' }).populate('merchantId');
    const warnings: string[] = [];
    let refreshedCount = 0;

    for (const offer of offers) {
      try {
        const { refreshResult } = await this.refreshOffer(String(offer._id));
        if (refreshResult.warning) {
          warnings.push(refreshResult.warning);
        }
        if (refreshResult.success) {
          refreshedCount++;
        }
      } catch (err) {
        warnings.push(`Offer ${offer._id} refresh failed: ${(err as Error).message}`);
      }
    }

    const updatedOffers = await Offer.find({ productId: product._id, status: 'active' })
      .populate('merchantId', 'name slug websiteUrl logoUrl')
      .sort({ currentPrice: 1, createdAt: -1 })
      .lean();

    return {
      success: true,
      product,
      offers: updatedOffers as unknown as IOffer[],
      refreshedCount,
      warnings,
    };
  }
}

export const defaultMerchantRefreshService = new MerchantRefreshService();

