import type { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/category.service';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';
import { sendSuccess, sendError } from '../utils/response';

export async function listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await categoryService.getCategories();
    sendSuccess(res, categories);
  } catch (err) { next(err); }
}

export async function getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    if (!category) { sendError(res, 'Category not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, category);
  } catch (err) { next(err); }
}

export async function adminListCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await categoryService.getAllCategories();
    sendSuccess(res, categories);
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createCategorySchema.parse(req.body);
    const cat = await categoryService.createCategory(data as Record<string, unknown>);
    sendSuccess(res, cat, 201, 'Category created');
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateCategorySchema.parse(req.body);
    const cat = await categoryService.updateCategory(req.params.id, data as Record<string, unknown>);
    if (!cat) { sendError(res, 'Category not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, cat, 200, 'Category updated');
  } catch (err) { next(err); }
}

export async function adminGetCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await categoryService.getCategoryById(req.params.id);
    if (!cat) { sendError(res, 'Category not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, cat);
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await categoryService.deleteCategory(req.params.id);
    if (!cat) { sendError(res, 'Category not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, { id: req.params.id }, 200, 'Category deleted');
  } catch (err) { next(err); }
}