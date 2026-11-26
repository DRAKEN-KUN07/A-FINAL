import { Router } from 'express';
import { exportReports, getDashboardStats, getReports } from '../controllers/dashboardController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/reports', authorize('admin', 'security', 'employee'), getReports);
router.get('/export', authorize('admin', 'security', 'employee'), exportReports);

export default router;
