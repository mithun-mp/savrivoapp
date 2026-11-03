import React, { useState, useEffect, useRef } from 'react';
import type { SearchResults as ISearchResults, Product, Category, Guide } from '@/types';
import { api } from '@/lib/api';
import { Search, Package, Grid, BookOpen, ArrowRight, X, Sparkles, SlidersHorizontal } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { ProductCardSkeleton } from '../ui/Skeleton';
import ProductCard from '../product/ProductCard';
import { url } from '@/lib/paths';

interface SearchResultsProps {
  initialQuery?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type TabType = 'all' | 'products' | 'categories' | 'guides';

const POPULAR_SEARCHES = ['Headphones', 'Smartwatch', 'Mechanical Keyboard', 'Monitor', 'Espresso', 'Desk Setup'];

export default function SearchResults({ initialQuery = '' }: SearchResultsProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ISearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const debouncedQ = useDebounce(query, 250);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setResults(null);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError('');
    api.search
      .query(debouncedQ)
      .then(r => {
        setResults(r.data as ISearchResults);
      })
      .catch(e => {
        if (e.name !== 'AbortError') setError('Search temporarily unavailable. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  const prodCount = results?.products?.length || 0;
  const catCount = results?.categories?.length || 0;
  const guideCount = results?.guides?.length || 0;
  const total = prodCount + catCount + guideCount;

  return (
    <div className="space-y-8">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search
            size={20}
            className="absolute left-4 pointer-events-none transition-colors"
            style={{ color: query ? 'var(--color-accent)' : 'var(--color-text-2)' }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products, brands, guides, categories…"
            aria-label="Search SAVRIVO"
            autoFocus
            className="w-full pl-12 pr-11 py-4 rounded-2xl text-base md:text-lg font-medium outline-none transition-all duration-150 shadow-sv-sm"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-1)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 w-7 h-7 rounded-full flex items-center justify-center hover:opacity-75 transition-opacity"
              style={{ background: 'var(--color-overlay)', color: 'var(--color-text-2)' }}
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Search Chips (when query is empty) */}
      {!query && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-2)' }}>
            <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
            <span>Popular Searches</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map(term => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-full border transition-all duration-150 hover:scale-105 active:scale-95"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Filter Tabs */}
      {query && results && !loading && total > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 border ${
              activeTab === 'all' ? 'text-white' : 'hover:opacity-80'
            }`}
            style={{
              background: activeTab === 'all' ? 'var(--color-accent)' : 'var(--color-surface)',
              borderColor: activeTab === 'all' ? 'var(--color-accent)' : 'var(--color-border)',
              color: activeTab === 'all' ? '#FFFFFF' : 'var(--color-text-2)',
            }}
          >
            All Results ({total})
          </button>

          {prodCount > 0 && (
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 border ${
                activeTab === 'products' ? 'text-white' : 'hover:opacity-80'
              }`}
              style={{
                background: activeTab === 'products' ? 'var(--color-accent)' : 'var(--color-surface)',
                borderColor: activeTab === 'products' ? 'var(--color-accent)' : 'var(--color-border)',
                color: activeTab === 'products' ? '#FFFFFF' : 'var(--color-text-2)',
              }}
            >
              Products ({prodCount})
            </button>
          )}

          {catCount > 0 && (
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 border ${
                activeTab === 'categories' ? 'text-white' : 'hover:opacity-80'
              }`}
              style={{
                background: activeTab === 'categories' ? 'var(--color-accent)' : 'var(--color-surface)',
                borderColor: activeTab === 'categories' ? 'var(--color-accent)' : 'var(--color-border)',
                color: activeTab === 'categories' ? '#FFFFFF' : 'var(--color-text-2)',
              }}
            >
              Categories ({catCount})
            </button>
          )}

          {guideCount > 0 && (
            <button
              onClick={() => setActiveTab('guides')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 border ${
                activeTab === 'guides' ? 'text-white' : 'hover:opacity-80'
              }`}
              style={{
                background: activeTab === 'guides' ? 'var(--color-accent)' : 'var(--color-surface)',
                borderColor: activeTab === 'guides' ? 'var(--color-accent)' : 'var(--color-border)',
                color: activeTab === 'guides' ? '#FFFFFF' : 'var(--color-text-2)',
              }}
            >
              Guides ({guideCount})
            </button>
          )}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && query && results && total === 0 && (
        <EmptyState
          title={`No results found for "${query}"`}
          description="Try checking for typos, using broader keywords, or exploring our curated categories."
          action={
            <a
              href={url('/categories')}
              className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              <span>Explore All Categories</span>
              <ArrowRight size={14} />
            </a>
          }
        />
      )}

      {/* Categories Match Strip */}
      {(activeTab === 'all' || activeTab === 'categories') && catCount > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--color-text-2)' }}>
            <Grid size={14} style={{ color: 'var(--color-accent)' }} /> Categories ({catCount})
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {results!.categories!.map((c: Category) => (
              <a
                key={c._id}
                href={url(`/category/${c.slug}`)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150 hover:scale-105 active:scale-95 shadow-sv-sm"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-1)',
                }}
              >
                <span>{c.name}</span>
                <ArrowRight size={13} style={{ color: 'var(--color-accent)' }} />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Products Results Grid */}
      {(activeTab === 'all' || activeTab === 'products') && prodCount > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--color-text-2)' }}>
              <Package size={14} style={{ color: 'var(--color-accent)' }} /> Products ({prodCount})
            </h2>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>
              Independently Vetted
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results!.products!.map((p: Product) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Buying Guides Matches */}
      {(activeTab === 'all' || activeTab === 'guides') && guideCount > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--color-text-2)' }}>
            <BookOpen size={14} style={{ color: 'var(--color-accent)' }} /> Buying Guides ({guideCount})
          </h2>
          <div className="space-y-3">
            {results!.guides!.map((g: Guide) => (
              <a
                key={g._id}
                href={url(`/guides/${g.slug}`)}
                className="flex items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-150 hover:opacity-90 card-hover"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold truncate mb-1" style={{ color: 'var(--color-text-1)' }}>
                    {g.title}
                  </h3>
                  {g.excerpt && (
                    <p className="text-xs sm:text-sm line-clamp-1" style={{ color: 'var(--color-text-2)' }}>
                      {g.excerpt}
                    </p>
                  )}
                </div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-accent-badge)', color: 'var(--color-accent)' }}
                >
                  <ArrowRight size={16} />
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

