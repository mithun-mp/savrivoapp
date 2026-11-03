import { Router } from 'express';
import {
  adminListMerchants,
  getMerchant,
  createMerchant,
  updateMerchant,
  toggleMerchant,
  deleteMerchant,
} from '../../controllers/merchant.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', adminListMerchants);
router.get('/:id', getMerchant);
router.post('/', createMerchant);
router.patch('/:id', updateMerchant);
router.post('/:id/toggle', toggleMerchant);
router.delete('/:id', deleteMerchant);
export default router;