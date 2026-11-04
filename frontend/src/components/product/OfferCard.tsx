import React from 'react';
import type { Offer, Merchant } from '@/types';
import { formatINR, formatDate, API_BASE } from '@/lib/api';
import { ExternalLink, Clock, Info } from 'lucide-react';
import AffiliateDisclosure from '../ui/AffiliateDisclosure';

interface OfferCardProps {
  offer: Offer;
  className?: string;
}

function getMerchant(m: Offer['merchantId']): Merchant | null {
  if (typeof m === 'string') return null;
  return m as Merchant;
}

export default function OfferCard({ offer, className = '' }: OfferCardProps) {
  const merchant = getMerchant(offer.merchantId);
  const hasPrice = typeof offer.currentPrice === 'number' && offer.currentPrice > 0;
  const hasOriginal = typeof offer.originalPrice === 'number' && offer.originalPrice > 0;
  const hasDiscount = hasPrice && hasOriginal && offer.originalPrice! > offer.currentPrice!;

  const clickUrl = offer._id
    ? `${API_BASE}/click/${offer._id}${offer.productId ? `?productId=${offer.productId}` : ''}`
    : offer.affiliateUrl;

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 flex flex-col gap-4 border transition-all duration-200 ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {merchant && (
            <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-accent)' }}>
              {merchant.name}
            </p>
          )}

          {hasPrice && (
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-2xl sm:text-3xl font-extrabold tabular-nums" style={{ color: 'var(--color-text-1)' }}>
                {formatINR(offer.currentPrice!)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-sm line-through opacity-50 tabular-nums" style={{ color: 'var(--color-text-2)' }}>
                    {formatINR(offer.originalPrice!)}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-md border"
                    style={{
                      background: 'var(--color-accent-3-badge)',
                      color: 'var(--color-accent-3)',
                      borderColor: 'var(--color-accent-3)',
                    }}
                  >
                    {Math.round(((offer.originalPrice! - offer.currentPrice!) / offer.originalPrice!) * 100)}% OFF
                  </span>
                </>
              )}
            </div>
          )}

          {!hasPrice && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>
              Live price available at retailer
            </p>
          )}
        </div>

        <span
          className="text-xs font-semibold px-3 py-1 rounded-full shrink-0 border"
          style={
            offer.availability === 'in_stock'
              ? {
                  background: 'rgba(5, 150, 105, 0.12)',
                  color: 'var(--color-success)',
                  borderColor: 'rgba(5, 150, 105, 0.25)',
                }
              : offer.availability === 'out_of_stock'
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
          {offer.availability === 'in_stock'
            ? 'In Stock'
            : offer.availability === 'out_of_stock'
            ? 'Out of Stock'
            : 'Check Availability'}
        </span>
      </div>

      {/* Meta notes */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-text-2)' }}>
        {hasPrice && (
          <p className="flex items-center gap-1">
            <Info size={12} aria-hidden="true" />
            Price indicative at time of review
          </p>
        )}
        {offer.offerLastVerifiedAt && (
          <p className="flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            Verified: {formatDate(offer.offerLastVerifiedAt)}
          </p>
        )}
      </div>

      {/* Primary Affiliate Action */}
      <a
        href={clickUrl}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base text-white transition-all duration-150 hover:brightness-105 active:scale-[0.98] min-h-[48px] shadow-sv-sm cursor-pointer"
        style={{ background: 'var(--color-accent)' }}
      >
        <span>Buy Now</span>
        <ExternalLink size={16} aria-hidden="true" />
      </a>

      <AffiliateDisclosure compact />
    </div>
  );
}
