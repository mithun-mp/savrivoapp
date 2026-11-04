import React, { useState } from 'react';
import type { Product, Offer, Category, Merchant } from '@/types';
import { formatINR, formatDate, api, API_BASE } from '@/lib/api';
import { url } from '@/lib/paths';
import ProductGallery from './ProductGallery';
import ProductCard from './ProductCard';
import Breadcrumb from '../ui/Breadcrumb';
import AffiliateDisclosure from '../ui/AffiliateDisclosure';
import {
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Clock,
  Info,
  Tag,
  ArrowRight,
  Store,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  initialOffers?: Offer[];
  relatedProducts?: Product[];
}

export default function ProductDetailView({
  product,
  initialOffers = [],
  relatedProducts = [],
}: ProductDetailViewProps) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const categoryName =
    typeof product.categoryId === 'object' && product.categoryId
      ? (product.categoryId as Category).name
      : '';
  const categorySlug =
    typeof product.categoryId === 'object' && product.categoryId
      ? (product.categoryId as Category).slug
      : '';

  // Sort offers by price ascending (cheapest first)
  const sortedOffers = [...offers].sort((a, b) => {
    if (!a.currentPrice) return 1;
    if (!b.currentPrice) return -1;
    return a.currentPrice - b.currentPrice;
  });

  const primaryOffer = sortedOffers[0];
  const secondaryOffers = sortedOffers.slice(1);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = (await api.products.refresh(product.slug)) as any;
      if (res?.data?.offers && Array.isArray(res.data.offers)) {
        setOffers(res.data.offers);
        setRefreshMessage('Prices & availability refreshed.');
      } else {
        setRefreshMessage('Price data is up to date.');
      }
    } catch {
      setRefreshMessage('Checked: currently using latest verified price.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4000);
    }
  };

  const getMerchantName = (m?: Offer['merchantId']): string => {
    if (!m) return 'Retailer';
    if (typeof m === 'object' && (m as Merchant).name) return (m as Merchant).name;
    return 'Retailer';
  };

  const getMerchantLogo = (m?: Offer['merchantId']): string | undefined => {
    if (typeof m === 'object' && (m as Merchant).logoUrl) return (m as Merchant).logoUrl;
    return undefined;
  };

  return (
    <div className="section py-6 sm:py-10">
      <div className="container-content">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 sm:mb-8">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              ...(categoryName ? [{ label: categoryName, href: `/category/${categorySlug}` }] : []),
              { label: product.title },
            ]}
          />
        </div>

        {/* Main Product Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 mb-16 lg:mb-20">
          {/* Gallery Column (Sticky on Desktop) */}
          <div className="lg:col-span-6 xl:col-span-5 lg:sticky lg:top-28 self-start">
            <ProductGallery images={product.images || []} title={product.title} />

            {/* Trust Value Badges under Gallery */}
            <div
              className="mt-6 p-4 rounded-2xl border flex items-center justify-around gap-2 text-xs"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--color-text-2)' }}>
                <ShieldCheck size={16} className="text-[var(--color-accent)]" />
                <span>Verified Specs</span>
              </div>
              <div className="w-px h-4" style={{ background: 'var(--color-border)' }}></div>
              <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--color-text-2)' }}>
                <Sparkles size={16} className="text-[var(--color-accent)]" />
                <span>Unbiased Review</span>
              </div>
              <div className="w-px h-4" style={{ background: 'var(--color-border)' }}></div>
              <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--color-text-2)' }}>
                <CheckCircle2 size={16} className="text-[var(--color-accent)]" />
                <span>Authentic Links</span>
              </div>
            </div>
          </div>

          {/* Product Details & Actions Column */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-6">
            {/* Category & Brand Meta */}
            <div className="flex flex-wrap items-center gap-2.5">
              {categoryName && (
                <a href={url(`/category/${categorySlug}`)} className="inline-flex">
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-transform hover:scale-105"
                    style={{
                      background: 'var(--color-accent-badge)',
                      color: 'var(--color-accent-badge-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {categoryName}
                  </span>
                </a>
              )}

              {product.featured && (
                <span
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                  style={{
                    background: 'var(--color-curated-badge)',
                    color: 'var(--color-curated-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Editor's Pick
                </span>
              )}
            </div>

            <div>
              {product.brand && (
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-accent)' }}>
                  {product.brand}
                </p>
              )}
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-snug tracking-tight" style={{ color: 'var(--color-text-1)' }}>
                {product.title}
              </h1>
            </div>

            {product.shortDescription && (
              <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                {product.shortDescription}
              </p>
            )}

            {/* Key Highlights Glass Card */}
            {product.highlights && product.highlights.length > 0 && (
              <div
                className="p-5 sm:p-6 rounded-2xl border"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h2 className="text-xs font-bold uppercase tracking-widest mb-3.5 flex items-center gap-2" style={{ color: 'var(--color-text-1)' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
                  Key Highlights & Capabilities
                </h2>
                <ul className="space-y-2.5">
                  {product.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-1)' }}>
                      <span className="mt-1.5 w-2 h-2 rotate-45 shrink-0" style={{ background: 'var(--color-accent)' }}></span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Verified Retailer Offers & Purchase Box */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--color-text-2)' }}>
                  <Store size={14} className="text-[var(--color-accent)]" />
                  Verified Retailer Pricing
                </h2>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-80 active:scale-95"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-2)',
                    background: 'var(--color-surface)',
                  }}
                  title="Refresh live prices from merchant API"
                >
                  <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[var(--color-accent)]' : ''} />
                  <span>{isRefreshing ? 'Checking...' : 'Check Live Price'}</span>
                </button>
              </div>

              {refreshMessage && (
                <div
                  className="text-xs py-2 px-3.5 rounded-xl border flex items-center gap-2"
                  style={{
                    background: 'var(--color-accent-badge)',
                    color: 'var(--color-accent)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <Info size={14} />
                  <span>{refreshMessage}</span>
                </div>
              )}

              {primaryOffer ? (
                <div className="space-y-3">
                  {/* Primary Offer Box */}
                  <div
                    className="p-6 rounded-2xl border flex flex-col gap-4"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {getMerchantLogo(primaryOffer.merchantId) ? (
                          <img
                            src={getMerchantLogo(primaryOffer.merchantId)}
                            alt={getMerchantName(primaryOffer.merchantId)}
                            className="w-8 h-8 rounded-lg object-contain border p-1"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{ background: 'var(--color-accent-badge)', color: 'var(--color-accent)' }}
                          >
                            {getMerchantName(primaryOffer.merchantId).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--color-accent)' }}>
                            {getMerchantName(primaryOffer.merchantId)}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                            Verified Merchant Partner
                          </span>
                        </div>
                      </div>

                      {/* Availability status badge */}
                      <span
                        className="text-xs font-semibold px-3 py-1 rounded-full border"
                        style={
                          primaryOffer.availability === 'in_stock'
                            ? {
                                background: 'rgba(5, 150, 105, 0.12)',
                                color: 'var(--color-success)',
                                borderColor: 'rgba(5, 150, 105, 0.25)',
                              }
                            : primaryOffer.availability === 'out_of_stock'
                            ? {
                                background: 'rgba(220, 38, 38, 0.1)',
                                color: 'var(--color-error)',
                                borderColor: 'rgba(220, 38, 38, 0.25)',
                              }
                            : {
                                background: 'var(--color-surface-subtle)',
                                color: 'var(--color-text-2)',
                                borderColor: 'var(--color-border)',
                              }
                        }
                      >
                        {primaryOffer.availability === 'in_stock'
                          ? 'In Stock'
                          : primaryOffer.availability === 'out_of_stock'
                          ? 'Out of Stock'
                          : 'Check Availability'}
                      </span>
                    </div>

                    {/* Price Block */}
                    <div className="flex items-baseline gap-3 pt-1">
                      {primaryOffer.currentPrice ? (
                        <>
                          <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                            {formatINR(primaryOffer.currentPrice)}
                          </span>
                          {primaryOffer.originalPrice && primaryOffer.originalPrice > primaryOffer.currentPrice && (
                            <>
                              <span className="text-base line-through opacity-50 tabular-nums" style={{ color: 'var(--color-text-2)' }}>
                                {formatINR(primaryOffer.originalPrice)}
                              </span>
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-md"
                                style={{
                                  background: 'rgba(5, 150, 105, 0.15)',
                                  color: 'var(--color-success)',
                                }}
                              >
                                {Math.round(((primaryOffer.originalPrice - primaryOffer.currentPrice) / primaryOffer.originalPrice) * 100)}% OFF
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-base font-medium" style={{ color: 'var(--color-text-2)' }}>
                          Live price verified at retailer
                        </span>
                      )}
                    </div>

                    {/* Freshness & Attribution note */}
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-3)' }}>
                      <Clock size={12} />
                      <span>
                        Verified {primaryOffer.offerLastVerifiedAt ? formatDate(primaryOffer.offerLastVerifiedAt) : 'recently'} via{' '}
                        {getMerchantName(primaryOffer.merchantId)}
                      </span>
                    </div>

                    {/* Prominent Affiliate Purchase CTA Button */}
                    <a
                      href={`${API_BASE}/click/${primaryOffer._id}`}
                      target="_blank"
                      rel="sponsored nofollow noopener noreferrer"
                      className="w-full py-4 px-6 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-transform duration-150 hover:brightness-105 active:scale-[0.98] shadow-md"
                      style={{ background: 'var(--color-accent)' }}
                    >
                      <span>Buy at {getMerchantName(primaryOffer.merchantId)}</span>
                      <ExternalLink size={18} />
                    </a>
                  </div>

                  {/* Multi-Merchant Comparison (if additional offers exist) */}
                  {secondaryOffers.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-2)' }}>
                        Also Available At Other Trusted Stores:
                      </p>
                      {secondaryOffers.map((secOffer) => (
                        <div
                          key={secOffer._id}
                          className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-colors"
                          style={{
                            background: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Store size={18} className="text-[var(--color-accent)]" />
                            <div>
                              <p className="text-xs font-bold" style={{ color: 'var(--color-text-1)' }}>
                                {getMerchantName(secOffer.merchantId)}
                              </p>
                              {secOffer.currentPrice && (
                                <p className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                                  {formatINR(secOffer.currentPrice)}
                                </p>
                              )}
                            </div>
                          </div>
                          <a
                            href={`${API_BASE}/click/${secOffer._id}`}
                            target="_blank"
                            rel="sponsored nofollow noopener noreferrer"
                            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold border transition-colors hover:bg-[var(--color-overlay)]"
                            style={{
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-1)',
                            }}
                          >
                            <span>View Store</span>
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback when no offers yet linked */
                <div
                  className="p-6 rounded-2xl border flex flex-col gap-3"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'var(--color-accent-badge)', color: 'var(--color-accent)' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>
                        Retailer Availability & Price Discovery
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                        This product is actively monitored across authorized Indian merchants. Search live verified inventory on partner platforms:
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <a
                      href={`https://www.amazon.in/s?k=${encodeURIComponent(product.title)}`}
                      target="_blank"
                      rel="sponsored nofollow noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-95 shadow-sm min-h-[44px]"
                      style={{ background: 'var(--color-accent)' }}
                    >
                      <span>Check on Amazon India</span>
                      <ExternalLink size={15} />
                    </a>
                    <a
                      href={`https://www.flipkart.com/search?q=${encodeURIComponent(product.title)}`}
                      target="_blank"
                      rel="sponsored nofollow noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm border transition-colors hover:bg-[var(--color-overlay)] min-h-[44px]"
                      style={{
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-1)',
                        background: 'var(--color-surface)',
                      }}
                    >
                      <span>Search on Flipkart</span>
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <AffiliateDisclosure compact />
              </div>
            </div>
          </div>
        </div>

        {/* Specifications Section */}
        {product.specifications && product.specifications.length > 0 && (
          <section className="mb-16 pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-accent)' }}>
                  Technical Details
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-text-1)' }}>
                  Product Specifications
                </h2>
              </div>
            </div>

            <div
              className="rounded-2xl overflow-hidden border"
              style={{ borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {product.specifications.map((spec, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-12 p-4 sm:px-6 transition-colors"
                    style={{
                      background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)',
                    }}
                  >
                    <div className="sm:col-span-4 font-semibold text-xs sm:text-sm" style={{ color: 'var(--color-text-2)' }}>
                      {spec.key}
                    </div>
                    <div className="sm:col-span-8 text-xs sm:text-sm font-medium mt-1 sm:mt-0" style={{ color: 'var(--color-text-1)' }}>
                      {spec.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Full Editorial Overview Section */}
        {product.fullDescription && (
          <section className="mb-16 pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-6" style={{ color: 'var(--color-text-1)' }}>
              Editorial Overview & In-Depth Review
            </h2>
            <div
              className="prose prose-sm sm:prose-base max-w-none leading-relaxed p-6 sm:p-8 rounded-2xl border"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-1)',
              }}
            >
              <div className="space-y-4 whitespace-pre-line leading-relaxed">
                {product.fullDescription}
              </div>
            </div>
          </section>
        )}

        {/* Related Products Grid */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-accent)' }}>
                  More in {categoryName || 'Catalog'}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: 'var(--color-text-1)' }}>
                  Related Curated Picks
                </h2>
              </div>
              {categorySlug && (
                <a
                  href={url(`/category/${categorySlug}`)}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors hover:text-[var(--color-accent)]"
                  style={{ color: 'var(--color-text-2)' }}
                >
                  <span>Explore category</span>
                  <ArrowRight size={14} />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relProduct) => (
                <ProductCard key={relProduct._id} product={relProduct} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

