import React from 'react';
import type { Guide } from '@/types';
import { formatDate } from '@/lib/api';
import { BookOpen } from 'lucide-react';
import { url } from '@/lib/paths';

interface GuideCardProps {
  guide: Guide;
  className?: string;
}

export default function GuideCard({ guide, className = '' }: GuideCardProps) {
  return (
    <article
      className={`group flex flex-col rounded-2xl overflow-hidden card-hover border transition-all duration-200 ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Cover */}
      <a
        href={url(`/guides/${guide.slug}`)}
        className="block overflow-hidden relative"
        style={{ aspectRatio: '16/9', background: 'var(--color-overlay)' }}
        aria-label={`Read guide: ${guide.title}`}
      >
        {guide.coverImage ? (
          <img
            src={guide.coverImage}
            alt={`Cover for ${guide.title}`}
            className="w-full h-full object-cover img-zoom-target"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-2)' }}>
            <BookOpen size={36} opacity={0.4} />
          </div>
        )}

        {guide.category && (
          <span
            className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
            }}
          >
            {guide.category}
          </span>
        )}
      </a>

      {/* Content */}
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <a href={url(`/guides/${guide.slug}`)} className="group/title">
          <h3
            className="font-display text-base sm:text-lg font-bold mb-2 line-clamp-2 leading-snug transition-colors group-hover/title:text-[var(--color-accent)]"
            style={{ color: 'var(--color-text-1)' }}
          >
            {guide.title}
          </h3>
        </a>

        {guide.excerpt && (
          <p className="text-xs sm:text-sm line-clamp-2 leading-relaxed mb-4 flex-1" style={{ color: 'var(--color-text-2)' }}>
            {guide.excerpt}
          </p>
        )}

        <div
          className="mt-auto pt-3 flex items-center justify-between text-xs border-t"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
        >
          <span className="font-medium">{guide.author || 'SAVRIVO Editorial'}</span>
          {guide.publishedAt && <span>{formatDate(guide.publishedAt)}</span>}
        </div>
      </div>
    </article>
  );
}
