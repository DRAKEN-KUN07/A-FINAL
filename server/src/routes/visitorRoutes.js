import { Router } from 'express';
import {
  createVisitor,
  getVisitorById,
  listVisitors,
  toggleVisitorBlacklist,
  updateVisitor,
} from '../controllers/visitorController.js';
import { authorize, protect } from '../middleware/auth.js';
import { uploadVisitorPhoto } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.get('/', listVisitors);
router.post('/', uploadVisitorPhoto.single('photo'), createVisitor);
router.get('/:id', getVisitorById);
router.put('/:id', uploadVisitorPhoto.single('photo'), updateVisitor);
router.patch('/:id/blacklist', authorize('admin', 'security'), toggleVisitorBlacklist);

export default router;
