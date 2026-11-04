import type { Product } from '../types';

export interface ShowcaseSelectionResult {
  recent: Product[];
  editorsChoice: Product[];
  all: Product[]; // Dynamic count: up to 3 recent + up to 3 featured, deduplicated
}

/**
 * Validates whether a product record is a genuine, published product and not demo/sample content.
 */
export function isRealProduct(p: any): boolean {
  if (!p || typeof p !== 'object') return false;
  const title = String(p.title || '').trim().toLowerCase();
  const slug = String(p.slug || '').trim().toLowerCase();
  const desc = String(p.shortDescription || '').toLowerCase();
  const brand = String(p.brand || '').trim().toLowerCase();

  // Exclude demo / placeholder titles, slugs, and brands
  if (title.startsWith('demo:') || title.includes('[demo]') || title.includes('demo brand')) return false;
  if (slug.startsWith('demo-') || slug === 'demo' || slug.includes('demo-product')) return false;
  if (desc.startsWith('[demo]') || desc.includes('this is sample data')) return false;
  if (brand === 'demo brand' || brand === 'demo') return false;

  return Boolean(p._id && p.title && p.slug);
}

/**
 * Selects dynamic showcase products for the homepage:
 * - Up to 3 most recently added products (by createdAt timestamp descending).
 * - Up to 3 latest Editor's Choice products (featured: true, by createdAt descending).
 *
 * Rules:
 * - Excludes all sample, demo, or placeholder products.
 * - Deduplicates between both groups.
 * - Dynamic count: does NOT force 6 cards and never duplicates products to pad.
 * - If fewer exist, returns fewer items (e.g. 1, 2, 3).
 * - If 0 exist, returns empty array.
 */
export function selectShowcaseProducts(
  allProducts: Product[]
): ShowcaseSelectionResult {
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  // 1. Filter out non-published, archived, or demo products
  const validProducts = allProducts.filter(
    (p) => p && p.slug && p.status !== 'archived' && isRealProduct(p)
  );

  if (validProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  // 2. Sort published products by createdAt descending (newest first)
  const sortedByRecent = [...validProducts].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  // 3. Take up to 3 most recently added products
  const selectedRecent: Product[] = [];
  const usedIds = new Set<string>();

  for (const prod of sortedByRecent) {
    if (selectedRecent.length >= 3) break;
    selectedRecent.push(prod);
    usedIds.add(prod._id);
  }

  // 4. Filter Editor's Choice products (featured: true), newest first
  const sortedFeatured = sortedByRecent.filter((p) => Boolean(p.featured));

  // 5. Select up to 3 latest Editor's Choice products that are not duplicates of the recent products
  const selectedEditorsChoice: Product[] = [];
  for (const prod of sortedFeatured) {
    if (selectedEditorsChoice.length >= 3) break;
    if (!usedIds.has(prod._id)) {
      selectedEditorsChoice.push(prod);
      usedIds.add(prod._id);
    }
  }

  // 6. Merge groups without padding or duplicating to force 6 cards
  const combined = [...selectedRecent, ...selectedEditorsChoice];

  return {
    recent: selectedRecent,
    editorsChoice: selectedEditorsChoice,
    all: combined,
  };
}
