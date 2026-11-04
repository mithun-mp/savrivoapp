import { API_BASE } from './api';
import type { Product } from '../types';
import { isRealProduct } from './showcase-selection';

/**
 * ============================================================================
 * OPERATOR PROCEDURE: CONTROLLED PRODUCT SNAPSHOT
 * ============================================================================
 * This controlled snapshot guarantees that static site generation (SSG) in Astro
 * always produces deterministic static product routes (/product/[slug]) even when
 * the backend API on Render is cold-starting, rate-limited, or unavailable during builds.
 * Contains genuine, verified product records ONLY (zero dummy/sample content).
 * ============================================================================
 */
export const CONTROLLED_PRODUCT_SNAPSHOT: Product[] = [
  {
    _id: '6aea329ad9ab2abb5fb5edda',
    title: 'Blaupunkt BH61 Moksha True Active Noise Cancellation Wireless Headphones',
    slug: 'blaupunkt-bh61-moksha-true-active-noise-cancellation-wireless-headphones',
    shortDescription:
      'Experience immersive audio and superior comfort with the Blaupunkt BH61 Moksha wireless headphones, featuring true active noise cancellation.',
    fullDescription:
      'The Blaupunkt BH61 Moksha wireless headphones combine sophisticated German-inspired design with advanced acoustic engineering to deliver an exceptional listening experience. Designed for audiophiles and professionals on the go, these headphones feature True Active Noise Cancellation to isolate you from external distractions, allowing you to focus entirely on your music or calls.\n\nEquipped with a finely tuned audio driver system, the BH61 Moksha produces high-definition sound with a perfect balance of deep bass, clear mids, and crisp highs. The integrated high-sensitivity microphone ensures crystal-clear voice transmission for all your calls and virtual meetings. With an ergonomic build tailored for extended wear, these headphones are the ideal companion for daily commutes, travel, and long work sessions.',
    brand: 'Blaupunkt',
    categoryId: '6ae9f9cc02bf6219500af7b1', // Electronics
    subcategory: 'Audio',
    sourcePlatform: 'amazon',
    canonicalUrl: 'https://link.amazon/B08sWmK9f',
    images: [
      {
        url: 'https://m.media-amazon.com/images/I/61LzQ2gGyDL._SL1500_.jpg',
        alt: 'Blaupunkt BH61 Moksha True Active Noise Cancellation Wireless Headphones',
      },
    ],
    specifications: [
      { key: 'Brand', value: 'Blaupunkt' },
      { key: 'Model', value: 'BH61 Moksha' },
      { key: 'Audio Feature', value: 'True Active Noise Cancellation (ANC)' },
      { key: 'Microphone', value: 'High Sensitivity Mic' },
      { key: 'Design Style', value: 'German Style Ergonomics' },
    ],
    highlights: [
      'True Active Noise Cancellation effectively blocks external ambient noise',
      'High-definition sound profile delivering perfectly balanced audio tones',
      'High-sensitivity built-in microphone for clear, uninterrupted calls',
      'Sleek German-inspired styling for a sophisticated, premium look',
      'Ergonomically designed for long usage comfort during extended listening sessions',
    ],
    tags: ['Audio', 'Headphones', 'Wireless', 'ANC', 'Blaupunkt'],
    featured: true,
    status: 'published',
    seoTitle: 'Blaupunkt BH61 Moksha ANC Wireless Headphones | SAVRIVO',
    seoDescription:
      'Discover Blaupunkt BH61 Moksha wireless headphones with True Active Noise Cancellation, HD sound, and ergonomic German-inspired design. Shop now on SAVRIVO.',
    offers: [
      {
        _id: '6aea329ad9ab2abb5fb5ede5',
        productId: '6aea329ad9ab2abb5fb5edda',
        merchantId: {
          _id: '6aea329ad9ab2abb5fb5ede3',
          name: 'Link',
          slug: 'link',
          websiteUrl: 'https://link.amazon',
          enabled: true,
        },
        productUrl: 'https://link.amazon/B08sWmK9f',
        affiliateUrl: 'https://link.amazon/B08sWmK9f',
        currency: 'INR',
        availability: 'unknown',
        sellerName: 'Link',
        sourceType: 'manual',
        offerLastVerifiedAt: '2026-11-03T19:14:34.874Z',
        status: 'active',
      },
    ],
    createdAt: '2026-11-03T19:14:34.555Z',
    updatedAt: '2026-11-04T19:19:52.942Z',
  },
];

/**
 * Returns the list of products for static path generation.
 * Queries live API first with a bounded 5000ms timeout, then merges with the controlled snapshot.
 * Filters out any demo or unverified records.
 */
export async function getBuildProducts(): Promise<Product[]> {
  const mergedMap = new Map<string, Product>();

  // 1. Seed with snapshot products (genuine only)
  for (const p of CONTROLLED_PRODUCT_SNAPSHOT) {
    if (isRealProduct(p)) {
      mergedMap.set(p.slug, p);
    }
  }

  // 2. Attempt to fetch live products from backend
  try {
    const res = await fetch(`${API_BASE}/products?limit=100&status=published`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Product[] };
      const liveProducts = json.data || [];
      for (const lp of liveProducts) {
        if (lp.slug && isRealProduct(lp)) {
          mergedMap.set(lp.slug, lp);
        }
      }
    }
  } catch (err) {
    console.warn(
      '[BuildProducts] Live API unavailable during SSG build, using controlled snapshot:',
      (err as Error).message
    );
  }

  return Array.from(mergedMap.values());
}
