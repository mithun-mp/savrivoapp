import React from 'react';
import { url } from '@/lib/paths';
import BrandLogo from '../ui/BrandLogo';

const footerLinks = {
  discover: [
    { href: '/products', label: 'All Products' },
    { href: '/categories', label: 'Browse Categories' },
    { href: '/guides', label: 'Buying Guides' },
    { href: '/offers', label: 'Deals & Offers' },
  ],
  company: [
    { href: '/about', label: 'About SAVRIVO' },
    { href: '/editorial-policy', label: 'Editorial Policy' },
    { href: '/contact', label: 'Contact Us' },
  ],
  legal: [
    { href: '/affiliate-disclosure', label: 'Affiliate Disclosure' },
    { href: '/privacy-policy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t transition-colors duration-200 mt-auto"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="container-content py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-5 space-y-4">
            <a href={url('/')} className="inline-flex cursor-pointer" aria-label="SAVRIVO — Home">
              <BrandLogo size={32} />
            </a>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--color-text-2)' }}>
              <strong className="font-semibold" style={{ color: 'var(--color-text-1)' }}>
                Smart Finds. Better Choices.
              </strong>
              <br />
              An independent multi-retailer product discovery companion for India. We research, compare, and guide so you make confident choices.
            </p>
          </div>

          {/* Discover */}
          <div className="lg:col-span-2 lg:col-start-7">
            <h3
              className="text-xs font-bold uppercase tracking-widest mb-4 select-none"
              style={{ color: 'var(--color-text-1)' }}
            >
              Discover
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.discover.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={url(href)}
                    className="text-sm transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-2"
                    style={{ color: 'var(--color-text-2)' }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h3
              className="text-xs font-bold uppercase tracking-widest mb-4 select-none"
              style={{ color: 'var(--color-text-1)' }}
            >
              Company
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.company.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={url(href)}
                    className="text-sm transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-2"
                    style={{ color: 'var(--color-text-2)' }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2">
            <h3
              className="text-xs font-bold uppercase tracking-widest mb-4 select-none"
              style={{ color: 'var(--color-text-1)' }}
            >
              Compliance
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.legal.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={url(href)}
                    className="text-sm transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-2"
                    style={{ color: 'var(--color-text-2)' }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
        >
          <p>© {year} SAVRIVO. All rights reserved.</p>
          <p className="text-center sm:text-right max-w-md">
            SAVRIVO participates in affiliate marketing programs. We may earn a commission from qualifying purchases.{' '}
            <a
              href={url('/affiliate-disclosure')}
              className="underline underline-offset-2 hover:text-[var(--color-accent)] font-medium"
            >
              Affiliate Disclosure
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
