import { z } from 'zod';

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().default(''),
});

const specSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export const createProductSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  shortDescription: z.string().max(500).optional(),
  fullDescription: z.string().optional(),
  brand: z.string().max(100).optional(),
  categoryId: z.union([z.string(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
  subcategory: z.string().optional(),
  images: z.array(imageSchema).optional().default([]),
  specifications: z.array(specSchema).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  searchKeywords: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  featured: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  canonicalUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().transform(v => v || undefined),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  q: z.string().optional(),
  sort: z.enum(['newest', 'title', 'oldest']).optional(),
});