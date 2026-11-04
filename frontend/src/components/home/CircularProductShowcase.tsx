import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Product } from '@/types';
import { url } from '@/lib/paths';
import { isRealProduct } from '@/lib/showcase-selection';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface CircularProductShowcaseProps {
  products: Product[];
  className?: string;
}

export default function CircularProductShowcase({
  products,
  className = '',
}: CircularProductShowcaseProps) {
  // Filter out any demo, sample, or placeholder items
  const items = Array.isArray(products) ? products.filter(isRealProduct) : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mobileRailRef = useRef<HTMLDivElement | null>(null);

  // Clamp active index if items length changes dynamically
  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(0);
    }
  }, [items.length, activeIndex]);

  // 1. Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // 2. Pause/reduce animation when browser tab is inactive
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 3. Continuous automatic rotation (advances smoothly every 3.8s)
  const nextSlide = useCallback(() => {
    if (items.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    if (items.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (isHovered || isTabHidden || reducedMotion || items.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 3800);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, isTabHidden, reducedMotion, items.length, nextSlide]);

  // Sync mobile rail scroll when activeIndex changes
  useEffect(() => {
    if (!mobileRailRef.current || items.length === 0) return;
    const activeEl = mobileRailRef.current.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeIndex, reducedMotion, items.length]);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  // Clean empty state when 0 real products exist
  if (!items || items.length === 0) {
    return (
      <div
        className={`w-full py-16 px-6 rounded-3xl border text-center flex flex-col items-center justify-center ${className}`}
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background: 'var(--color-accent-3-badge)',
            color: 'var(--color-accent-3)',
          }}
        >
          <Sparkles size={22} />
        </div>
        <h3 className="font-display text-base font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>
          Curated Discoveries
        </h3>
        <p className="text-xs max-w-xs" style={{ color: 'var(--color-text-2)' }}>
          Verified product insights and price comparisons from trusted retailers.
        </p>
      </div>
    );
  }

  // 3D Orbital Geometry
  const totalCount = items.length;
  const radiusX = 205; // horizontal orbit radius
  const radiusY = 185; // vertical orbit radius

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
      role="region"
      aria-label="Interactive 3D Product Showcase"
    >
      {/* ── DESKTOP VIEW: Real 3D Orbit & Animated Center Selection (lg and above) ── */}
      <div
        className="hidden lg:flex flex-col items-center justify-center relative w-full h-[550px]"
        style={{ perspective: '1100px', perspectiveOrigin: '50% 50%' }}
      >
        {/* Ambient atmospheric backdrop */}
        <div
          className="absolute inset-0 m-auto w-[440px] h-[440px] rounded-full pointer-events-none opacity-40 transition-opacity duration-700"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-3-glow) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
        {/* Subtle orbit guides */}
        <div
          className="absolute inset-0 m-auto w-[410px] h-[370px] rounded-full border border-dashed pointer-events-none opacity-25"
          style={{ borderColor: 'var(--color-accent-3)' }}
          aria-hidden="true"
        />

        {/* 3D Orbit & Focal Stage */}
        <div
          className="relative w-[480px] h-[480px] flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((prod, idx) => {
            const isActive = idx === activeIndex;
            const isEditorChoice = Boolean(prod.featured);
            const hasImgError = imageErrors[prod._id];
            const mainImg = prod.images?.[0]?.url;

            // Compute orbital position
            const angleDeg = (idx * 360) / totalCount - 90;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.round(Math.cos(angleRad) * radiusX);
            const y = Math.round(Math.sin(angleRad) * radiusY);
            const z = Math.round(Math.sin(angleRad) * 30 - 15);
            const tiltY = Math.round(-Math.cos(angleRad) * 12);

            return (
              <div
                key={prod._id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: isActive
                    ? 'translate(-50%, -50%) translate3d(0px, 0px, 80px) scale(1)'
                    : `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) scale(0.84) rotateY(${tiltY}deg)`,
                  zIndex: isActive ? 40 : 10 + Math.round(z + 50),
                  transition: reducedMotion
                    ? 'none'
                    : 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease, border-color 0.4s ease, opacity 0.4s ease',
                  pointerEvents: 'auto',
                }}
              >
                {/* ── Active Center Detail Card ── */}
                {isActive ? (
                  <div
                    className="w-[270px] p-5 rounded-3xl border flex flex-col items-center text-center select-none"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-accent-3)',
                      boxShadow:
                        '0 20px 48px -8px var(--color-accent-3-glow), 0 8px 24px -4px rgba(15, 23, 42, 0.12)',
                    }}
                  >
                    {/* Badge: Editor's Choice or Recent Discovery */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm flex items-center gap-1"
                        style={
                          isEditorChoice
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
                        {isEditorChoice ? (
                          <>
                            <Sparkles size={10} />
                            <span>Editor's Choice</span>
                          </>
                        ) : (
                          <span>Recent Discovery</span>
                        )}
                      </span>
                    </div>

                    {/* Prominent Large Product Imagery */}
                    <a
                      href={url(`/product/${prod.slug}`)}
                      className="w-full h-36 rounded-2xl flex items-center justify-center p-2 mb-2.5 overflow-hidden transition-transform duration-200 hover:scale-[1.03]"
                      style={{ background: 'rgba(15, 23, 42, 0.03)' }}
                    >
                      {mainImg && !hasImgError ? (
                        <img
                          src={mainImg}
                          alt={prod.images?.[0]?.alt || prod.title}
                          className="w-full h-full object-contain"
                          loading="eager"
                          onError={() => handleImageError(prod._id)}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs font-bold text-[var(--color-text-2)]">
                          {prod.brand ? prod.brand.toUpperCase() : 'SAVRIVO'}
                        </div>
                      )}
                    </a>

                    {/* Brand */}
                    {prod.brand && (
                      <p
                        className="text-[11px] font-extrabold uppercase tracking-widest mb-1 truncate w-full"
                        style={{ color: 'var(--color-accent-3)' }}
                      >
                        {prod.brand}
                      </p>
                    )}

                    {/* Title */}
                    <a href={url(`/product/${prod.slug}`)} className="block mb-4 group">
                      <h3
                        className="font-display text-sm font-bold leading-snug line-clamp-2 transition-colors group-hover:text-[var(--color-accent-3)]"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        {prod.title}
                      </h3>
                    </a>

                    {/* Clear View Details Action */}
                    <a
                      href={url(`/product/${prod.slug}`)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-transform duration-150 hover:brightness-105 active:scale-95 shadow-sm"
                      style={{ background: 'var(--color-accent-3)' }}
                    >
                      <span>View Details</span>
                      <ArrowRight size={13} />
                    </a>
                  </div>
                ) : (
                  /* ── Orbital Satellite Card ── */
                  <button
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className="group relative w-28 h-36 rounded-2xl p-2.5 flex flex-col items-center justify-between border text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-3)] cursor-pointer"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.1)',
                    }}
                    aria-label={`Select ${prod.title}`}
                  >
                    {/* Satellite Mini Badge */}
                    <span
                      className="absolute -top-2 -right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shadow-xs pointer-events-none"
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

                    {/* Product Image Focus */}
                    <div className="w-full h-20 rounded-xl flex items-center justify-center p-1 overflow-hidden">
                      {mainImg && !hasImgError ? (
                        <img
                          src={mainImg}
                          alt={prod.images?.[0]?.alt || prod.title}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                          onError={() => handleImageError(prod._id)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-2)]">
                          {prod.brand ? prod.brand.slice(0, 4).toUpperCase() : 'PROD'}
                        </div>
                      )}
                    </div>

                    {/* Compact Brand footer */}
                    <div className="w-full text-center mt-1 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <span className="text-[10px] font-bold block truncate" style={{ color: 'var(--color-accent-3)' }}>
                        {prod.brand || 'Verified'}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Sleek Step Navigation Dots & Arrows (No Manual Play/Pause) */}
        {totalCount > 1 && (
          <div className="flex items-center gap-3 mt-4 z-20">
            <button
              type="button"
              onClick={prevSlide}
              className="p-1.5 rounded-lg border text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:border-[var(--color-accent-3)] transition-colors cursor-pointer"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              aria-label="Previous product"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === activeIndex ? 'w-6' : 'w-1.5'
                  }`}
                  style={{
                    background: i === activeIndex ? 'var(--color-accent-3)' : 'var(--color-border)',
                  }}
                  aria-label={`Go to product ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              className="p-1.5 rounded-lg border text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:border-[var(--color-accent-3)] transition-colors cursor-pointer"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              aria-label="Next product"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── MOBILE VIEW: Responsive Product Rail (< lg) ── */}
      <div className="block lg:hidden w-full mt-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3 px-1">
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
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-2)' }}>
            {activeIndex + 1} / {totalCount}
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
            const mainImg = prod.images?.[0]?.url;
            const hasImgError = imageErrors[prod._id];

            return (
              <div
                key={prod._id}
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 w-[270px] snap-center rounded-2xl p-4 border transition-all duration-200 cursor-pointer ${
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
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-accent-3)' }}
                    >
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
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-semibold"
                      style={{ color: 'var(--color-text-2)' }}
                    >
                      SAVRIVO Verified
                    </div>
                  )}
                </a>

                {/* Title */}
                <a href={url(`/product/${prod.slug}`)} className="block mb-2">
                  <h4
                    className="font-display text-sm font-bold leading-snug line-clamp-2"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {prod.title}
                  </h4>
                </a>

                {/* Action CTA */}
                <div
                  className="mt-auto pt-2 flex items-center justify-between border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-2)' }}>
                    Verified Partner
                  </span>

                  <a
                    href={url(`/product/${prod.slug}`)}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--color-accent-3)' }}
                  >
                    <span>View Details</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Pagination Dots */}
        {totalCount > 1 && (
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
        )}
      </div>
    </div>
  );
}
