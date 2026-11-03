import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { themeStore, initTheme, toggleTheme } from '@/stores/theme';
import { Search, Sun, Moon, Menu } from 'lucide-react';
import { url } from '@/lib/paths';
import MobileMenu from './MobileMenu';
import BrandLogo from '../ui/BrandLogo';

interface NavbarProps {
  currentPath: string;
}

const navLinks = [
  { href: '/products', label: 'Discover' },
  { href: '/categories', label: 'Categories' },
  { href: '/guides', label: 'Buying Guides' },
  { href: '/offers', label: 'Offers' },
];

export default function Navbar({ currentPath }: NavbarProps) {
  const theme = useStore(themeStore);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    initTheme();
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) => {
    const target = url(href);
    return currentPath === target || (target !== url('/') && currentPath.startsWith(target));
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 transition-all duration-200"
        style={{
          background: scrolled ? 'var(--color-surface)' : 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="container-content flex items-center justify-between h-16 lg:h-20 gap-4 lg:gap-8">
          {/* Logo */}
          <a
            href={url('/')}
            className="group flex items-center shrink-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="SAVRIVO — Home"
          >
            <BrandLogo size={34} />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 flex-1 justify-center" aria-label="Main navigation">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <a
                  key={href}
                  href={url(href)}
                  className={`relative px-3.5 lg:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    active
                      ? 'shadow-sm'
                      : 'hover:text-[var(--color-text-1)] hover:bg-[var(--color-overlay)]'
                  }`}
                  style={{
                    color: active ? 'var(--color-accent)' : 'var(--color-text-2)',
                    background: active ? 'var(--color-accent-badge)' : 'transparent',
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-[2px] rounded-full transition-all"
                      style={{ background: 'var(--color-accent)' }}
                      aria-hidden="true"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Actions: Search, Theme, Mobile toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href={url('/search')}
              className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors hover:bg-[var(--color-overlay)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--color-text-1)' }}
              aria-label="Search SAVRIVO"
            >
              <Search size={20} />
            </a>

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors hover:bg-[var(--color-overlay)] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--color-text-1)' }}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[var(--color-overlay)] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: 'var(--color-text-1)' }}
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentPath={currentPath}
        navLinks={navLinks}
      />
    </>
  );
}
