import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Product } from '@/types';
import { formatINR } from '@/lib/api';
import { url } from '@/lib/paths';
import { Sparkles, Clock, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

interface CircularProductShowcaseProps {
  products: Product[];
  className?: string;
}

export default function CircularProductShowcase({
  products,
  className = '',
}: CircularProductShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mobileRailRef = useRef<HTMLDivElement | null>(null);

  // Exactly 6 products guaranteed by showcase selection logic
  const items = products.slice(0, 6);
  const activeProduct = items[activeIndex] || items[0];

  // 1. Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // 2. Continuous rotating carousel (advances every 3.5s unless paused or reduced-motion)
  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % (items.length || 1));
  }, [items.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + items.length) % (items.length || 1));
  }, [items.length]);

  useEffect(() => {
    if (isPaused || reducedMotion || items.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 3500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, reducedMotion, items.length, nextSlide]);

  // Sync mobile rail scroll when activeIndex changes
  useEffect(() => {
    if (!mobileRailRef.current) return;
    const activeEl = mobileRailRef.current.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeIndex, reducedMotion]);

  const getProductPrice = (p?: Product): number | null => {
    if (!p) return null;
    if (p.offers && p.offers.length > 0 && p.offers[0].currentPrice) {
      return p.offers[0].currentPrice;
    }
    return null;
  };

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  if (!items || items.length === 0) {
    return null;
  }

  // Circular layout geometry
  const radius = 175; // px from center on desktop

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      role="region"
      aria-label="Featured and Recent Product Showcase"
    >
      {/* ── DESKTOP VIEW: Premium Animated Circular Orbit (lg and above) ── */}
      <div className="hidden lg:flex flex-col items-center justify-center relative w-full h-[520px]">
        {/* Ambient background glow rings */}
        <div
          className="absolute inset-0 m-auto w-[420px] h-[420px] rounded-full pointer-events-none opacity-40 transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-3-glow) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        ></div>
        <div
          className="absolute inset-0 m-auto w-[360px] h-[360px] rounded-full border border-dashed pointer-events-none opacity-30"
          style={{ borderColor: 'var(--color-border)' }}
          aria-hidden="true"
        ></div>

        {/* Orbit Satellite Cards (6 items arranged in circle) */}
        <div className="relative w-[440px] h-[440px] flex items-center justify-center">
          {items.map((prod, idx) => {
            // Calculate fixed position on the circle (60 deg increments)
            const angleDeg = idx * 60 - 90; // -90 places item 0 at top
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.round(Math.cos(angleRad) * radius);
            const y = Math.round(Math.sin(angleRad) * radius);

            const isActive = idx === activeIndex;
            const price = getProductPrice(prod);
            const isEditorChoice = Boolean(prod.featured);
            const hasImgError = imageErrors[prod._id];
            const mainImg = prod.images?.[0]?.url;

            return (
              <div
                key={prod._id}
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${isActive ? 1.15 : 0.95})`,
                  left: '50%',
                  top: '50%',
                  zIndex: isActive ? 20 : 10,
                  transition: reducedMotion
                    ? 'none'
                    : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease, border-color 0.4s ease',
                }}
                className="absolute"
              >
                <button
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1.5 flex items-center justify-center border text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-3)] ${
                    isActive ? 'shadow-xl' : 'shadow-sm opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: isActive ? 'var(--color-accent-3)' : 'var(--color-border)',
                    boxShadow: isActive
                      ? '0 12px 28px -4px var(--color-accent-3-glow), 0 4px 10px -2px rgba(15, 23, 42, 0.1)'
                      : undefined,
                  }}
                  aria-label={`Select ${prod.title}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {/* Badge: Editor's Choice or Recent */}
                  <span
                    className={`absolute -top-2 -right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shadow-sm pointer-events-none transition-transform ${
                      isActive ? 'scale-110' : 'scale-90 opacity-90'
                    }`}
                    style={
                      isEditorChoice
                        ? {
                            background: 'var(--color-accent-3-badge)',
                            color: 'var(--color-accent-3-text)',
                            borderColor: 'var(--color-accent-3)',
                          }
                        : {
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-2)',
                            borderColor: 'var(--color-border)',
                          }
                    }
                  >
                    {isEditorChoice ? 'Choice' : 'New'}
                  </span>

                  {/* Thumbnail Image */}
                  {mainImg && !hasImgError ? (
                    <img
                      src={mainImg}
                      alt={prod.images?.[0]?.alt || prod.title}
                      className="w-full h-full object-contain rounded-xl p-1"
                      loading="lazy"
                      onError={() => handleImageError(prod._id)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[10px] font-bold text-[var(--color-text-2)]">
                      {prod.brand ? prod.brand.slice(0, 3).toUpperCase() : 'PROD'}
                    </div>
                  )}
                </button>
              </div>
            );
          })}

          {/* ── Central Focal Hub Display (Active Product Card) ── */}
          {activeProduct && (
            <div
              className="absolute z-30 w-[240px] p-5 rounded-3xl border flex flex-col items-center text-center transition-all duration-300"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-accent-3)',
                boxShadow:
                  '0 16px 36px -6px var(--color-accent-3-glow), 0 4px 12px rgba(15, 23, 42, 0.08)',
              }}
            >
              {/* Status Pill */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span
                  className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
                  style={
                    activeProduct.featured
                      ? {
                          background: 'var(--color-accent-3-badge)',
                          color: 'var(--color-accent-3-text)',
                          borderColor: 'var(--color-accent-3)',
                        }
                      : {
                          background: 'var(--color-surface-subtle)',
                          color: 'var(--color-text-2)',
                          borderColor: 'var(--color-border)',
                        }
                  }
                >
                  {activeProduct.featured ? "Editor's Choice" : 'Recent Discovery'}
                </span>
              </div>

              {/* Brand */}
              {activeProduct.brand && (
                <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--color-accent-3)' }}>
                  {activeProduct.brand}
                </p>
              )}

              {/* Title */}
              <h3 className="font-display text-sm font-bold leading-tight mb-2 line-clamp-2" style={{ color: 'var(--color-text-1)' }}>
                {activeProduct.title}
              </h3>

              {/* Price when available */}
              {getProductPrice(activeProduct) !== null ? (
                <div className="mb-3">
                  <span className="font-display text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                    {formatINR(getProductPrice(activeProduct)!)}
                  </span>
                </div>
              ) : (
                <div className="mb-3">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                    Verified Partner Offer
                  </span>
                </div>
              )}

              {/* Direct Link to Exact SAVRIVO Product Detail Page */}
              <a
                href={url(`/product/${activeProduct.slug}`)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-transform duration-150 hover:brightness-105 active:scale-95 shadow-sm"
                style={{ background: 'var(--color-accent-3)' }}
              >
                <span>View Details</span>
                <ArrowRight size={13} />
              </a>
            </div>
          )}
        </div>

        {/* Bottom Play/Pause & Step Controls */}
        <div className="flex items-center gap-2 mt-4 z-20">
          <button
            type="button"
            onClick={prevSlide}
            className="p-1.5 rounded-lg border text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:border-[var(--color-accent-3)] transition-colors"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            aria-label="Previous product"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="p-1.5 rounded-lg border text-[var(--color-text-2)] hover:text-[var(--color-text-1)] transition-colors"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            aria-label={isPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="p-1.5 rounded-lg border text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:border-[var(--color-accent-3)] transition-colors"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            aria-label="Next product"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── MOBILE VIEW: Compact Horizontal Carousel (< lg) ── */}
      <div className="block lg:hidden w-full mt-4">
        {/* Section Header with Indicator */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
              style={{
                background: 'var(--color-accent-3-badge)',
                color: 'var(--color-accent-3-text)',
                borderColor: 'var(--color-accent-3)',
              }}
            >
              Trending & Editor's Picks
            </span>
          </div>
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-2)' }}>
            {activeIndex + 1} / {items.length}
          </span>
        </div>

        {/* Horizontal Snap Scroll Rail */}
        <div
          ref={mobileRailRef}
          className="flex gap-3.5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth px-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {items.map((prod, idx) => {
            const isActive = idx === activeIndex;
            const price = getProductPrice(prod);
            const mainImg = prod.images?.[0]?.url;
            const hasImgError = imageErrors[prod._id];

            return (
              <div
                key={prod._id}
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 w-[260px] snap-center rounded-2xl p-4 border transition-all duration-200 ${
                  isActive ? 'shadow-lg' : 'opacity-90'
                }`}
                style={{
                  background: 'var(--color-surface)',
                  borderColor: isActive ? 'var(--color-accent-3)' : 'var(--color-border)',
                  boxShadow: isActive ? '0 10px 24px -4px var(--color-accent-3-glow)' : undefined,
                }}
              >
                {/* Badge & Brand */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border"
                    style={
                      prod.featured
                        ? {
                            background: 'var(--color-accent-3-badge)',
                            color: 'var(--color-accent-3-text)',
                            borderColor: 'var(--color-accent-3)',
                          }
                        : {
                            background: 'var(--color-surface-subtle)',
                            color: 'var(--color-text-2)',
                            borderColor: 'var(--color-border)',
                          }
                    }
                  >
                    {prod.featured ? "Editor's Pick" : 'New Discovery'}
                  </span>
                  {prod.brand && (
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--color-accent-3)' }}>
                      {prod.brand}
                    </span>
                  )}
                </div>

                {/* Product Image */}
                <a
                  href={url(`/product/${prod.slug}`)}
                  className="block relative rounded-xl overflow-hidden mb-3 bg-[var(--color-overlay)]"
                  style={{ aspectRatio: '16/10' }}
                >
                  {mainImg && !hasImgError ? (
                    <img
                      src={mainImg}
                      alt={prod.images?.[0]?.alt || prod.title}
                      className="w-full h-full object-contain p-2"
                      loading="lazy"
                      onError={() => handleImageError(prod._id)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-semibold" style={{ color: 'var(--color-text-2)' }}>
                      SAVRIVO Verified
                    </div>
                  )}
                </a>

                {/* Title */}
                <a href={url(`/product/${prod.slug}`)} className="block mb-2">
                  <h4 className="font-display text-sm font-bold leading-snug line-clamp-2" style={{ color: 'var(--color-text-1)' }}>
                    {prod.title}
                  </h4>
                </a>

                {/* Price & CTA */}
                <div className="mt-auto pt-2 flex items-center justify-between border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {price !== null ? (
                    <span className="font-display text-base font-extrabold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                      {formatINR(price)}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>
                      Verified Partner
                    </span>
                  )}

                  <a
                    href={url(`/product/${prod.slug}`)}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-accent-3)' }}
                  >
                    <span>View</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? 'w-6' : 'w-1.5'
              }`}
              style={{
                background: i === activeIndex ? 'var(--color-accent-3)' : 'var(--color-border)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

