import express from 'express';
import passport from 'passport';
import {
  register,
  login,
  verifyEmail,
  getCurrentUser,
  logout,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  googleLogin,
  refreshToken,
  verifyToken
} from '@/controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google/login', googleLogin);
router.post('/verify/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/verify-token', verifyToken);

router.get(
  '/me',
  passport.authenticate('jwt', { session: false }),
  getCurrentUser
);

router.post(
  '/logout',
  passport.authenticate('jwt', { session: false }),
  logout
);

export default router;
