import { Schema, model, Document, Types } from 'mongoose';
import type { ProductStatus } from '../types';

interface ImageItem {
  url: string;
  alt: string;
}

interface SpecItem {
  key: string;
  value: string;
}

export interface IProduct extends Document {
  title: string;
  slug: string;
  shortDescription?: string;
  fullDescription?: string;
  brand?: string;
  categoryId?: Types.ObjectId;
  subcategory?: string;
  images: ImageItem[];
  specifications: SpecItem[];
  highlights: string[];
  searchKeywords: string[];
  tags: string[];
  featured: boolean;
  status: ProductStatus;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  sourceMerchantId?: Types.ObjectId;
  sourcePlatform?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true },
    fullDescription: { type: String },
    brand: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    subcategory: { type: String, trim: true },
    images: [{ url: String, alt: String }],
    specifications: [{ key: String, value: String }],
    highlights: [String],
    searchKeywords: [String],
    tags: [String],
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    seoTitle: { type: String },
    seoDescription: { type: String },
    canonicalUrl: { type: String },
    sourceMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant' },
    sourcePlatform: { type: String, lowercase: true, trim: true },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, featured: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ sourcePlatform: 1, status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ title: 'text', shortDescription: 'text', brand: 'text', searchKeywords: 'text' });

export const Product = model<IProduct>('Product', productSchema);
