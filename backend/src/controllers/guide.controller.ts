import type { Request, Response, NextFunction } from 'express';
import * as guideService from '../services/guide.service';
import { createGuideSchema, updateGuideSchema } from '../validators/guide.validator';
import { sendSuccess, sendError } from '../utils/response';

export async function listGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { guides, total, page, limit } = await guideService.getGuides(req.query);
    sendSuccess(res, guides, 200, undefined, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

export async function getGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guide = await guideService.getGuideBySlug(req.params.slug);
    if (!guide) { sendError(res, 'Guide not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, guide);
  } catch (err) { next(err); }
}

export async function adminListGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { guides, total, page, limit } = await guideService.getAdminGuides(req.query);
    sendSuccess(res, guides, 200, undefined, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

export async function createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createGuideSchema.parse(req.body);
    const guide = await guideService.createGuide(data as Record<string, unknown>);
    sendSuccess(res, guide, 201, 'Guide created');
  } catch (err) { next(err); }
}

export async function updateGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateGuideSchema.parse(req.body);
    const guide = await guideService.updateGuide(req.params.id, data as Record<string, unknown>);
    if (!guide) { sendError(res, 'Guide not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, guide, 200, 'Guide updated');
  } catch (err) { next(err); }
}

export async function adminGetGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guide = await guideService.getGuideById(req.params.id);
    if (!guide) { sendError(res, 'Guide not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, guide);
  } catch (err) { next(err); }
}

export async function deleteGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guide = await guideService.deleteGuide(req.params.id);
    if (!guide) { sendError(res, 'Guide not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, { id: req.params.id }, 200, 'Guide deleted');
  } catch (err) { next(err); }
}