import React from 'react';
import { url } from '@/lib/paths';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: 'text-xs px-3.5 py-2 gap-1.5 min-h-[36px] rounded-lg',
  md: 'text-sm px-5 py-2.5 gap-2 min-h-[44px] rounded-xl',
  lg: 'text-base px-7 py-3.5 gap-2.5 min-h-[50px] rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold btn-tactile cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97]';

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--color-accent)',
      color: '#FFFFFF',
      boxShadow: 'var(--shadow-sm)',
    },
    secondary: {
      background: 'var(--color-surface)',
      color: 'var(--color-text-1)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-text-1)',
      border: '1.5px solid var(--color-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-2)',
    },
    danger: {
      background: 'var(--color-error)',
      color: '#FFFFFF',
      boxShadow: 'var(--shadow-sm)',
    },
  };

  const hoverClasses =
    variant === 'primary' ? 'hover:brightness-105 hover:shadow-md' :
    variant === 'secondary' ? 'hover:bg-[var(--color-surface-subtle)] hover:border-[var(--color-border-hover)]' :
    variant === 'outline' ? 'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]' :
    variant === 'ghost' ? 'hover:bg-[var(--color-overlay)] hover:text-[var(--color-text-1)]' :
    'hover:brightness-105';

  const cls = `${baseClasses} ${sizeClasses[size]} ${hoverClasses} ${className}`;
  const style = variantStyles[variant];

  if (href) {
    const resolvedHref = href.startsWith('/') ? url(href) : href;
    return (
      <a href={resolvedHref} className={cls} style={style}>
        {leftIcon}
        {children}
        {rightIcon}
      </a>
    );
  }

  return (
    <button className={cls} style={style} disabled={disabled || loading} {...rest}>
      {loading ? (
        <svg
          className="animate-spin shrink-0"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
}
