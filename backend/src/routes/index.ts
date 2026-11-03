import { Router } from 'express';
import healthRoutes from './public/health.routes';
import productRoutes from './public/products.routes';
import categoryRoutes from './public/categories.routes';
import merchantRoutes from './public/merchants.routes';
import guideRoutes from './public/guides.routes';
import searchRoutes from './public/search.routes';
import offerRoutes from './public/offers.routes';
import adminAuthRoutes from './admin/auth.routes';
import adminProductRoutes from './admin/products.routes';
import adminCategoryRoutes from './admin/categories.routes';
import adminMerchantRoutes from './admin/merchants.routes';
import adminOfferRoutes from './admin/offers.routes';
import adminGuideRoutes from './admin/guides.routes';
import adminSettingsRoutes from './admin/settings.routes';
import adminDashboardRoutes from './admin/dashboard.routes';
import adminProductImportRoutes from '../modules/product-import/product-import.routes';

const router = Router();

// Public routes
router.use('/health', healthRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/merchants', merchantRoutes);
router.use('/guides', guideRoutes);
router.use('/search', searchRoutes);
router.use('/offers', offerRoutes);

// Admin routes
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/merchants', adminMerchantRoutes);
router.use('/admin/offers', adminOfferRoutes);
router.use('/admin/guides', adminGuideRoutes);
router.use('/admin/settings', adminSettingsRoutes);
router.use('/admin/product-import', adminProductImportRoutes);

export default router;