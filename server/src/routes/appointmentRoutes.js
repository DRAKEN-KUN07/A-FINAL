import { Router } from 'express';
import {
  approveAppointment,
  cancelAppointment,
  createAppointment,
  listAppointments,
  rejectAppointment,
} from '../controllers/appointmentController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', listAppointments);
router.post('/', createAppointment);
router.patch('/:id/approve', authorize('admin', 'employee', 'security'), approveAppointment);
router.patch('/:id/reject', authorize('admin', 'employee', 'security'), rejectAppointment);
router.patch('/:id/cancel', cancelAppointment);

export default router;
