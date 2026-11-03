import React from 'react';
import { ChevronRight } from 'lucide-react';
import { url } from '@/lib/paths';

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `https://savrivo.in${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <ChevronRight
                size={13}
                className="shrink-0 opacity-40"
                style={{ color: 'var(--color-text-2)' }}
                aria-hidden="true"
              />
            )}
            {item.href && i < items.length - 1 ? (
              <a
                href={url(item.href)}
                className="text-xs font-medium hover:underline underline-offset-2 transition-colors hover:text-[var(--color-accent)]"
                style={{ color: 'var(--color-text-2)' }}
              >
                {item.label}
              </a>
            ) : (
              <span
                className="text-xs font-semibold truncate max-w-[240px] sm:max-w-md"
                style={{ color: 'var(--color-text-1)' }}
                aria-current="page"
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>
    </>
  );
}
