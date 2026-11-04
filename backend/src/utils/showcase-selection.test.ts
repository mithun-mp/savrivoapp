import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface TestProduct {
  _id: string;
  title: string;
  slug: string;
  brand?: string;
  shortDescription?: string;
  featured: boolean;
  status: string;
  createdAt: string;
}

function isRealProduct(p: any): boolean {
  if (!p || typeof p !== 'object') return false;
  const title = String(p.title || '').trim().toLowerCase();
  const slug = String(p.slug || '').trim().toLowerCase();
  const desc = String(p.shortDescription || '').toLowerCase();
  const brand = String(p.brand || '').trim().toLowerCase();

  if (title.startsWith('demo:') || title.includes('[demo]') || title.includes('demo brand')) return false;
  if (slug.startsWith('demo-') || slug === 'demo' || slug.includes('demo-product')) return false;
  if (desc.startsWith('[demo]') || desc.includes('this is sample data')) return false;
  if (brand === 'demo brand' || brand === 'demo') return false;

  // Exclude removed dummy/sample entries
  if (slug === 'apple-iphone-14-128-gb-blue' || slug === 'apple-iphone-14' || slug.includes('apple-iphone-14')) return false;
  if (slug === 'blaupunkt-bh61-moksha-anc-wireless-over-ear-headphones' || slug === 'demo-premium-wireless-headphones') return false;
  if (slug === 'sony-wh-1000xm5-wireless-noise-cancelling-headphones' || slug === 'sony-wh-1000xm5' || slug.includes('sony-wh-1000xm5')) return false;
  if (p._id === '6ae9f9cc02bf6219500af801' || p._id === '6ae9f9cc02bf6219500af802' || p._id === '6ae9f9cc02bf6219500af803') return false;

  return Boolean(p._id && p.title && p.slug);
}

function selectShowcaseProducts(allProducts: TestProduct[]) {
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  const validProducts = allProducts.filter(
    (p) => p && p.slug && p.status !== 'archived' && isRealProduct(p)
  );

  if (validProducts.length === 0) {
    return { recent: [], editorsChoice: [], all: [] };
  }

  const sortedByRecent = [...validProducts].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const selectedRecent: TestProduct[] = [];
  const usedIds = new Set<string>();

  for (const prod of sortedByRecent) {
    if (selectedRecent.length >= 3) break;
    selectedRecent.push(prod);
    usedIds.add(prod._id);
  }

  const sortedFeatured = sortedByRecent.filter((p) => Boolean(p.featured));

  const selectedEditorsChoice: TestProduct[] = [];
  for (const prod of sortedFeatured) {
    if (selectedEditorsChoice.length >= 3) break;
    if (!usedIds.has(prod._id)) {
      selectedEditorsChoice.push(prod);
      usedIds.add(prod._id);
    }
  }

  const combined = [...selectedRecent, ...selectedEditorsChoice];

  return {
    recent: selectedRecent,
    editorsChoice: selectedEditorsChoice,
    all: combined,
  };
}

describe('Homepage Showcase Dynamic Product Selection', () => {
  it('returns empty array when 0 products are available', () => {
    const result = selectShowcaseProducts([]);
    assert.equal(result.all.length, 0);
    assert.equal(result.recent.length, 0);
    assert.equal(result.editorsChoice.length, 0);
  });

  it('filters out all demo products and returns empty if only demo products exist', () => {
    const demoProducts: TestProduct[] = [
      {
        _id: 'd1',
        title: 'DEMO: Premium Wireless Headphones',
        slug: 'demo-premium-wireless-headphones',
        brand: 'DEMO Brand',
        shortDescription: '[DEMO] Sample headphones',
        featured: true,
        status: 'published',
        createdAt: '2026-11-04T10:00:00Z',
      },
      {
        _id: 'd2',
        title: 'DEMO: Smart Air Purifier',
        slug: 'demo-smart-air-purifier',
        brand: 'DEMO Brand',
        shortDescription: 'This is sample data.',
        featured: false,
        status: 'published',
        createdAt: '2026-11-04T09:00:00Z',
      },
    ];

    const result = selectShowcaseProducts(demoProducts);
    assert.equal(result.all.length, 0);
  });

  it('handles dynamic count of 1 product without padding or duplicating', () => {
    const products: TestProduct[] = [
      {
        _id: 'p1',
        title: 'Active Wireless Headphones',
        slug: 'active-wireless-headphones',
        brand: 'AudioPro',
        featured: true,
        status: 'published',
        createdAt: '2026-11-04T10:00:00Z',
      },
    ];

    const result = selectShowcaseProducts(products);
    assert.equal(result.all.length, 1);
    assert.equal(result.recent.length, 1);
    assert.equal(result.editorsChoice.length, 0); // deduplicated because p1 is already in recent
    assert.equal(result.all[0]._id, 'p1');
  });

  it('handles dynamic count of 3 products without forcing 6 cards', () => {
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: true, status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: false, status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: true, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
    ];

    const result = selectShowcaseProducts(products);
    assert.equal(result.all.length, 3);
    assert.deepEqual(result.all.map((p) => p._id), ['1', '2', '3']);
  });

  it('selects 3 recent + 3 editors choice when 6+ products exist without duplicates', () => {
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: false, status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: false, status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: false, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
      { _id: '4', title: 'P4', slug: 'p4', featured: true,  status: 'published', createdAt: '2026-11-04T07:00:00Z' },
      { _id: '5', title: 'P5', slug: 'p5', featured: true,  status: 'published', createdAt: '2026-11-04T06:00:00Z' },
      { _id: '6', title: 'P6', slug: 'p6', featured: true,  status: 'published', createdAt: '2026-11-04T05:00:00Z' },
      { _id: '7', title: 'P7', slug: 'p7', featured: true,  status: 'published', createdAt: '2026-11-04T04:00:00Z' },
    ];

    const result = selectShowcaseProducts(products);
    assert.equal(result.recent.length, 3);
    assert.equal(result.editorsChoice.length, 3);
    assert.equal(result.all.length, 6);
    assert.deepEqual(result.all.map((p) => p._id), ['1', '2', '3', '4', '5', '6']);
  });

  it('deduplicates when recent products are also featured without padding with duplicates', () => {
    const products: TestProduct[] = [
      { _id: '1', title: 'P1', slug: 'p1', featured: true, status: 'published', createdAt: '2026-11-04T10:00:00Z' },
      { _id: '2', title: 'P2', slug: 'p2', featured: true, status: 'published', createdAt: '2026-11-04T09:00:00Z' },
      { _id: '3', title: 'P3', slug: 'p3', featured: true, status: 'published', createdAt: '2026-11-04T08:00:00Z' },
      { _id: '4', title: 'P4', slug: 'p4', featured: true, status: 'published', createdAt: '2026-11-04T07:00:00Z' },
    ];

    const result = selectShowcaseProducts(products);
    // Recent takes 1, 2, 3
    assert.deepEqual(result.recent.map((p) => p._id), ['1', '2', '3']);
    // Featured skips 1, 2, 3 and takes 4
    assert.deepEqual(result.editorsChoice.map((p) => p._id), ['4']);
    // Total is 4 (does NOT pad to 6)
    assert.equal(result.all.length, 4);
    assert.deepEqual(result.all.map((p) => p._id), ['1', '2', '3', '4']);
  });
});
