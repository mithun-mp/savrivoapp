import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.union([z.string().max(500), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  icon: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  image: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  seoTitle: z.union([z.string().max(70), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  seoDescription: z.union([z.string().max(160), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  displayOrder: z.coerce.number().int().optional().default(0),
  active: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();