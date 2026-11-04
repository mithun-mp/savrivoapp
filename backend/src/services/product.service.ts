import { Product } from '../models/Product.model';
import { Offer } from '../models/Offer.model';
import { inferProductPlatform, filterOffersForProduct } from '../utils/merchant-platform';
import { slugify } from '../utils/slugify';

const PRODUCT_POPULATE_FIELDS = [
  { path: 'categoryId', select: 'name slug' },
  { path: 'sourceMerchantId', select: 'name slug websiteUrl logoUrl' },
];

export async function getProducts(query: {
  page?: string;
  limit?: string;
  category?: string;
  brand?: string;
  featured?: string;
  sort?: string;
}) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '12', 10)));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { status: 'published' };
  if (query.category) filter.categoryId = query.category;
  if (query.brand) filter.brand = new RegExp(String(query.brand), 'i');
  if (query.featured === 'true') filter.featured = true;

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (query.sort === 'title') sortOption = { title: 1 };
  if (query.sort === 'oldest') sortOption = { createdAt: 1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate(PRODUCT_POPULATE_FIELDS)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  if (products.length > 0) {
    const productIds = products.map((p) => p._id);
    const activeOffers = await Offer.find({ productId: { $in: productIds }, status: 'active' })
      .populate('merchantId', 'name slug websiteUrl logoUrl')
      .sort({ currentPrice: 1, createdAt: -1 })
      .lean();

    const offersByProductId = new Map<string, any[]>();
    for (const off of activeOffers) {
      const pid = off.productId?.toString();
      if (!offersByProductId.has(pid)) offersByProductId.set(pid, []);
      offersByProductId.get(pid)!.push(off);
    }

    const enrichedProducts = products.map((prod) => {
      const rawOffers = offersByProductId.get(prod._id.toString()) || [];
      const platform = inferProductPlatform(prod, rawOffers[0]);
      const isolatedOffers = filterOffersForProduct(prod, rawOffers);
      let sourceMerchant = prod.sourceMerchantId;
      if (!sourceMerchant && isolatedOffers.length > 0) {
        sourceMerchant = isolatedOffers[0].merchantId;
      }
      return {
        ...prod,
        sourcePlatform: platform,
        sourceMerchant,
        offers: isolatedOffers,
      };
    });

    return { products: enrichedProducts, total, page, limit };
  }

  return { products, total, page, limit };
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, status: 'published' })
    .populate(PRODUCT_POPULATE_FIELDS)
    .lean();
  if (!product) return null;

  const rawOffers = await Offer.find({ productId: product._id, status: 'active' })
    .populate('merchantId', 'name slug websiteUrl logoUrl')
    .sort({ currentPrice: 1, createdAt: -1 })
    .lean();

  const platform = inferProductPlatform(product, rawOffers[0]);
  const isolatedOffers = filterOffersForProduct(product, rawOffers);
  let sourceMerchant = product.sourceMerchantId;
  if (!sourceMerchant && isolatedOffers.length > 0) {
    sourceMerchant = isolatedOffers[0].merchantId;
  }

  return {
    ...product,
    sourcePlatform: platform,
    sourceMerchant,
    offers: isolatedOffers,
  };
}

export async function getProductById(id: string) {
  const product = await Product.findById(id)
    .populate(PRODUCT_POPULATE_FIELDS)
    .lean();
  if (!product) return null;

  const rawOffers = await Offer.find({ productId: product._id })
    .populate('merchantId', 'name slug websiteUrl logoUrl')
    .sort({ currentPrice: 1, createdAt: -1 })
    .lean();

  const platform = inferProductPlatform(product, rawOffers[0]);
  const isolatedOffers = filterOffersForProduct(product, rawOffers);
  let sourceMerchant = product.sourceMerchantId;
  if (!sourceMerchant && isolatedOffers.length > 0) {
    sourceMerchant = isolatedOffers[0].merchantId;
  }

  return {
    ...product,
    sourcePlatform: platform,
    sourceMerchant,
    offers: isolatedOffers,
  };
}

export async function createProduct(data: Record<string, unknown>) {
  if (!data.slug && data.title) {
    data.slug = slugify(String(data.title));
  }
  const product = new Product(data);
  return product.save();
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  return Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

export async function deleteProduct(id: string) {
  return Product.findByIdAndUpdate(id, { $set: { status: 'archived' } }, { new: true });
}

export async function getAdminProducts(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '12', 10)));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.featured === 'true') filter.featured = true;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate(PRODUCT_POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { products, total, page, limit };
}
