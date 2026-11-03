import { z } from 'zod';

export const createMerchantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  websiteUrl: z.string().url(),
  logoUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  affiliateProgramName: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  enabled: z.boolean().optional().default(true),
});

export const updateMerchantSchema = createMerchantSchema.partial();