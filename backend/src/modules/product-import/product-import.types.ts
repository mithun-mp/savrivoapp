import { z } from 'zod';

export type MerchantType = 'amazon' | 'flipkart' | 'generic';

export interface ExtractedImage {
  url: string;
  alt: string;
}

export interface ExtractedSpecification {
  key: string;
  value: string;
}

export interface ExtractedProductData {
  url: string;
  canonicalUrl: string;
  merchantType: MerchantType;
  merchantName: string;
  rawTitle: string;
  brand?: string;
  rawDescription?: string;
  price?: number;
  originalPrice?: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  images: ExtractedImage[];
  specifications: ExtractedSpecification[];
  features: string[];
  skuOrAsin?: string;
  isAntiBotBlocked?: boolean;
}

export interface EnrichedProductData {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  brand: string;
  suggestedCategorySlug?: string;
  subcategory?: string;
  highlights: string[];
  specifications: ExtractedSpecification[];
  searchKeywords: string[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateProductId?: string;
  duplicateProductTitle?: string;
  duplicateProductSlug?: string;
  matchReason?: 'canonical_url' | 'sku_asin' | 'title_match';
}

export interface KeySlotStatus {
  slot: number;
  configured: boolean;
  healthy: boolean;
  rateLimited: boolean;
  quotaExhausted: boolean;
  cooldownSecondsRemaining: number;
  failureCount: number;
  lastError?: string;
}

export interface ModelSlotStatus {
  model: string;
  isSupported: boolean;
  cooldownSecondsBySlot: Record<number, number>;
}

export interface RotationAttemptStep {
  attemptNumber: number;
  slot: number;
  model: string;
  status:
    | 'success'
    | 'model_rate_limited'
    | 'model_unsupported'
    | 'project_quota_exhausted'
    | 'auth_failed'
    | 'server_error'
    | 'invalid_request'
    | 'network_error';
  message: string;
  durationMs: number;
}

export interface TwoLevelDiagnosticsSummary {
  activeSlot: number | null;
  currentModel: string | null;
  lastSuccessfulSlot: number | null;
  lastSuccessfulModel: string | null;
  totalConfiguredKeys: number;
  totalHealthyKeys: number;
  modelPriorityOrder: string[];
  keySlots: KeySlotStatus[];
  modelStatuses: ModelSlotStatus[];
  lastAttemptBreadcrumb: string;
  attemptHistory: RotationAttemptStep[];
}

export interface ImportPreviewResult {
  url: string;
  success: boolean;
  confidenceScore: number;
  factual: ExtractedProductData;
  enriched: EnrichedProductData;
  warnings: string[];
  duplicateCheck: DuplicateCheckResult;
  diagnostics: TwoLevelDiagnosticsSummary;
}

// Zod Schemas for API validation
export const previewUrlSchema = z.object({
  url: z.string().url('A valid product URL is required (http/https)'),
});

export const bulkPreviewUrlsSchema = z.object({
  urls: z
    .array(z.string().url('Each item must be a valid URL'))
    .min(1, 'At least 1 URL is required')
    .max(10, 'Maximum 10 URLs allowed per batch'),
});

export const saveDraftProductSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z.string().min(3, 'Slug is required'),
  brand: z.string().optional().default(''),
  shortDescription: z.string().optional().default(''),
  fullDescription: z.string().optional().default(''),
  categoryId: z.string().optional().nullable(),
  subcategory: z.string().optional().default(''),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().optional().default(''),
      })
    )
    .min(1, 'At least one product image is required'),
  specifications: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
  highlights: z.array(z.string()).optional().default([]),
  searchKeywords: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  seoTitle: z.string().optional().default(''),
  seoDescription: z.string().optional().default(''),
  canonicalUrl: z.string().url().optional(),
  featured: z.boolean().optional().default(false),
  // Associated offer details
  offer: z
    .object({
      merchantId: z.string().optional().nullable(),
      productUrl: z.string().url(),
      affiliateUrl: z.string().url().optional(),
      currentPrice: z.number().positive().optional().nullable(),
      originalPrice: z.number().positive().optional().nullable(),
      currency: z.string().default('INR'),
      availability: z.enum(['in_stock', 'out_of_stock', 'unknown']).default('unknown'),
    })
    .optional(),
});

export const publishProductSchema = saveDraftProductSchema;
