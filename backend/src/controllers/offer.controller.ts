import type { Request, Response, NextFunction } from 'express';
import * as offerService from '../services/offer.service';
import { createOfferSchema, updateOfferSchema } from '../validators/offer.validator';
import { sendSuccess, sendError } from '../utils/response';

export async function getOffersForProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offers = await offerService.getOffersByProduct(req.params.productId);
    sendSuccess(res, offers);
  } catch (err) { next(err); }
}

export async function listOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.productId) filter.productId = req.query.productId;
    const offers = await offerService.getAllOffers(filter);
    sendSuccess(res, offers);
  } catch (err) { next(err); }
}

export async function createOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createOfferSchema.parse(req.body);
    const offer = await offerService.createOffer(data as Record<string, unknown>);
    sendSuccess(res, offer, 201, 'Offer created');
  } catch (err) { next(err); }
}

export async function updateOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateOfferSchema.parse(req.body);
    const offer = await offerService.updateOffer(req.params.id, data as Record<string, unknown>);
    if (!offer) { sendError(res, 'Offer not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, offer, 200, 'Offer updated');
  } catch (err) { next(err); }
}

export async function getOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offer = await offerService.getOfferById(req.params.id);
    if (!offer) { sendError(res, 'Offer not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, offer);
  } catch (err) { next(err); }
}

export async function expireOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offer = await offerService.expireOffer(req.params.id);
    if (!offer) { sendError(res, 'Offer not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, offer, 200, 'Offer expired');
  } catch (err) { next(err); }
}

export async function deleteOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offer = await offerService.deleteOffer(req.params.id);
    if (!offer) { sendError(res, 'Offer not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, { id: req.params.id }, 200, 'Offer deleted');
  } catch (err) { next(err); }
}