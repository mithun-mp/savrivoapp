import { Router } from 'express';
import {
  adminListCategories,
  adminGetCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../controllers/category.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', adminListCategories);
router.get('/:id', adminGetCategory);
router.post('/', createCategory);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);
export default router;