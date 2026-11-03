import React, { useId } from 'react';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  variant?: 'color' | 'mono';
  badge?: string;
  className?: string;
}

export default function BrandLogo({
  size = 32,
  showWordmark = true,
  variant = 'color',
  badge,
  className = '',
}: BrandLogoProps) {
  const uid = useId().replace(/:/g, '');
  const isColor = variant === 'color';

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {/* Precision S Vector Symbol with Dynamic Depth & Faceted Core */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      >
        {isColor && (
          <defs>
            <linearGradient id={`sweep-up-${uid}`} x1="53" y1="11" x2="21" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF8A3D" />
              <stop offset="35%" stopColor="#FF5A1F" />
              <stop offset="100%" stopColor="#E6450A" />
            </linearGradient>
            <linearGradient id={`sweep-low-${uid}`} x1="21" y1="36" x2="48" y2="53" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF5A1F" />
              <stop offset="60%" stopColor="#E6450A" />
              <stop offset="100%" stopColor="#C23800" />
            </linearGradient>
            <linearGradient id={`facet-light-${uid}`} x1="32" y1="24" x2="38" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FF5A1F" />
            </linearGradient>
            <linearGradient id={`facet-dark-${uid}`} x1="26" y1="24" x2="32" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF7A33" />
              <stop offset="60%" stopColor="#E6450A" />
              <stop offset="100%" stopColor="#992600" />
            </linearGradient>
          </defs>
        )}

        {/* Lower Base Contour */}
        <path
          d="M21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33"
          stroke={isColor ? `url(#sweep-low-${uid})` : 'currentColor'}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={isColor ? 1 : 0.82}
        />

        {/* Upper Apex Contour */}
        <path
          d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48M53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
          stroke={isColor ? `url(#sweep-up-${uid})` : 'currentColor'}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crest Specular Highlight Line (Color mode only) */}
        {isColor && (
          <path
            d="M24 16C31 12.8 40 12.5 48 12.8"
            stroke="#FFC8A3"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.75"
          />
        )}

        {/* Precision Cut Central Prism Core */}
        <polygon
          points="32,24 26,32 32,40"
          fill={isColor ? `url(#facet-dark-${uid})` : 'currentColor'}
          opacity={isColor ? 1 : 0.6}
        />
        <polygon
          points="32,24 38,32 32,40"
          fill={isColor ? `url(#facet-light-${uid})` : 'currentColor'}
          opacity={isColor ? 1 : 0.95}
        />
        <line
          x1="32"
          y1="24"
          x2="32"
          y2="40"
          stroke={isColor ? '#FFF7ED' : 'currentColor'}
          strokeWidth="0.8"
          opacity={isColor ? 0.85 : 0.4}
        />
        {isColor && (
          <polygon
            points="32,24 38,32 32,40 26,32"
            fill="none"
            stroke="#FFA366"
            strokeWidth="0.6"
            opacity="0.5"
          />
        )}
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <span
          className="font-display font-extrabold tracking-[0.22em] text-sm lg:text-base leading-none select-none"
          style={{ color: 'var(--color-text-1)' }}
        >
          SAVRIVO
        </span>
      )}

      {/* Optional Badge (e.g. Admin) */}
      {badge && (
        <span
          className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full border"
          style={{
            background: 'var(--color-accent-badge)',
            color: 'var(--color-accent-badge-text)',
            borderColor: 'var(--color-border)',
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
}
