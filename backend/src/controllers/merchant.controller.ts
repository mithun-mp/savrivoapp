import type { Request, Response, NextFunction } from 'express';
import * as merchantService from '../services/merchant.service';
import { createMerchantSchema, updateMerchantSchema } from '../validators/merchant.validator';
import { sendSuccess, sendError } from '../utils/response';

export async function listMerchants(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchants = await merchantService.getMerchants(true);
    sendSuccess(res, merchants);
  } catch (err) { next(err); }
}

export async function adminListMerchants(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchants = await merchantService.getMerchants(false);
    sendSuccess(res, merchants);
  } catch (err) { next(err); }
}

export async function createMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createMerchantSchema.parse(req.body);
    const merchant = await merchantService.createMerchant(data as Record<string, unknown>);
    sendSuccess(res, merchant, 201, 'Merchant created');
  } catch (err) { next(err); }
}

export async function updateMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateMerchantSchema.parse(req.body);
    const merchant = await merchantService.updateMerchant(req.params.id, data as Record<string, unknown>);
    if (!merchant) { sendError(res, 'Merchant not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, merchant, 200, 'Merchant updated');
  } catch (err) { next(err); }
}

export async function getMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.getMerchantById(req.params.id);
    if (!merchant) { sendError(res, 'Merchant not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, merchant);
  } catch (err) { next(err); }
}

export async function toggleMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.toggleMerchant(req.params.id);
    sendSuccess(res, merchant, 200, 'Merchant status updated');
  } catch (err) { next(err); }
}

export async function deleteMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.deleteMerchant(req.params.id);
    if (!merchant) { sendError(res, 'Merchant not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, { id: req.params.id }, 200, 'Merchant deleted');
  } catch (err) { next(err); }
}