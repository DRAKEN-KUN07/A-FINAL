import { Router } from 'express';
import {
  createPass,
  downloadPassPdf,
  getPassById,
  getPublicPassPreview,
  listPasses,
  revokePass,
} from '../controllers/passController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.get('/public/:passCode', getPublicPassPreview);

router.use(protect);

router.get('/', listPasses);
router.post('/', authorize('admin', 'security', 'employee'), createPass);
router.get('/:id', getPassById);
router.get('/:id/pdf', downloadPassPdf);
router.patch('/:id/revoke', authorize('admin', 'security', 'employee'), revokePass);

export default router;
