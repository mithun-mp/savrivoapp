import type { Product } from '../types';

export interface ShowcaseSelectionResult {
  recent: Product[];
  editorsChoice: Product[];
  all: Product[]; // exactly 6 unique items (or as many as available up to 6)
}

/**
 * Selects exactly six unique products for the homepage showcase:
 * - 3 most recently added products (by createdAt timestamp descending).
 * - 3 latest Editor's Choice products (featured: true, by createdAt/updatedAt descending).
 *
 * Rules:
 * - No hardcoded products or random picks.
 * - Deduplicates between both groups.
 * - If a product appears in both groups, selects the next eligible Editor's Choice product.
 * - If fewer than 3 Editor's Choice products are available, fills from next eligible recent products.
 */
export function selectShowcaseProducts(
  allProducts: Product[],
  targetCount: number = 6
): ShowcaseSelectionResult {
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  // 1. Filter published products and sort by createdAt descending (newest first)
  const sortedByRecent = [...allProducts]
    .filter((p) => p && p.slug && p.status !== 'archived')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // 2. Filter Editor's Choice products (featured: true)
  const sortedFeatured = sortedByRecent.filter((p) => Boolean(p.featured));

  const selectedRecent: Product[] = [];
  const selectedEditorsChoice: Product[] = [];
  const usedIds = new Set<string>();

  // 3. Select 3 most recently added products
  for (const prod of sortedByRecent) {
    if (selectedRecent.length >= 3) break;
    selectedRecent.push(prod);
    usedIds.add(prod._id);
  }

  // 4. Select 3 latest Editor's Choice products that are not duplicates of the 3 recent products
  for (const prod of sortedFeatured) {
    if (selectedEditorsChoice.length >= 3) break;
    if (!usedIds.has(prod._id)) {
      selectedEditorsChoice.push(prod);
      usedIds.add(prod._id);
    }
  }

  // 5. If combined count is still under targetCount (e.g. fewer than 3 featured products exist),
  // fill remaining slots from the next eligible recent products to guarantee exactly 6 unique products
  const combined = [...selectedRecent, ...selectedEditorsChoice];
  if (combined.length < targetCount) {
    for (const prod of sortedByRecent) {
      if (combined.length >= targetCount) break;
      if (!usedIds.has(prod._id)) {
        combined.push(prod);
        usedIds.add(prod._id);
      }
    }
  }

  return {
    recent: selectedRecent,
    editorsChoice: selectedEditorsChoice,
    all: combined.slice(0, targetCount),
  };
}

