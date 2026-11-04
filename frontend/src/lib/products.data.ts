import { API_BASE } from './api';
import type { Product } from '../types';

/**
 * ============================================================================
 * OPERATOR PROCEDURE: CONTROLLED PRODUCT SNAPSHOT
 * ============================================================================
 * This controlled snapshot guarantees that static site generation (SSG) in Astro
 * always produces deterministic static product routes (/product/[slug]) even when
 * the backend API on Render is cold-starting, rate-limited, or unavailable during builds.
 * ============================================================================
 */
export const CONTROLLED_PRODUCT_SNAPSHOT: Product[] = [
  {
    _id: '6ae9f9cc02bf6219500af801',
    title: 'Apple iPhone 14 (128 GB) - Blue',
    slug: 'apple-iphone-14-128-gb-blue',
    shortDescription:
      'The iPhone 14 features a durable Ceramic Shield front, an advanced dual-camera system, Crash Detection, and all-day battery life.',
    fullDescription:
      '### Overview\n\nThe **Apple iPhone 14** brings together high-speed A15 Bionic performance, a super-bright Super Retina XDR OLED display, and groundbreaking safety features including Crash Detection.\n\n### Key Highlights\n\n- 15.40 cm (6.1-inch) Super Retina XDR OLED display with HDR10\n- Advanced dual-camera system with 12MP Main and Ultra Wide lenses\n- Action mode for smooth, steady handheld videos\n- All-day battery life with up to 20 hours of video playback\n- Durable design with Ceramic Shield and IP68 water resistance',
    brand: 'Apple',
    categoryId: '6ae9f9cc02bf6219500af7b1', // Electronics
    subcategory: 'Smartphones',
    images: [
      {
        url: 'https://m.media-amazon.com/images/I/61bK6PMOC3L._SX679_.jpg',
        alt: 'Apple iPhone 14 128GB Blue',
      },
      {
        url: 'https://m.media-amazon.com/images/I/71G4AnScWUL._SX679_.jpg',
        alt: 'Apple iPhone 14 Back View',
      },
    ],
    specifications: [
      { key: 'Display', value: '6.1-inch Super Retina XDR OLED' },
      { key: 'Processor', value: 'A15 Bionic chip with 5-core GPU' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Camera', value: 'Dual 12MP (Main + Ultra Wide)' },
      { key: 'Operating System', value: 'iOS' },
      { key: 'Weight', value: '172 grams' },
    ],
    highlights: [
      '6.1-inch Super Retina XDR display',
      'Advanced camera system for better photos in any light',
      'Cinematic mode now in 4K Dolby Vision up to 30 fps',
      'Action mode for smooth, steady, handheld videos',
      'Vital safety technology — Crash Detection calls for help when you can’t',
    ],
    tags: ['iphone', 'apple', 'smartphone', 'electronics'],
    featured: true,
    status: 'published',
    seoTitle: 'Apple iPhone 14 (128 GB) - Blue — Review & Deals | SAVRIVO',
    seoDescription:
      'Compare verified retailer deals and technical specifications for the Apple iPhone 14 on SAVRIVO.',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    _id: '6ae9f9cc02bf6219500af802',
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    slug: 'sony-wh-1000xm5-wireless-noise-cancelling-headphones',
    shortDescription:
      'Industry-leading noise cancellation with two processors and eight microphones for unprecedented audio fidelity and crystal-clear calls.',
    fullDescription:
      '### Overview\n\nThe **Sony WH-1000XM5** rewrites the rules for distraction-free listening. Powered by the Integrated Processor V1 and HD Noise Cancelling Processor QN1, these headphones deliver precision sound and ultra-comfortable lightweight wear.\n\n### Key Highlights\n\n- Magnificently engineered Auto NC Optimizer keeps noise cancellation at peak efficiency\n- Crystal clear hands-free calling with 4 beamforming microphones\n- Up to 30-hour battery life with quick charging (3 min charge = 3 hours playback)',
    brand: 'Sony',
    categoryId: '6ae9f9cc02bf6219500af7b1', // Electronics
    subcategory: 'Audio',
    images: [
      {
        url: 'https://m.media-amazon.com/images/I/51SKmu2G9FL._SX679_.jpg',
        alt: 'Sony WH-1000XM5 Headphones Black',
      },
    ],
    specifications: [
      { key: 'Headphone Type', value: 'Over-Ear Wireless' },
      { key: 'Noise Cancellation', value: 'Active Noise Cancellation (Dual Processor)' },
      { key: 'Battery Life', value: 'Up to 30 hours' },
      { key: 'Bluetooth Version', value: 'Bluetooth 5.2 (LDAC supported)' },
      { key: 'Weight', value: '250 grams' },
    ],
    highlights: [
      'Two processors control 8 microphones for unprecedented noise cancellation',
      'Auto NC Optimizer automatically personalizes based on wearing conditions',
      'Ultra-comfortable, lightweight design with soft fit leather',
      'Multipoint connection allows quick switching between devices',
    ],
    tags: ['sony', 'headphones', 'audio', 'anc'],
    featured: true,
    status: 'published',
    seoTitle: 'Sony WH-1000XM5 Wireless Headphones — Review & Deals | SAVRIVO',
    seoDescription:
      'Check live prices and verified retailer offers for Sony WH-1000XM5 headphones on SAVRIVO.',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    _id: '6ae9f9cc02bf6219500af803',
    title: 'DEMO: Premium Wireless Headphones',
    slug: 'demo-premium-wireless-headphones',
    shortDescription:
      '[DEMO] Sample wireless headphones with active noise cancellation and ergonomic ear cups.',
    fullDescription:
      '### Overview\n\nSample wireless headphones with active noise cancellation. Replace with real products via the admin dashboard.',
    brand: 'DEMO Brand',
    categoryId: '6ae9f9cc02bf6219500af7b1',
    subcategory: 'Audio',
    images: [],
    specifications: [
      { key: 'Connectivity', value: 'Bluetooth 5.3' },
      { key: 'Battery', value: '30 hours' },
      { key: 'Noise Cancellation', value: 'Active' },
    ],
    highlights: [
      'Active Noise Cancellation',
      '30-hour battery life',
      'Premium audio quality',
    ],
    tags: ['headphones', 'wireless', 'audio'],
    featured: true,
    status: 'published',
    seoTitle: 'DEMO: Premium Wireless Headphones | SAVRIVO',
    seoDescription:
      'Demo product record. Replace with a real product via the admin dashboard.',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    _id: '6ae9f9cc02bf6219500af804',
    title: 'DEMO: Smart Air Purifier',
    slug: 'demo-smart-air-purifier',
    shortDescription:
      '[DEMO] Sample smart air purifier with HEPA H13 filter and real-time PM2.5 monitoring.',
    fullDescription:
      '### Overview\n\nSample smart air purifier with HEPA filter. Replace with real products via the admin dashboard.',
    brand: 'DEMO Brand',
    categoryId: '6ae9f9cc02bf6219500af7b2',
    subcategory: 'Home Essentials',
    images: [],
    specifications: [
      { key: 'Filter Type', value: 'HEPA H13' },
      { key: 'Coverage', value: '400 sq ft' },
      { key: 'Connectivity', value: 'Wi-Fi + App' },
    ],
    highlights: [
      'HEPA H13 Filter',
      'App-controlled air flow',
      'Real-time air quality monitoring',
    ],
    tags: ['air purifier', 'home', 'smart'],
    featured: false,
    status: 'published',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    _id: '6ae9f9cc02bf6219500af805',
    title: 'DEMO: Vitamin C Serum',
    slug: 'demo-vitamin-c-serum',
    shortDescription:
      '[DEMO] Sample skincare serum with 10% Vitamin C and pure hyaluronic acid.',
    fullDescription:
      '### Overview\n\nSample skincare serum. Replace with real products via the admin dashboard.',
    brand: 'DEMO Brand',
    categoryId: '6ae9f9cc02bf6219500af7b3',
    subcategory: 'Skincare',
    images: [],
    specifications: [
      { key: 'Volume', value: '30 ml' },
      { key: 'Key Ingredients', value: 'Vitamin C, Hyaluronic Acid' },
      { key: 'Skin Type', value: 'All skin types' },
    ],
    highlights: [
      '10% Pure Vitamin C',
      'Hyaluronic Acid for deep hydration',
      'Dermatologist tested',
    ],
    tags: ['skincare', 'vitamin c', 'serum'],
    featured: false,
    status: 'published',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
];

/**
 * Returns the list of products for static path generation.
 * Queries live API first with a bounded 5000ms timeout, then merges with the controlled snapshot.
 */
export async function getBuildProducts(): Promise<Product[]> {
  const mergedMap = new Map<string, Product>();

  // 1. Seed with snapshot products
  for (const p of CONTROLLED_PRODUCT_SNAPSHOT) {
    mergedMap.set(p.slug, p);
  }

  // 2. Attempt to fetch live products from backend
  try {
    const res = await fetch(`${API_BASE}/products?limit=100&status=published`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: Product[] };
      const liveProducts = json.data || [];
      for (const lp of liveProducts) {
        if (lp.slug) {
          mergedMap.set(lp.slug, lp);
        }
      }
    }
  } catch (err) {
    console.warn(
      '[BuildProducts] Live API unavailable during SSG build, using controlled snapshot:',
      (err as Error).message
    );
  }

  return Array.from(mergedMap.values());
}

