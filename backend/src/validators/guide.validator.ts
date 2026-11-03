import { z } from 'zod';

export const createGuideSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.union([z.string().max(500), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  body: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  coverImage: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  author: z.union([z.string(), z.literal(''), z.null()]).optional().default('Savrivo Editorial'),
  category: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  relatedProducts: z.array(z.string()).optional().default([]),
  seoTitle: z.union([z.string().max(70), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  seoDescription: z.union([z.string().max(160), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  publishedAt: z.union([z.string().datetime(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
});

export const updateGuideSchema = createGuideSchema.partial();