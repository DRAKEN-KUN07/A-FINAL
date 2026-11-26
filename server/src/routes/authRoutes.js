import { Router } from 'express';
import {
  getMe,
  getPublicDirectory,
  login,
  register,
  requestOtp,
  verifyOtpCode,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/directory', getPublicDirectory);
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtpCode);

export default router;
