import { Router } from 'express';
import {
  listOffers,
  getOffer,
  createOffer,
  updateOffer,
  expireOffer,
  deleteOffer,
} from '../../controllers/offer.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/', listOffers);
router.get('/:id', getOffer);
router.post('/', createOffer);
router.patch('/:id', updateOffer);
router.post('/:id/expire', expireOffer);
router.delete('/:id', deleteOffer);
export default router;