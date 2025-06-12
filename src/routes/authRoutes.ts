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

/**
 * Authentication Routes
 * 
 * Defines endpoints for user authentication and account management
 * Organized into public routes (no authentication) and protected routes
 */

// ======================
// Public Routes (No Authentication Required)
// ======================

/**
 * POST /register
 * Creates a new user account
 * @see authController.register
 */
router.post('/register', register);

/**
 * POST /login
 * Authenticates user with email/password credentials
 * @see authController.login
 */
router.post('/login', login);

/**
 * POST /google/login
 * Authenticates user using Google OAuth2 flow
 * @see authController.googleLogin
 */
router.post('/google/login', googleLogin);

/**
 * POST /verify/:token
 * Verifies user's email using token from verification email
 * @see authController.verifyEmail
 */
router.post('/verify/:token', verifyEmail);

/**
 * POST /resend-verification
 * Resends email verification link to unverified users
 * @see authController.resendVerificationEmail
 */
router.post('/resend-verification', resendVerificationEmail);

/**
 * POST /request-password-reset
 * Initiates password reset process (sends reset email)
 * @see authController.requestPasswordReset
 */
router.post('/request-password-reset', requestPasswordReset);

/**
 * POST /reset-password
 * Completes password reset process using token from email
 * @see authController.resetPassword
 */
router.post('/reset-password', resetPassword);

/**
 * POST /refresh-token
 * Generates new access token using valid refresh token
 * @see authController.refreshToken
 */
router.post('/refresh-token', refreshToken);

/**
 * POST /verify-token
 * Validates JWT token authenticity and session status
 * @see authController.verifyToken
 */
router.post('/verify-token', verifyToken);

// ======================
// Protected Routes (Require JWT Authentication)
// ======================

/**
 * GET /me
 * Retrieves current authenticated user's profile
 * 
 * Security: Protected with JWT authentication strategy
 * Middleware: passport.authenticate('jwt')
 * @see authController.getCurrentUser
 */
router.get(
  '/me',
  passport.authenticate('jwt', { session: false }),
  getCurrentUser
);

/**
 * POST /logout
 * Terminates user session (placeholder implementation)
 * Note: Actual session invalidation should be implemented
 * @see authController.logout
 */
router.post('/logout', logout);

export default router;