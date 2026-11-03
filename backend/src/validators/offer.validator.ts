import { z } from 'zod';

export const createOfferSchema = z.object({
  productId: z.string().min(1),
  merchantId: z.string().min(1),
  productUrl: z.string().url(),
  affiliateUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform((v, ctx) => {
    // If affiliateUrl is empty or not provided, we can allow it to be undefined or handled
    return v || undefined;
  }),
  currentPrice: z.coerce.number().positive().optional(),
  originalPrice: z.coerce.number().positive().optional(),
  currency: z.string().default('INR'),
  availability: z.enum(['in_stock', 'out_of_stock', 'unknown']).optional().default('unknown'),
  sellerName: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  sourceType: z.enum(['manual', 'official_api', 'authorized_feed']).optional().default('manual'),
  offerLastVerifiedAt: z.union([z.string().datetime(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  status: z.enum(['active', 'expired', 'disabled']).optional().default('active'),
  trackingLabel: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
});

export const updateOfferSchema = createOfferSchema.partial();