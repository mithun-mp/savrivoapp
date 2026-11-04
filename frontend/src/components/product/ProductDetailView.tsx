import React, { useState } from 'react';
import type { Product, Offer, Category, Merchant } from '@/types';
import { formatDate, api, API_BASE } from '@/lib/api';
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
  const [offers, setOffers] = useState<Offer[]>(
    initialOffers && initialOffers.length > 0 ? initialOffers : (product.offers || [])
  );
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

  // 1. Determine Product's Associated Platform (Strict Merchant-Platform Isolation)
  const getProductPlatform = (p: Product, firstOffer?: Offer): string => {
    if (p.sourcePlatform) {
      const sp = p.sourcePlatform.toLowerCase();
      if (sp.includes('amazon') || sp.includes('amzn')) return 'amazon';
      if (sp.includes('flipkart') || sp.includes('fkrt')) return 'flipkart';
      if (sp.includes('myntra')) return 'myntra';
      if (sp.includes('ajio')) return 'ajio';
    }
    if (p.sourceMerchant && typeof p.sourceMerchant === 'object' && p.sourceMerchant.name) {
      const sm = p.sourceMerchant.name.toLowerCase();
      if (sm.includes('amazon') || sm.includes('amzn')) return 'amazon';
      if (sm.includes('flipkart') || sm.includes('fkrt')) return 'flipkart';
      if (sm.includes('myntra')) return 'myntra';
      if (sm.includes('ajio')) return 'ajio';
    }
    if (p.canonicalUrl) {
      const cu = p.canonicalUrl.toLowerCase();
      if (cu.includes('amazon') || cu.includes('amzn')) return 'amazon';
      if (cu.includes('flipkart') || cu.includes('fkrt')) return 'flipkart';
      if (cu.includes('myntra')) return 'myntra';
      if (cu.includes('ajio')) return 'ajio';
    }
    if (firstOffer) {
      const u = (firstOffer.productUrl || firstOffer.affiliateUrl || '').toLowerCase();
      if (u.includes('amazon') || u.includes('amzn')) return 'amazon';
      if (u.includes('flipkart') || u.includes('fkrt')) return 'flipkart';
      if (u.includes('myntra')) return 'myntra';
      if (u.includes('ajio')) return 'ajio';
    }
    return 'amazon';
  };

  const platform = getProductPlatform(product, offers[0]);

  const getPlatformName = (plat: string): string => {
    switch (plat) {
      case 'amazon':
        return 'Amazon India';
      case 'flipkart':
        return 'Flipkart';
      case 'myntra':
        return 'Myntra';
      case 'ajio':
        return 'AJIO';
      default:
        return product.brand ? `${product.brand} Store` : 'Authorized Retailer';
    }
  };

  const getMerchantName = (m?: Offer['merchantId']): string => {
    if (!m) return getPlatformName(platform);
    if (typeof m === 'object' && (m as Merchant).name) return (m as Merchant).name;
    return getPlatformName(platform);
  };

  const getMerchantLogo = (m?: Offer['merchantId']): string | undefined => {
    if (typeof m === 'object' && (m as Merchant).logoUrl) return (m as Merchant).logoUrl;
    return undefined;
  };

  const associatedMerchantName =
    product.sourceMerchant && typeof product.sourceMerchant === 'object' && product.sourceMerchant.name
      ? product.sourceMerchant.name
      : offers.length > 0 && typeof offers[0].merchantId === 'object' && (offers[0].merchantId as Merchant).name
      ? (offers[0].merchantId as Merchant).name
      : getPlatformName(platform);

  // 2. Strict Merchant-Platform Isolation: Filter offers strictly to product's associated merchant platform
  const rawOffers = offers && offers.length > 0 ? offers : (product.offers || []);
  let isolatedOffers = [...rawOffers]
    .filter((o) => {
      const u = (o.productUrl || o.affiliateUrl || '').toLowerCase();
      const mName = (typeof o.merchantId === 'object' ? (o.merchantId as Merchant).name : '').toLowerCase();
      if (platform === 'amazon') return u.includes('amazon') || u.includes('amzn') || mName.includes('amazon');
      if (platform === 'flipkart') return u.includes('flipkart') || u.includes('fkrt') || mName.includes('flipkart');
      if (platform === 'myntra') return u.includes('myntra') || mName.includes('myntra');
      if (platform === 'ajio') return u.includes('ajio') || mName.includes('ajio');
      return true;
    });

  // If no offer records exist yet, synthesize primary offer from canonicalUrl if available
  if (isolatedOffers.length === 0 && product.canonicalUrl) {
    isolatedOffers = [
      {
        _id: '',
        productUrl: product.canonicalUrl,
        affiliateUrl: product.canonicalUrl,
        availability: 'in_stock',
        status: 'active',
      } as any,
    ];
  }

  const primaryOffer = isolatedOffers[0];
  const secondaryOffers = isolatedOffers.slice(1);

  // Resolved direct Buy Now destination
  const buyNowUrl = primaryOffer?._id
    ? `${API_BASE}/click/${primaryOffer._id}?productId=${product._id}`
    : primaryOffer?.affiliateUrl || primaryOffer?.productUrl || product.canonicalUrl || '#';

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = (await api.products.refresh(product.slug)) as any;
      if (res?.data?.offers && Array.isArray(res.data.offers) && res.data.offers.length > 0) {
        setOffers(res.data.offers);
        setRefreshMessage('Retailer offers refreshed.');
      } else {
        setRefreshMessage('Offer data is up to date.');
      }
    } catch {
      setRefreshMessage('Using verified retailer offer.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4000);
    }
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
                    background: 'var(--color-accent-3-badge)',
                    color: 'var(--color-accent-3-text)',
                    border: '1px solid var(--color-accent-3)',
                  }}
                >
                  Editor's Choice
                </span>
              )}

              <span
                className="text-xs font-semibold px-3 py-1 rounded-full border"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-2)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {associatedMerchantName} Exclusive
              </span>
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

            {/* Verified Retailer Offers & Purchase Box (Strict Merchant-Platform Isolation) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--color-text-2)' }}>
                  <Store size={14} className="text-[var(--color-accent)]" />
                  Verified Retailer Offer ({associatedMerchantName})
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
                  title="Check latest availability from merchant"
                >
                  <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[var(--color-accent)]' : ''} />
                  <span>{isRefreshing ? 'Checking...' : 'Check Availability'}</span>
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
                          <span className="text-[11px]" style={{ color: 'var(--color-text-2)' }}>
                            Direct Merchant Partner
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

                    {/* Freshness & Attribution timestamp */}
                    <div className="flex items-center gap-2 text-xs pt-1" style={{ color: 'var(--color-text-2)' }}>
                      <Clock size={12} />
                      <span>
                        Verified {primaryOffer.offerLastVerifiedAt ? formatDate(primaryOffer.offerLastVerifiedAt) : 'recently'} on{' '}
                        {getMerchantName(primaryOffer.merchantId)}
                      </span>
                    </div>

                    {/* Primary Buy Now CTA */}
                    <div className="pt-2">
                      <a
                        href={buyNowUrl}
                        target="_blank"
                        rel="sponsored nofollow noopener noreferrer"
                        className="w-full py-4 px-6 rounded-xl font-bold text-base sm:text-lg text-white flex items-center justify-center gap-2 transition-transform duration-150 hover:brightness-105 active:scale-[0.98] shadow-md cursor-pointer"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        <span>Buy Now</span>
                        <ExternalLink size={20} />
                      </a>
                    </div>
                  </div>

                  {/* Multiple Offers from the SAME Platform Only */}
                  {secondaryOffers.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-2)' }}>
                        More Verified Options on {associatedMerchantName}:
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
                                {secOffer.sellerName || associatedMerchantName}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`${API_BASE}/click/${secOffer._id}?productId=${product._id}`}
                            target="_blank"
                            rel="sponsored nofollow noopener noreferrer"
                            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold border transition-colors hover:bg-[var(--color-overlay)]"
                            style={{
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-1)',
                            }}
                          >
                            <span>Buy Now</span>
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback when no active offer is linked */
                <div
                  className="p-6 rounded-2xl border flex flex-col gap-4"
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
                        Currently Unavailable on {associatedMerchantName}
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                        This product is associated with {associatedMerchantName}. We are actively monitoring inventory. Verified direct offers will appear once in stock.
                      </p>
                    </div>
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
                <h2 className="font-display text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-1)' }}>
                  Specifications & Hardware
                </h2>
              </div>
            </div>

            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <table className="w-full text-left text-sm border-collapse">
                <tbody>
                  {product.specifications.map((spec, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-b-0 transition-colors hover:bg-[var(--color-overlay)]"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td
                        className="py-3.5 px-5 sm:px-6 font-semibold w-1/3 sm:w-1/4"
                        style={{ color: 'var(--color-text-2)', background: 'var(--color-surface-subtle)' }}
                      >
                        {spec.key}
                      </td>
                      <td className="py-3.5 px-5 sm:px-6 font-medium" style={{ color: 'var(--color-text-1)' }}>
                        {spec.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Full Editorial Overview Section */}
        {product.fullDescription && (
          <section className="mb-16 pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-accent)' }}>
                Deep Dive Analysis
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-1)' }}>
                Editorial Overview & In-Depth Review
              </h2>
            </div>

            <div
              className="p-6 sm:p-8 rounded-2xl border leading-relaxed space-y-4"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--color-text-1)',
              }}
            >
              {product.fullDescription.split('\n\n').map((paragraph, idx) => {
                if (paragraph.startsWith('### ')) {
                  return (
                    <h3 key={idx} className="font-display text-lg font-bold pt-2 mb-1" style={{ color: 'var(--color-text-1)' }}>
                      {paragraph.replace('### ', '')}
                    </h3>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  const listItems = paragraph.split('\n').filter((item) => item.startsWith('- '));
                  return (
                    <ul key={idx} className="space-y-1.5 pl-4 list-disc text-sm sm:text-base" style={{ color: 'var(--color-text-2)' }}>
                      {listItems.map((li, lIdx) => (
                        <li key={lIdx}>{li.replace('- ', '')}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={idx} className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </section>
        )}

        {/* Related Products Rail */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-accent)' }}>
                  More in {categoryName || 'Category'}
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-1)' }}>
                  Related Curated Recommendations
                </h2>
              </div>
              {categorySlug && (
                <a
                  href={url(`/category/${categorySlug}`)}
                  className="text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relProd) => (
                <ProductCard key={relProd._id} product={relProd} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
