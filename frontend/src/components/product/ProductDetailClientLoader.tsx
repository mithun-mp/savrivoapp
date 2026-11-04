import React, { useEffect, useState } from 'react';
import type { Product, Offer } from '@/types';
import { api } from '@/lib/api';
import { url } from '@/lib/paths';
import ProductDetailView from './ProductDetailView';
import { ShoppingBag, ArrowLeft, Search, AlertCircle } from 'lucide-react';

interface ProductDetailClientLoaderProps {
  initialSlug?: string;
}

export default function ProductDetailClientLoader({ initialSlug }: ProductDetailClientLoaderProps) {
  const [slug, setSlug] = useState<string>(initialSlug || '');
  const [product, setProduct] = useState<Product | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // 1. Resolve slug from pathname if not provided as prop
    let currentSlug = initialSlug || '';
    if (!currentSlug && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const match = pathname.match(/\/(?:savrivo|savrivoapp)?\/?product\/([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        currentSlug = match[1];
      }
    }

    if (!currentSlug) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    setSlug(currentSlug);

    // 2. Fetch product from backend API
    let isMounted = true;
    (async () => {
      try {
        const res = (await api.products.get(currentSlug)) as any;
        if (!isMounted) return;

        if (res?.success && res?.data) {
          const prod = res.data as Product;
          setProduct(prod);

          // Extract attached offers
          const attachedOffers = (res.data.offers as Offer[]) || [];
          setOffers(attachedOffers);

          // Update page title
          if (typeof document !== 'undefined') {
            document.title = `${prod.title} — Review & Deals | SAVRIVO`;
          }

          // Fetch related products
          try {
            const catId = typeof prod.categoryId === 'object' ? (prod.categoryId as any)?._id : prod.categoryId;
            if (catId) {
              const relRes = (await api.products.list(`limit=5&category=${catId}`)) as any;
              if (relRes?.data) {
                setRelated((relRes.data as Product[]).filter((p) => p._id !== prod._id).slice(0, 4));
              }
            }
          } catch {
            // Ignore related products fetch failure
          }
        } else {
          setNotFound(true);
        }
      } catch {
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialSlug]);

  if (loading) {
    return (
      <div className="section py-12 sm:py-20 min-h-[60vh] flex flex-col justify-center items-center">
        <div className="container-content max-w-4xl w-full space-y-8 animate-pulse">
          <div className="h-4 w-48 rounded-lg bg-[var(--color-surface-subtle)]"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="aspect-square rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]"></div>
            <div className="space-y-4">
              <div className="h-6 w-24 rounded-full bg-[var(--color-surface-subtle)]"></div>
              <div className="h-8 w-full rounded-xl bg-[var(--color-surface-subtle)]"></div>
              <div className="h-8 w-3/4 rounded-xl bg-[var(--color-surface-subtle)]"></div>
              <div className="h-24 w-full rounded-2xl bg-[var(--color-surface-subtle)] mt-6"></div>
              <div className="h-12 w-full rounded-xl bg-[var(--color-surface-subtle)] mt-4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="section py-16 sm:py-24 text-center min-h-[60vh] flex items-center justify-center">
        <div className="container-content max-w-lg space-y-6">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-accent)',
            }}
          >
            <AlertCircle size={32} />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--color-text-1)' }}>
              Product Not Found
            </h1>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
              The product you are looking for ({slug ? `"${slug}"` : 'requested link'}) does not exist or may have been archived.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={url('/products')}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 w-full sm:w-auto"
              style={{ background: 'var(--color-accent)' }}
            >
              <ShoppingBag size={16} />
              <span>Browse All Products</span>
            </a>
            <a
              href={url('/')}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm border transition-colors hover:bg-[var(--color-overlay)] w-full sm:w-auto"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-1)',
                background: 'var(--color-surface)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <ProductDetailView product={product} initialOffers={offers} relatedProducts={related} />;
}

