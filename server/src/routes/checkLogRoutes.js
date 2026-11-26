import { Router } from 'express';
import { listCheckLogs, scanAndProcessPass } from '../controllers/checkLogController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', authorize('admin', 'security', 'employee'), listCheckLogs);
router.post('/scan', authorize('admin', 'security'), scanAndProcessPass);

export default router;
