import type { Request, Response, NextFunction } from 'express';
import { defaultProductImportService } from './product-import.service';
import {
  previewUrlSchema,
  bulkPreviewUrlsSchema,
  saveDraftProductSchema,
  publishProductSchema,
} from './product-import.types';
import { sendSuccess, sendError } from '../../utils/response';
import { SsrfError } from './ssrf-guard';

export async function previewProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url } = previewUrlSchema.parse(req.body);
    const result = await defaultProductImportService.previewProduct(url);
    sendSuccess(res, result, 200, 'Product extracted and enriched successfully');
  } catch (err: unknown) {
    if (err instanceof SsrfError) {
      sendError(res, (err as Error).message, 400, 'SSRF_VALIDATION_FAILED');
      return;
    }
    next(err);
  }
}

export async function bulkPreviewProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { urls } = bulkPreviewUrlsSchema.parse(req.body);
    const results = await defaultProductImportService.bulkPreview(urls);
    sendSuccess(res, results, 200, `Processed ${results.length} URLs`);
  } catch (err: unknown) {
    next(err);
  }
}

export async function saveDraftProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = saveDraftProductSchema.parse(req.body);
    const result = await defaultProductImportService.saveProduct(data, 'draft');
    sendSuccess(res, result, 201, 'Product saved as draft');
  } catch (err: unknown) {
    next(err);
  }
}

export async function publishProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = publishProductSchema.parse(req.body);
    const result = await defaultProductImportService.saveProduct(data, 'published');
    sendSuccess(res, result, 201, 'Product published successfully');
  } catch (err: unknown) {
    next(err);
  }
}

export async function getImportDiagnostics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const diagnostics = defaultProductImportService.getDiagnostics();
    sendSuccess(res, diagnostics, 200, 'Gemini key diagnostics');
  } catch (err: unknown) {
    next(err);
  }
}

