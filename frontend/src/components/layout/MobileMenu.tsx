import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { url } from '@/lib/paths';
import BrandLogo from '../ui/BrandLogo';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  navLinks: { href: string; label: string }[];
}

export default function MobileMenu({ open, onClose, currentPath, navLinks }: MobileMenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      closeRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isActive = (href: string) => {
    const target = url(href);
    return currentPath === target || (target !== url('/') && currentPath.startsWith(target));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-sv-xl z-10 transition-transform"
        style={{
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <a
            href={url('/')}
            className="flex items-center shrink-0 cursor-pointer"
            onClick={onClose}
            aria-label="SAVRIVO — Home"
          >
            <BrandLogo size={28} />
          </a>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-2 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:opacity-75 transition-opacity"
            style={{ color: 'var(--color-text-2)', background: 'var(--color-overlay)' }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-5 space-y-1.5 overflow-y-auto" aria-label="Mobile navigation">
          {[{ href: '/', label: 'Home' }, ...navLinks].map(({ href, label }) => {
            const active = isActive(href);
            return (
              <a
                key={href}
                href={url(href)}
                onClick={onClose}
                className="flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-all min-h-[44px]"
                style={{
                  color: active ? 'var(--color-accent)' : 'var(--color-text-1)',
                  background: active ? 'var(--color-accent-badge)' : 'transparent',
                }}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div
          className="p-5 border-t text-xs font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--color-accent)' }}>
            Smart Finds. Better Choices.
          </p>
          <p className="mt-1 opacity-75">Curated recommendations across Indian retail.</p>
        </div>
      </div>
    </div>
  );
}
