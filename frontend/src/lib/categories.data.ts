import { API_BASE } from './api';
import type { Category } from '../types';

/**
 * ============================================================================
 * OPERATOR PROCEDURE: UPDATING THE CONTROLLED CATEGORY SNAPSHOT
 * ============================================================================
 * 1. Purpose:
 *    This controlled snapshot ensures static site generation (SSG) in Astro remains
 *    100% resilient against Render API cold-starts, network partitions, and database
 *    unavailability during CI/CD builds. It guarantees that all 7 core categories
 *    always produce deterministic static routes (/category/[slug]) without silent drops.
 *
 * 2. Distinction: Build Determinism vs. Live API Unavailability Resiliency:
 *    - Querying the live API directly causes build outputs to vary whenever records
 *      are added, deleted, or updated in MongoDB Atlas (non-deterministic across time).
 *    - The snapshot guarantees reproducibility across build environments and shields
 *      the build against API timeouts.
 *
 * 3. Step-by-Step Operator Update Procedure:
 *    Whenever categories are added, renamed, or reordered in the admin dashboard or seed.ts:
 *      a. Run a live query:
 *         curl -s https://savrivo-api.onrender.com/api/categories | jq .data
 *      b. Verify that all categories have active: true, valid slugs, and correct displayOrder.
 *      c. Update the CONTROLLED_CATEGORY_SNAPSHOT array below with the new records.
 *      d. Verify static build route generation:
 *         cd frontend && npm run build
 * ============================================================================
 */
export const CONTROLLED_CATEGORY_SNAPSHOT: Category[] = [
  {
    _id: '6ae9f9cc02bf6219500af7b1',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Explore the latest laptops, smartphones, headphones, and smart home accessories.',
    icon: 'laptop',
    displayOrder: 1,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b2',
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Appliances, cookware, and home essentials curated for modern living.',
    icon: 'home',
    displayOrder: 2,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b3',
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Skincare, grooming, and wellness products for daily routines.',
    icon: 'sparkles',
    displayOrder: 3,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b4',
    name: 'Books',
    slug: 'books',
    description: 'Fiction, non-fiction, self-growth, and academic bestsellers.',
    icon: 'book-open',
    displayOrder: 4,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b5',
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    description: 'Gym equipment, sportswear, outdoor gear, and fitness trackers.',
    icon: 'dumbbell',
    displayOrder: 5,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b6',
    name: 'Clothing & Accessories',
    slug: 'clothing-accessories',
    description: 'Contemporary apparel, timepieces, eyewear, and everyday fashion.',
    icon: 'shopping-bag',
    displayOrder: 6,
    active: true,
  },
  {
    _id: '6ae9f9cc02bf6219500af7b7',
    name: 'Toys & Games',
    slug: 'toys-games',
    description: 'Educational toys, puzzles, tabletop games, and family entertainment.',
    icon: 'gamepad-2',
    displayOrder: 7,
    active: true,
  },
];

/**
 * Retrieves categories for static route generation and category directories.
 * Attempts to query the live API with a bounded 4-second timeout.
 * If unreachable, timed out, or empty, seamlessly utilizes the controlled snapshot
 * and logs a visible build notice so operators know the fallback was engaged.
 */
export async function getBuildCategories(): Promise<{ categories: Category[]; isFallback: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/categories`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      const liveCategories: Category[] = (json.data as Category[] || []).filter((c) => c.active !== false);
      if (liveCategories.length > 0) {
        console.log(
          `[SAVRIVO Build] Successfully retrieved ${liveCategories.length} live categories from ${API_BASE}/categories.`
        );
        return { categories: liveCategories, isFallback: false };
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[SAVRIVO Build Notice] Live API categories unavailable at ${API_BASE}/categories (${errorMsg}). ` +
      `Utilizing controlled category snapshot (${CONTROLLED_CATEGORY_SNAPSHOT.length} categories) for deterministic static route generation.`
    );
  }

  console.warn(
    `[SAVRIVO Build Notice] Live API returned empty or inactive category list. ` +
    `Utilizing controlled category snapshot (${CONTROLLED_CATEGORY_SNAPSHOT.length} categories) for deterministic static route generation.`
  );
  return { categories: CONTROLLED_CATEGORY_SNAPSHOT, isFallback: true };
}
