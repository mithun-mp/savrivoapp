import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options = [], children, id, className = '', disabled, ...rest },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--color-text-2)' }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`w-full py-2.5 sm:py-3 pl-4 pr-10 text-sm md:text-base rounded-xl appearance-none outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--color-accent)]/20 cursor-pointer shadow-sm ${
            disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface-subtle)]' : ''
          } ${className}`}
          style={{
            background: 'var(--color-surface)',
            border: error
              ? '1.5px solid var(--color-error)'
              : '1.5px solid var(--color-border)',
            color: 'var(--color-text-1)',
          }}
          onFocus={e => {
            if (!error) e.target.style.borderColor = 'var(--color-accent)';
          }}
          onBlur={e => {
            if (!error) e.target.style.borderColor = 'var(--color-border)';
          }}
          {...rest}
        >
          {options.length > 0
            ? options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <ChevronDown
          size={16}
          className="absolute right-3.5 pointer-events-none shrink-0"
          style={{ color: 'var(--color-text-2)' }}
          aria-hidden="true"
        />
      </div>

      {error && (
        <p className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
});

export default Select;

