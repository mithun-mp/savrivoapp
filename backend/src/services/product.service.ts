import { Product } from '../models/Product.model';
import { Offer } from '../models/Offer.model';
import { slugify } from '../utils/slugify';
import { getPagination } from '../utils/pagination';
import type { Request } from 'express';

export async function getProducts(query: Request['query']) {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  else filter.status = 'published'; // public default

  if (query.category) filter.categoryId = query.category;
  if (query.brand) filter.brand = new RegExp(String(query.brand), 'i');
  if (query.featured === 'true') filter.featured = true;

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (query.sort === 'title') sortOption = { title: 1 };
  if (query.sort === 'oldest') sortOption = { createdAt: 1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, status: 'published' })
    .populate('categoryId', 'name slug')
    .lean();
  if (!product) return null;

  const offers = await Offer.find({ productId: product._id, status: 'active' })
    .populate('merchantId', 'name slug websiteUrl logoUrl')
    .sort({ currentPrice: 1, createdAt: -1 })
    .lean();

  return { ...product, offers };
}

export async function getProductById(id: string) {
  const product = await Product.findById(id)
    .populate('categoryId', 'name slug')
    .lean();
  if (!product) return null;

  const offers = await Offer.find({ productId: product._id })
    .populate('merchantId', 'name slug websiteUrl logoUrl')
    .sort({ currentPrice: 1, createdAt: -1 })
    .lean();

  return { ...product, offers };
}

export async function createProduct(data: Record<string, unknown>) {
  if (!data.slug && data.title) {
    data.slug = slugify(String(data.title));
  }
  const product = new Product(data);
  return product.save();
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  return Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
}

export async function deleteProduct(id: string) {
  return Product.findByIdAndUpdate(id, { $set: { status: 'archived' } }, { new: true });
}

export async function getAdminProducts(query: Request['query']) {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.featured === 'true') filter.featured = true;

  const [products, total] = await Promise.all([
    Product.find(filter).populate('categoryId', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}
