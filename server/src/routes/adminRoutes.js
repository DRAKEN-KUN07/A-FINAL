import { Router } from 'express';
import {
  addOrganizationLocation,
  createOrganization,
  createUser,
  listAuditLogs,
  listHosts,
  listNotificationLogs,
  listOrganizations,
  listUsers,
  updateOrganization,
  updateUser,
} from '../controllers/adminController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/hosts', listHosts);
router.get('/organizations', listOrganizations);
router.post('/organizations', authorize('admin'), createOrganization);
router.patch('/organizations/:id', authorize('admin'), updateOrganization);
router.post('/organizations/:id/locations', authorize('admin'), addOrganizationLocation);

router.get('/users', authorize('admin'), listUsers);
router.post('/users', authorize('admin'), createUser);
router.patch('/users/:id', authorize('admin'), updateUser);

router.get('/notifications', authorize('admin', 'security', 'employee'), listNotificationLogs);
router.get('/audit-logs', authorize('admin'), listAuditLogs);

export default router;
