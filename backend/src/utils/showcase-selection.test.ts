import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure selection algorithm matching frontend/src/lib/showcase-selection.ts
interface TestProduct {
  _id: string;
  title: string;
  slug: string;
  featured: boolean;
  status: string;
  createdAt: string;
}

function selectShowcaseProducts(allProducts: TestProduct[], targetCount: number = 6) {
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  const sortedByRecent = [...allProducts]
    .filter((p) => p && p.slug && p.status !== 'archived')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const sortedFeatured = sortedByRecent.filter((p) => Boolean(p.featured));

  const selectedRecent: TestProduct[] = [];
  const selectedEditorsChoice: TestProduct[] = [];
  const usedIds = new Set<string>();

  for (const prod of sortedByRecent) {
    if (selectedRecent.length >= 3) break;
    selectedRecent.push(prod);
    usedIds.add(prod._id);
  }

  for (const prod of sortedFeatured) {
    if (selectedEditorsChoice.length >= 3) break;
    if (!usedIds.has(prod._id)) {
      selectedEditorsChoice.push(prod);
      usedIds.add(prod._id);
    }
  }

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

describe('Homepage Showcase 6-Product Selection', () => {
  it('selects exactly 3 recent and 3 editors choice without overlap', () => {
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: false, status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: false, status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: false, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
      { _id: '4', title: 'P4', slug: 'p4', featured: true,  status: 'published', createdAt: '2026-11-04T07:00:00Z' },
      { _id: '5', title: 'P5', slug: 'p5', featured: true,  status: 'published', createdAt: '2026-11-04T06:00:00Z' },
      { _id: '6', title: 'P6', slug: 'p6', featured: true,  status: 'published', createdAt: '2026-11-04T05:00:00Z' },
      { _id: '7', title: 'P7', slug: 'p7', featured: false, status: 'published', createdAt: '2026-11-04T04:00:00Z' },
    ];

    const result = selectShowcaseProducts(products, 6);
    assert.equal(result.recent.length, 3);
    assert.equal(result.editorsChoice.length, 3);
    assert.equal(result.all.length, 6);

    const ids = result.all.map((p) => p._id);
    assert.deepEqual(ids, ['1', '2', '3', '4', '5', '6']);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 6);
  });

  it('deduplicates when a product is both among the 3 newest AND featured', () => {
    // P1 and P2 are recent AND featured
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: true,  status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: true,  status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: false, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
      { _id: '4', title: 'P4', slug: 'p4', featured: true,  status: 'published', createdAt: '2026-11-04T07:00:00Z' },
      { _id: '5', title: 'P5', slug: 'p5', featured: true,  status: 'published', createdAt: '2026-11-04T06:00:00Z' },
      { _id: '6', title: 'P6', slug: 'p6', featured: true,  status: 'published', createdAt: '2026-11-04T05:00:00Z' },
    ];

    const result = selectShowcaseProducts(products, 6);
    // Recent takes 1, 2, 3
    assert.deepEqual(result.recent.map((p) => p._id), ['1', '2', '3']);
    // Editors Choice skips 1 and 2 (already used) and selects next eligible: 4, 5, 6
    assert.deepEqual(result.editorsChoice.map((p) => p._id), ['4', '5', '6']);
    assert.equal(result.all.length, 6);

    const uniqueIds = new Set(result.all.map((p) => p._id));
    assert.equal(uniqueIds.size, 6);
  });

  it('fills remaining slots with next eligible recent products if fewer than 3 featured products exist', () => {
    // Only 1 featured product
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: false, status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: false, status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: false, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
      { _id: '4', title: 'P4', slug: 'p4', featured: true,  status: 'published', createdAt: '2026-11-04T07:00:00Z' },
      { _id: '5', title: 'P5', slug: 'p5', featured: false, status: 'published', createdAt: '2026-11-04T06:00:00Z' },
      { _id: '6', title: 'P6', slug: 'p6', featured: false, status: 'published', createdAt: '2026-11-04T05:00:00Z' },
    ];

    const result = selectShowcaseProducts(products, 6);
    assert.equal(result.all.length, 6);
    const uniqueIds = new Set(result.all.map((p) => p._id));
    assert.equal(uniqueIds.size, 6);
    assert.deepEqual(result.all.map((p) => p._id), ['1', '2', '3', '4', '5', '6']);
  });
});

