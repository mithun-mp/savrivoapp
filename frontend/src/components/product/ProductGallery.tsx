import React, { useState } from 'react';
import type { ProductImage } from '@/types';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
}

export default function ProductGallery({ images, title }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  if (!images.length) {
    return (
      <div
        className="w-full rounded-2xl flex flex-col items-center justify-center p-8 transition-colors"
        style={{
          aspectRatio: '1/1',
          background: 'var(--color-overlay)',
          border: '1px solid var(--color-border)',
        }}
      >
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true" opacity="0.35">
          <path
            d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33M16 53L11 48C11 48 13 39 21 36L43 28C51 25 53 16 53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
            stroke="var(--color-text-2)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points="32,24 38,32 32,40 26,32" fill="var(--color-text-2)" />
        </svg>
        <span className="text-xs font-medium mt-3" style={{ color: 'var(--color-text-2)' }}>
          Image coming soon
        </span>
      </div>
    );
  }

  const img = images[active];

  return (
    <div className="flex flex-col gap-3.5">
      {/* Main product photo frame */}
      <div
        className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center transition-colors group"
        style={{
          aspectRatio: '1/1',
          background: 'var(--color-overlay)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {img && !imgErrors[active] ? (
          <img
            key={active}
            src={img.url}
            alt={img.alt || `${title} — image ${active + 1}`}
            className="w-full h-full object-contain p-6 sm:p-8 img-zoom-target reveal-fade-up"
            loading={active === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setImgErrors((prev) => ({ ...prev, [active]: true }))}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6" style={{ color: 'var(--color-text-2)' }}>
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true" opacity="0.3">
              <path
                d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33M16 53L11 48C11 48 13 39 21 36L43 28C51 25 53 16 53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
                stroke="var(--color-text-2)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points="32,24 38,32 32,40 26,32" fill="var(--color-text-2)" />
            </svg>
            <span className="text-xs font-medium">Image unavailable</span>
          </div>
        )}

        {/* Image Counter Badge */}
        {images.length > 1 && (
          <div
            className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums backdrop-blur-md shadow-sm select-none"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-1)',
              border: '1px solid var(--color-border)',
              opacity: 0.9,
            }}
          >
            {active + 1} / {images.length}
          </div>
        )}

        {/* Prev / Next controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((i) => Math.max(0, i - 1))}
              disabled={active === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150 hover:scale-105 active:scale-95 shadow-sv-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)',
              }}
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setActive((i) => Math.min(images.length - 1, i + 1))}
              disabled={active === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150 hover:scale-105 active:scale-95 shadow-sv-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)',
              }}
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {images.map((thumb, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-150 hover:opacity-95 p-1 relative flex items-center justify-center"
              style={{
                border: i === active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: 'var(--color-overlay)',
                boxShadow: i === active ? '0 0 0 1px var(--color-accent)' : 'none',
              }}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-pressed={i === active}
            >
              {!imgErrors[i] ? (
                <img
                  src={thumb.url}
                  alt={thumb.alt || `Thumbnail ${i + 1}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
                />
              ) : (
                <ImageIcon size={18} className="opacity-40" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
