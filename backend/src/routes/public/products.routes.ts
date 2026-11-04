import { Router } from 'express';
import { listProducts, getProduct, refreshProductData } from '../../controllers/product.controller';
import { refreshIpRateLimiter, productRefreshGuard } from '../../middleware/refreshLimiter';

const router = Router();
router.get('/', listProducts);
router.get('/:slug', getProduct);
router.post('/:slug/refresh', refreshIpRateLimiter, productRefreshGuard, refreshProductData);

export default router;
