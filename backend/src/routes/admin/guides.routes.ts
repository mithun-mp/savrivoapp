import { Router } from 'express';
import {
  adminListGuides,
  adminGetGuide,
  createGuide,
  updateGuide,
  deleteGuide,
} from '../../controllers/guide.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', adminListGuides);
router.get('/:id', adminGetGuide);
router.post('/', createGuide);
router.patch('/:id', updateGuide);
router.delete('/:id', deleteGuide);
export default router;