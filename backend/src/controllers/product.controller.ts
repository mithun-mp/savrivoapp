import type { Request, Response, NextFunction } from 'express';
import * as productService from '../services/product.service';
import { defaultMerchantRefreshService } from '../services/merchant-refresh.service';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';
import { sendSuccess, sendError } from '../utils/response';

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { products, total, page, limit } = await productService.getProducts(req.query);
    sendSuccess(res, products, 200, undefined, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    if (!product) { sendError(res, 'Product not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, product);
  } catch (err) { next(err); }
}

export async function refreshProductData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await defaultMerchantRefreshService.refreshProductOffers(req.params.slug);
    if (!result.success || !result.product) {
      sendError(res, 'Product not found', 404, 'NOT_FOUND');
      return;
    }
    sendSuccess(
      res,
      {
        product: result.product,
        offers: result.offers,
        refreshedCount: result.refreshedCount,
        warnings: result.warnings,
      },
      200,
      'Product merchant data refreshed'
    );
  } catch (err) { next(err); }
}

export async function adminGetProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) { sendError(res, 'Product not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, product);
  } catch (err) { next(err); }
}

export async function adminListProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { products, total, page, limit } = await productService.getAdminProducts(req.query);
    sendSuccess(res, products, 200, undefined, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await productService.createProduct(data as Record<string, unknown>);
    sendSuccess(res, product, 201, 'Product created');
  } catch (err) { next(err); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(req.params.id, data as Record<string, unknown>);
    if (!product) { sendError(res, 'Product not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, product, 200, 'Product updated');
  } catch (err) { next(err); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) { sendError(res, 'Product not found', 404, 'NOT_FOUND'); return; }
    sendSuccess(res, product, 200, 'Product archived');
  } catch (err) { next(err); }
}
