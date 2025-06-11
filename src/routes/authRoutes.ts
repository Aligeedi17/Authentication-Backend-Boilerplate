import express from 'express';
import passport from 'passport';
import {
  register,
  login,
  googleCallback,
  verifyEmail,
  getCurrentUser,
  logout,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  googleLogin,
  refeshToken
} from '@/controllers/authController';

const router = express.Router();

// Register new user
router.post('/register', register);

// Login with email and password
router.post('/login', login);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', googleCallback);
router.post('/google/login', googleLogin);

// Email verification
router.post('/verify/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Password reset - rename for consistency with frontend
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

router.post('refresh-token', refeshToken);

// Protected routes
router.get(
  '/me',
  passport.authenticate('jwt', { session: false }),
  getCurrentUser
);

// Logout
router.post('/logout', logout);

export default router;