import { Guide } from '../models/Guide.model';
import { slugify } from '../utils/slugify';
import { getPagination } from '../utils/pagination';
import type { Request } from 'express';

export async function getGuides(query: Request['query']) {
  const { page, limit, skip } = getPagination(query);
  const [guides, total] = await Promise.all([
    Guide.find({ status: 'published' }).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    Guide.countDocuments({ status: 'published' }),
  ]);
  return { guides, total, page, limit };
}

export async function getGuideBySlug(slug: string) {
  return Guide.findOne({ slug, status: 'published' })
    .populate('relatedProducts', 'title slug images shortDescription brand')
    .lean();
}

export async function createGuide(data: Record<string, unknown>) {
  if (!data.slug && data.title) {
    data.slug = slugify(String(data.title));
  }
  const guide = new Guide(data);
  return guide.save();
}

export async function updateGuide(id: string, data: Record<string, unknown>) {
  return Guide.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
}

export async function getAdminGuides(query: Request['query']) {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const [guides, total] = await Promise.all([
    Guide.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Guide.countDocuments(filter),
  ]);
  return { guides, total, page, limit };
}

export async function getGuideById(id: string) {
  return Guide.findById(id).lean();
}

export async function deleteGuide(id: string) {
  return Guide.findByIdAndDelete(id);
}