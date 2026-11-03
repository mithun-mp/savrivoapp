import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'curated';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'var(--color-surface-subtle)',
    color: 'var(--color-text-2)',
    border: '1px solid var(--color-border)',
  },
  accent: {
    background: 'var(--color-accent-badge)',
    color: 'var(--color-accent-badge-text)',
    border: '1px solid var(--color-border)',
  },
  curated: {
    background: 'var(--color-curated-badge)',
    color: 'var(--color-curated-text)',
    border: '1px solid var(--color-border)',
  },
  success: {
    background: 'rgba(5, 150, 105, 0.12)',
    color: 'var(--color-success)',
    border: '1px solid rgba(5, 150, 105, 0.25)',
  },
  warning: {
    background: 'var(--color-curated-badge)',
    color: 'var(--color-curated-text)',
    border: '1px solid var(--color-border)',
  },
  error: {
    background: 'rgba(220, 38, 38, 0.1)',
    color: 'var(--color-error)',
    border: '1px solid rgba(220, 38, 38, 0.25)',
  },
  info: {
    background: 'rgba(37, 99, 235, 0.1)',
    color: 'var(--color-info)',
    border: '1px solid rgba(37, 99, 235, 0.25)',
  },
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full select-none ${sizeClass} ${className}`}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
