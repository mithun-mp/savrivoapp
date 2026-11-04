import { Router } from 'express';
import {
  adminListProducts,
  adminGetProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  refreshProductData,
} from '../../controllers/product.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', adminListProducts);
router.get('/:id', adminGetProduct);
router.post('/', createProduct);
router.post('/:slug/refresh', refreshProductData);
router.patch('/:id', updateProduct);
router.delete('/:id', deleteProduct);
export default router;
