import React, { useState, useEffect, useCallback } from 'react';
import type { Product, Category } from '@/types';
import { api } from '@/lib/api';
import ProductGrid from '../product/ProductGrid';
import Pagination from '../ui/Pagination';
import { Filter, X, SlidersHorizontal, Search, ArrowUpDown, Sparkles } from 'lucide-react';

interface ProductsBrowserProps {
  initialCategories?: Category[];
}

export default function ProductsBrowser({ initialCategories = [] }: ProductsBrowserProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [featured, setFeatured] = useState(false);
  const [sort, setSort] = useState('newest');

  // Parse URL search parameters on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const cat = params.get('category');
      const b = params.get('brand');
      const f = params.get('featured');
      const s = params.get('sort');

      if (q) setSearch(q);
      if (cat) setCategory(cat);
      if (b) setBrand(b);
      if (f === 'true' || f === '1') setFeatured(true);
      if (s) setSort(s);
    }
  }, []);

  const fetchProducts = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '12', sort });
      if (category) params.set('category', category);
      if (brand) params.set('brand', brand);
      if (featured) params.set('featured', 'true');
      if (search.trim()) params.set('q', search.trim());

      const res = await api.products.list(params.toString());
      setProducts((res.data as Product[]) || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch {
      setError('Could not load products. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, category, brand, featured, sort, search]);

  useEffect(() => {
    fetchProducts(1);
    setPage(1);
  }, [category, brand, featured, sort, search]);

  useEffect(() => {
    if (page > 1) {
      fetchProducts(page);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 120, behavior: 'smooth' });
      }
    }
  }, [page]);

  const clearFilters = () => {
    setCategory('');
    setBrand('');
    setFeatured(false);
    setSort('newest');
    setSearch('');
  };

  const hasActiveFilters = !!(category || brand || featured || search.trim());
  const activeCategoryObj = initialCategories.find(c => c._id === category || c.slug === category);

  const inputClass =
    'w-full text-sm px-3.5 py-2.5 rounded-xl border outline-none transition-all duration-150 shadow-sv-sm';
  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    color: 'var(--color-text-1)',
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Search Filter */}
      <div>
        <label
          htmlFor="filter-search"
          className="text-xs font-bold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--color-text-2)' }}
        >
          Keyword Search
        </label>
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 pointer-events-none" style={{ color: 'var(--color-text-2)' }} />
          <input
            id="filter-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, spec..."
            className={`${inputClass} pl-10`}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 text-xs p-1 rounded-full hover:opacity-75"
              style={{ color: 'var(--color-text-2)' }}
              aria-label="Clear search keyword"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div>
        <label
          htmlFor="filter-category"
          className="text-xs font-bold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--color-text-2)' }}
        >
          Category
        </label>
        <select
          id="filter-category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className={inputClass}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
        >
          <option value="">All Categories</option>
          {initialCategories.map(c => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Brand Filter */}
      <div>
        <label
          htmlFor="filter-brand"
          className="text-xs font-bold uppercase tracking-wider block mb-2"
          style={{ color: 'var(--color-text-2)' }}
        >
          Brand
        </label>
        <div className="relative flex items-center">
          <input
            id="filter-brand"
            type="text"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="e.g. Blaupunkt, Zebronics, Bose"
            className={inputClass}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          {brand && (
            <button
              onClick={() => setBrand('')}
              className="absolute right-3 text-xs p-1 rounded-full hover:opacity-75"
              style={{ color: 'var(--color-text-2)' }}
              aria-label="Clear brand filter"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Curated / Featured Toggle */}
      <div
        className="p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors"
        style={{ background: 'var(--color-overlay)', borderColor: 'var(--color-border)' }}
        onClick={() => setFeatured(!featured)}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
            Editor's Picks Only
          </span>
        </div>
        <input
          id="filter-featured"
          type="checkbox"
          checked={featured}
          onChange={e => setFeatured(e.target.checked)}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded cursor-pointer accent-[var(--color-accent)]"
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-bold rounded-xl border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-error)',
            background: 'var(--color-surface)',
          }}
        >
          <X size={14} /> Reset All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
      {/* Desktop Filter Sidebar */}
      <aside
        className="hidden lg:block w-72 shrink-0 sticky top-28 self-start p-6 rounded-2xl border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-1)' }}>
            <Filter size={15} style={{ color: 'var(--color-accent)' }} /> Refine Search
          </h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Reset
            </button>
          )}
        </div>
        <FilterPanel />
      </aside>

      {/* Mobile Sticky Floating Filter Trigger */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-2.5 px-5 py-3.5 rounded-full text-sm font-bold text-white shadow-sv-lg transition-transform active:scale-95 min-h-[48px]"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, #D8420A 100%)',
          }}
          aria-label="Open filter drawer"
        >
          <SlidersHorizontal size={17} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[var(--color-accent)] animate-pulse" />
          )}
        </button>
      </div>

      {/* Mobile Slide-Up Drawer */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setFilterOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 p-6 rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl transition-transform"
            style={{
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} style={{ color: 'var(--color-accent)' }} />
                <h2 className="text-base font-bold font-display" style={{ color: 'var(--color-text-1)' }}>
                  Filter Products
                </h2>
              </div>
              <button
                onClick={() => setFilterOpen(false)}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-colors hover:opacity-75"
                style={{ background: 'var(--color-overlay)', color: 'var(--color-text-1)' }}
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>

            <FilterPanel />

            <div className="mt-8 flex gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold border transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-2)',
                    background: 'var(--color-overlay)',
                  }}
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setFilterOpen(false)}
                className="flex-[2] py-3.5 rounded-xl text-sm font-bold text-white shadow-sv-sm transition-opacity hover:opacity-95"
                style={{ background: 'var(--color-accent)' }}
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Content Area */}
      <div className="flex-1 min-w-0 pb-16 lg:pb-0">
        {/* Results Meta & Sort Bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-7 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>
              Showing{' '}
              <span className="font-bold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                {loading ? '...' : products.length}
              </span>{' '}
              {products.length === 1 ? 'product' : 'curated products'}
              {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="products-sort"
              className="text-xs font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1.5"
              style={{ color: 'var(--color-text-2)' }}
            >
              <ArrowUpDown size={13} /> Sort:
            </label>
            <select
              id="products-sort"
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-sm font-semibold px-3.5 py-2 rounded-xl border outline-none cursor-pointer transition-colors shadow-sv-sm"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-1)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            >
              <option value="newest">Newest Additions</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Alphabetical (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips Strip */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--color-text-2)' }}>
              Active Filters:
            </span>

            {search.trim() && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                <span>Keyword: "{search}"</span>
                <button onClick={() => setSearch('')} className="hover:opacity-70" aria-label="Remove search filter">
                  <X size={12} />
                </button>
              </span>
            )}

            {category && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                <span>Category: {activeCategoryObj?.name || category}</span>
                <button onClick={() => setCategory('')} className="hover:opacity-70" aria-label="Remove category filter">
                  <X size={12} />
                </button>
              </span>
            )}

            {brand && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                <span>Brand: {brand}</span>
                <button onClick={() => setBrand('')} className="hover:opacity-70" aria-label="Remove brand filter">
                  <X size={12} />
                </button>
              </span>
            )}

            {featured && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: 'var(--color-curated-badge)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-curated-text)',
                }}
              >
                <span>Editor's Picks</span>
                <button onClick={() => setFeatured(false)} className="hover:opacity-70" aria-label="Remove curated filter">
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={clearFilters}
              className="text-xs font-bold underline underline-offset-4 ml-1 hover:opacity-80"
              style={{ color: 'var(--color-accent)' }}
            >
              Reset all
            </button>
          </div>
        )}

        {/* Product Grid */}
        <ProductGrid
          products={products}
          loading={loading}
          error={error}
          skeletonCount={12}
          emptyTitle="No matching products found"
          emptyDescription="We couldn't find any products matching your active filters. Try clearing some filters or searching for another term."
        />

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-14 flex justify-center">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

