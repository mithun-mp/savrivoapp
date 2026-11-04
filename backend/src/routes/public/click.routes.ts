import { Router } from 'express';
import { handleOfferRedirect, handleTrackClick } from '../../controllers/click.controller';

const router = Router();

// GET /api/click/:offerId — Direct redirect to verified affiliate URL with click recording
router.get('/:offerId', handleOfferRedirect);

// POST /api/click/track — JSON click tracking
router.post('/track', handleTrackClick);

export default router;

