import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { url } from '@/lib/paths';

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  onSearch?: (q: string) => void;
  autoFocus?: boolean;
  fullWidth?: boolean;
}

export default function SearchBar({
  defaultValue = '',
  placeholder = 'Search products, categories, guides…',
  onSearch,
  autoFocus = false,
  fullWidth = false,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
    } else {
      window.location.href = url(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={`relative flex items-center ${fullWidth ? 'w-full' : 'w-full max-w-xl'}`}
    >
      <Search
        size={20}
        className="absolute left-4 pointer-events-none"
        style={{ color: 'var(--color-text-2)' }}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search SAVRIVO"
        className="w-full pl-12 pr-11 py-3.5 md:py-4 rounded-xl text-sm md:text-base outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--color-accent)]/20 shadow-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          color: 'var(--color-text-1)',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-3 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center btn-tactile hover:text-[var(--color-text-1)]"
          style={{ color: 'var(--color-text-2)' }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </form>
  );
}

