import React from 'react';
import type { Category } from '@/types';
import {
  ArrowRight,
  Cpu,
  Home,
  Sparkles,
  BookOpen,
  Dumbbell,
  ShoppingBag,
  Gamepad2,
  Smartphone,
  Shirt,
  Heart,
  Camera,
  Tv,
  Watch,
  Tag,
  Grid,
} from 'lucide-react';
import { url } from '@/lib/paths';

const iconComponents: Record<string, React.ElementType> = {
  Cpu,
  Home,
  Sparkles,
  BookOpen,
  Dumbbell,
  ShoppingBag,
  Gamepad2,
  Smartphone,
  Shirt,
  Heart,
  Camera,
  Tv,
  Watch,
  Tag,
  Grid,
};

function CategoryIcon({ name }: { name?: string }) {
  const Icon = (name && iconComponents[name]) || Grid;
  return <Icon size={22} aria-hidden="true" />;
}

interface CategoryCardProps {
  category: Category;
  className?: string;
}

export default function CategoryCard({ category, className = '' }: CategoryCardProps) {
  return (
    <a
      href={url(`/category/${category.slug}`)}
      className={`group flex flex-col gap-4 p-6 rounded-2xl transition-all duration-200 card-hover border ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        color: 'var(--color-text-1)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
        style={{
          background: 'var(--color-accent-badge)',
          color: 'var(--color-accent)',
        }}
      >
        <CategoryIcon name={category.icon} />
      </div>

      <div>
        <h3 className="font-display font-bold text-base sm:text-lg mb-1.5 transition-colors group-hover:text-[var(--color-accent)]" style={{ color: 'var(--color-text-1)' }}>
          {category.name}
        </h3>
        {category.description && (
          <p className="text-xs sm:text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            {category.description}
          </p>
        )}
      </div>

      <div
        className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold mt-auto pt-2"
        style={{ color: 'var(--color-accent)' }}
      >
        <span>Explore Collection</span>
        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </a>
  );
}
