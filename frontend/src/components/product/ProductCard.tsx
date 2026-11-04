import React, { useState } from 'react';
import type { Product, Category } from '@/types';
import { ArrowRight } from 'lucide-react';
import { url } from '@/lib/paths';

interface ProductCardProps {
  product: Product;
  className?: string;
}

function getCategoryName(cat: Product['categoryId']): string {
  if (!cat) return '';
  if (typeof cat === 'string') return '';
  return (cat as Category).name;
}

export default function ProductCard({ product, className = '' }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const mainImage = product.images?.[0];
  const categoryName = getCategoryName(product.categoryId);

  return (
    <article
      className={`group flex flex-col rounded-2xl overflow-hidden card-hover border transition-all duration-200 ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Product Image & Badges */}
      <a
        href={url(`/product/${product.slug}`)}
        className="block relative overflow-hidden"
        style={{ aspectRatio: '4/3', background: 'var(--color-overlay)' }}
        aria-label={`View ${product.title}`}
      >
        {mainImage && !imgError ? (
          <img
            src={mainImage.url}
            alt={mainImage.alt || product.title}
            className="w-full h-full object-contain p-3.5 img-zoom-target"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true" opacity="0.4">
              <path
                d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33M16 53L11 48C11 48 13 39 21 36L43 28C51 25 53 16 53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
                stroke="var(--color-text-2)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points="32,24 38,32 32,40 26,32" fill="var(--color-text-2)" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-2)' }}>
              SAVRIVO Verified
            </span>
          </div>
        )}

        {/* Category badge */}
        {categoryName && (
          <span
            className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
            }}
          >
            {categoryName}
          </span>
        )}

        {/* Featured / Editor's Pick Badge */}
        {product.featured && (
          <span
            className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
            style={{
              background: 'var(--color-curated-badge)',
              color: 'var(--color-curated-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            Editor's Pick
          </span>
        )}
      </a>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        {product.brand && (
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--color-accent)' }}
          >
            {product.brand}
          </p>
        )}

        <a href={url(`/product/${product.slug}`)} className="group/title">
          <h3
            className="font-display text-base md:text-[17px] font-bold mb-2 line-clamp-2 leading-snug transition-colors group-hover/title:text-[var(--color-accent)]"
            style={{ color: 'var(--color-text-1)' }}
          >
            {product.title}
          </h3>
        </a>

        {product.shortDescription && (
          <p className="text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4 flex-1" style={{ color: 'var(--color-text-2)' }}>
            {product.shortDescription}
          </p>
        )}

        {/* Footer with Price / Action */}
        <div
          className="mt-auto pt-3.5 flex items-center justify-between gap-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <a
            href={url(`/product/${product.slug}`)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--color-accent)' }}
          >
            <span>View Details</span>
            <ArrowRight size={14} aria-hidden="true" />
          </a>

          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-2)' }}>
            Compare Retailers
          </span>
        </div>
      </div>
    </article>
  );
}
