import { Router } from 'express';
import { getOffersForProduct, listOffers } from '../../controllers/offer.controller';

const router = Router();

router.get('/', (req, res, next) => {
  if (req.query.productId) {
    req.params = { ...req.params, productId: String(req.query.productId) };
    return getOffersForProduct(req, res, next);
  }
  return listOffers(req, res, next);
});

router.get('/product/:productId', getOffersForProduct);

export default router;
