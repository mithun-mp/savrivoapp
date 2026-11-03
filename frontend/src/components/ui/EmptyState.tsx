import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  showIcon?: boolean;
  showSavi?: boolean;
  className?: string;
}

function PrecisionDiscoveryIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="shrink-0">
      {/* Ambient Outer Lens */}
      <circle cx="32" cy="32" r="30" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="32" cy="32" r="20" fill="var(--color-accent)" opacity="0.06" />
      {/* Precision S Geometry in Empty State */}
      <path
        d="M48 11L53 16C53 16 51 25 43 28L21 36C13 39 11 48 11 48L16 53C24 53 35 53 45 47C53 42 53 33 53 33M16 53L11 48C11 48 13 39 21 36L43 28C51 25 53 16 53 16L48 11C40 11 29 11 19 17C11 22 11 31 11 31"
        stroke="var(--color-accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <polygon points="32,26 36,32 32,38 28,32" fill="var(--color-accent)" />
    </svg>
  );
}

export default function EmptyState({
  title,
  description,
  action,
  showIcon = true,
  showSavi,
  className = '',
}: EmptyStateProps) {
  const shouldShow = showSavi !== undefined ? showSavi : showIcon;
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 sm:py-20 px-6 ${className}`}>
      {shouldShow && (
        <div className="mb-6 opacity-90 transition-transform duration-300 hover:scale-105">
          <PrecisionDiscoveryIcon />
        </div>
      )}
      <h3 className="font-display text-lg sm:text-xl font-bold mb-2" style={{ color: 'var(--color-text-1)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
