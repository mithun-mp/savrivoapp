import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { config } from '../config/env';
import { Category } from '../models/Category.model';
import { Merchant } from '../models/Merchant.model';
import { Product } from '../models/Product.model';
import { Guide } from '../models/Guide.model';
import { SiteSettings } from '../models/SiteSettings.model';

const DEMO_NOTE = '[DEMO] This is sample data. Replace with real products and verified affiliate URLs via the admin dashboard.';

async function seed() {
  if (!config.mongoUri) {
    console.error('MONGODB_URI not set. Cannot seed.');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB. Starting seed...');

  // Site Settings
  const existingSettings = await SiteSettings.findOne({ _key: 'global' });
  if (!existingSettings) {
    await SiteSettings.create({
      _key: 'global',
      siteName: 'SAVRIVO',
      tagline: 'Smart Finds. Better Choices.',
      defaultCurrency: 'INR',
      defaultTheme: 'light',
      contactEmail: 'hello@savrivo.in',
    });
    console.log('✓ Site settings created');
  }

  // Categories
  const categoryData = [
    { name: 'Electronics', slug: 'electronics', description: 'Smartphones, laptops, audio, and more.', icon: 'Cpu', displayOrder: 1 },
    { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Appliances, cookware, and home essentials.', icon: 'Home', displayOrder: 2 },
    { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', description: 'Skincare, grooming, and wellness products.', icon: 'Sparkles', displayOrder: 3 },
    { name: 'Books', slug: 'books', description: 'Fiction, non-fiction, textbooks, and more.', icon: 'BookOpen', displayOrder: 4 },
    { name: 'Sports & Fitness', slug: 'sports-fitness', description: 'Equipment, apparel, and accessories.', icon: 'Dumbbell', displayOrder: 5 },
    { name: 'Clothing & Accessories', slug: 'clothing-accessories', description: 'Fashion for all occasions.', icon: 'ShoppingBag', displayOrder: 6 },
    { name: 'Toys & Games', slug: 'toys-games', description: 'Educational and entertaining picks.', icon: 'Gamepad2', displayOrder: 7 },
  ];

  const categoryIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const cat of categoryData) {
    const existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      const created = await Category.create(cat);
      categoryIds[cat.slug] = created._id as mongoose.Types.ObjectId;
      console.log(`✓ Category: ${cat.name}`);
    } else {
      categoryIds[cat.slug] = existing._id as mongoose.Types.ObjectId;
    }
  }

  // Merchants
  const merchantData = [
    {
      name: 'Amazon India',
      slug: 'amazon-india',
      websiteUrl: 'https://www.amazon.in',
      affiliateProgramName: 'Amazon Associates',
      enabled: true,
    },
    {
      name: 'Flipkart',
      slug: 'flipkart',
      websiteUrl: 'https://www.flipkart.com',
      affiliateProgramName: 'Flipkart Affiliate',
      enabled: true,
    },
  ];

  const merchantIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const m of merchantData) {
    const existing = await Merchant.findOne({ slug: m.slug });
    if (!existing) {
      const created = await Merchant.create(m);
      merchantIds[m.slug] = created._id as mongoose.Types.ObjectId;
      console.log(`✓ Merchant: ${m.name}`);
    } else {
      merchantIds[m.slug] = existing._id as mongoose.Types.ObjectId;
    }
  }

  // Demo Products (Dummy headphone records removed)
  const productData = [
    {
      title: 'DEMO: Smart Air Purifier',
      slug: 'demo-smart-air-purifier',
      shortDescription: DEMO_NOTE + ' Sample smart air purifier with HEPA filter.',
      brand: 'DEMO Brand',
      categoryId: categoryIds['home-kitchen'],
      highlights: ['HEPA H13 Filter', 'App-controlled', 'Real-time air quality monitoring'],
      specifications: [
        { key: 'Filter Type', value: 'HEPA H13' },
        { key: 'Coverage', value: '400 sq ft' },
        { key: 'Connectivity', value: 'Wi-Fi + App' },
      ],
      tags: ['air purifier', 'home', 'smart'],
      featured: false,
      status: 'published' as const,
    },
    {
      title: 'DEMO: Vitamin C Serum',
      slug: 'demo-vitamin-c-serum',
      shortDescription: DEMO_NOTE + ' Sample skincare serum.',
      brand: 'DEMO Brand',
      categoryId: categoryIds['beauty-personal-care'],
      highlights: ['10% Vitamin C', 'Hyaluronic Acid', 'Dermatologist tested'],
      specifications: [
        { key: 'Volume', value: '30 ml' },
        { key: 'Key Ingredients', value: 'Vitamin C, Hyaluronic Acid' },
        { key: 'Skin Type', value: 'All skin types' },
      ],
      tags: ['skincare', 'vitamin c', 'serum'],
      featured: false,
      status: 'published' as const,
    },
  ];

  for (const p of productData) {
    const existing = await Product.findOne({ slug: p.slug });
    if (!existing) {
      await Product.create(p);
      console.log(`✓ Product: ${p.title}`);
    }
  }

  // Demo Guide
  const guideSlug = 'demo-smart-home-buying-guide';
  const existingGuide = await Guide.findOne({ slug: guideSlug });
  if (!existingGuide) {
    await Guide.create({
      title: 'DEMO: Smart Home Essentials Buying Guide',
      slug: guideSlug,
      excerpt: 'A sample buying guide. Replace with real editorial content via the admin dashboard.',
      body: `<p>${DEMO_NOTE}</p><h2>What to Look For</h2><p>This is placeholder body content for a buying guide. Real guides should be written by your editorial team and published through the admin dashboard.</p>`,
      author: 'Savrivo Editorial',
      category: 'Home & Kitchen',
      status: 'published',
      publishedAt: new Date(),
    });
    console.log('✓ Guide: Demo buying guide created');
  }

  console.log('\n✅ Seed complete. Demo data is clearly marked for replacement.');
  console.log('📋 Next steps:');
  console.log('   1. Log in to the admin dashboard');
  console.log('   2. Replace demo products with real product data');
  console.log('   3. Add verified affiliate URLs for each offer');
  console.log('   4. Configure merchant affiliate settings');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
