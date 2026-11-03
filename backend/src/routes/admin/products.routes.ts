import { Router } from 'express';
import {
  adminListProducts,
  adminGetProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../controllers/product.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', adminListProducts);
router.get('/:id', adminGetProduct);
router.post('/', createProduct);
router.patch('/:id', updateProduct);
router.delete('/:id', deleteProduct);
export default router;