import React from 'react';
import type { Product } from '@/types';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

interface ProductGridProps {
  products?: Product[];
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonCount?: number;
  gridClassName?: string;
}

export default function ProductGrid({
  products = [],
  loading = false,
  error,
  emptyTitle = 'No products found',
  emptyDescription = 'Try adjusting your filters or check back later.',
  skeletonCount = 8,
  gridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-7',
}: ProductGridProps) {
  if (error) {
    return (
      <EmptyState
        title="Couldn't load products"
        description={error}
        showSavi={false}
        action={<Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>}
      />
    );
  }

  if (loading) {
    return (
      <div className={`grid ${gridClassName}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Button href="/products" variant="secondary">
            Browse all products
          </Button>
        }
      />
    );
  }

  return (
    <div className={`grid ${gridClassName}`}>
      {products.map((p, idx) => (
        <ProductCard
          key={p._id}
          product={p}
          className={`reveal-fade-up stagger-${(idx % 8) + 1}`}
        />
      ))}
    </div>
  );
}

