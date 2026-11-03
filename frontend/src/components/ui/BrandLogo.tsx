import React from 'react';

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
  const iconStroke = variant === 'color' ? 'var(--color-accent)' : 'currentColor';
  const iconFill = variant === 'color' ? 'var(--color-accent)' : 'currentColor';

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {/* Precision S Vector Symbol */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      >
        <path
          d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33M16 53L11 48C11 48 13 39 21 36L43 28C51 25 53 16 53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
          stroke={iconStroke}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="32,24 38,32 32,40 26,32" fill={iconFill} />
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

