import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, id, className = '', disabled, ...rest },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--color-text-2)' }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div
            className="absolute left-3.5 pointer-events-none flex items-center justify-center shrink-0"
            style={{ color: 'var(--color-text-2)' }}
          >
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`w-full py-2.5 sm:py-3 text-sm md:text-base rounded-xl outline-none transition-all duration-150 shadow-sv-sm ${
            leftIcon ? 'pl-11' : 'pl-4'
          } ${rightIcon ? 'pr-11' : 'pr-4'} ${
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
        />

        {rightIcon && (
          <div
            className="absolute right-3.5 flex items-center justify-center shrink-0"
            style={{ color: 'var(--color-text-2)' }}
          >
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs" style={{ color: 'var(--color-text-2)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;

