import type { Request, Response, NextFunction } from 'express';
import { trackOfferClick } from '../services/click.service';
import { sendSuccess, sendError } from '../utils/response';

export async function handleOfferRedirect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const offerId = req.params.offerId;
    const campaign = (req.query.campaign as string) || (req.query.ref as string);
    const referrer = req.headers.referer || req.headers.referrer as string;
    const userAgent = req.headers['user-agent'];
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    const result = await trackOfferClick({
      offerId,
      referrer,
      userAgent,
      clientIp,
      campaign,
    });

    if (!result.success || !result.targetUrl) {
      if (req.accepts('json')) {
        sendError(res, result.error || 'Offer not found or unavailable', 404, 'OFFER_UNAVAILABLE');
        return;
      }
      // Safe fallback redirect to frontend
      res.redirect(302, '/');
      return;
    }

    // Set cache & security headers before external affiliate redirect
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');

    res.redirect(302, result.targetUrl);
  } catch (err) {
    next(err);
  }
}

export async function handleTrackClick(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { offerId, campaign } = req.body || {};
    const referrer = req.headers.referer || req.headers.referrer as string;
    const userAgent = req.headers['user-agent'];
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    const result = await trackOfferClick({
      offerId,
      referrer,
      userAgent,
      clientIp,
      campaign,
    });

    if (!result.success) {
      sendError(res, result.error || 'Offer tracking failed', 400, 'TRACKING_FAILED');
      return;
    }

    sendSuccess(res, { targetUrl: result.targetUrl }, 200, 'Click recorded successfully');
  } catch (err) {
    next(err);
  }
}

