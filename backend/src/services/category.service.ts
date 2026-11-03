import { Category } from '../models/Category.model';
import { Product } from '../models/Product.model';
import { slugify } from '../utils/slugify';

export async function getCategories() {
  return Category.find({ active: true }).sort({ displayOrder: 1, name: 1 }).lean();
}

export async function getCategoryBySlug(slug: string) {
  return Category.findOne({ slug, active: true }).lean();
}

export async function createCategory(data: Record<string, unknown>) {
  if (!data.slug && data.name) {
    data.slug = slugify(String(data.name));
  }
  const cat = new Category(data);
  return cat.save();
}

export async function updateCategory(id: string, data: Record<string, unknown>) {
  return Category.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
}

export async function getAllCategories() {
  return Category.find().sort({ displayOrder: 1, name: 1 }).lean();
}

export async function getCategoryById(id: string) {
  return Category.findById(id).lean();
}

export async function deleteCategory(id: string) {
  const productCount = await Product.countDocuments({ categoryId: id });
  if (productCount > 0) {
    const err = new Error(`Cannot delete category: ${productCount} product(s) are associated with this category. Please reassign or remove associated products first.`);
    (err as unknown as Record<string, unknown>).statusCode = 409;
    (err as unknown as Record<string, unknown>).code = 'RELATIONAL_RESTRICTION';
    throw err;
  }
  return Category.findByIdAndDelete(id);
}