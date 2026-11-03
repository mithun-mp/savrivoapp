import { Router } from 'express';
import {
  previewProduct,
  bulkPreviewProducts,
  saveDraftProduct,
  publishProduct,
  getImportDiagnostics,
} from './product-import.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Protect all AI product import routes with admin authentication
router.use(requireAuth);

router.post('/preview', previewProduct);
router.post('/bulk-preview', bulkPreviewProducts);
router.post('/save-draft', saveDraftProduct);
router.post('/publish', publishProduct);
router.get('/diagnostics', getImportDiagnostics);

export default router;

