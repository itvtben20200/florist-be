import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
  autologin,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/autologin', autologin);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);

export default router;
