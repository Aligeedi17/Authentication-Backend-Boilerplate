import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import passport from "passport";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  createVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/services/emailService";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

// Initialize Prisma ORM client for database operations
const prisma = new PrismaClient();

// Retrieve JWT configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

/**
 * Generates a JWT token for user authentication
 * @param id - User ID to include in token payload
 * @returns Signed JWT token string
 */
const generateToken = (id: string): string => {
  return (jwt.sign as any)({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};


/**
 * Registers a new user account
 * - Validates password match
 * - Checks for existing user
 * - Hashes password
 * - Creates user record
 * - Sends verification email
 * - Creates session
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { name, email, password, confirm_password } = req.body;

    // Validate password confirmation
    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check for existing user with same email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Securely hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user record
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Create associated account record
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        provider: "credential",
        providerAccountId: user.id,
        accessToken: null,
      },
    });

    // Create and send verification email
    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, name, verificationToken);

    // Generate JWT for session management
    const token = generateToken(user.id);

    // Create persistent session record
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Sanitize user object before sending response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message:
        "Registration successful. Please check your email to verify your account.",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiates password reset process
 * - Checks if user exists (without revealing status)
 * - Sends password reset email
 */
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { email } = req.body;

    // Security: Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Send password reset instructions if user exists
      await sendPasswordResetEmail(email, user.name);
    }

    res.status(200).json({
      message:
        "If your email exists in our database, you will receive a password reset link.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resets user password using verification token
 * - Validates token expiration
 * - Updates password hash
 * - Deletes used token
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token, password, confirm_password } = req.body;

    // Validate password confirmation
    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Find valid non-expired token
    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token" });
    }

    // Generate new password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password
    await prisma.user.update({
      where: { email: verification.identifier },
      data: { password: hashedPassword },
    });

    // Delete consumed token
    await prisma.verificationToken.delete({
      where: { token },
    });

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Resends email verification link
 * - Validates user existence and verification status
 * - Regenerates and sends verification token
 */
export const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent unnecessary resends
    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Create and send new verification token
    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, user.name, verificationToken);

    res.status(200).json({ message: "Verification email has been sent" });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticates user with email/password
 * - Uses Passport local strategy
 * - Verifies email confirmation status
 * - Creates session
 */
export const login = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "local",
    { session: false },
    async (err: any, user: any, info: any) => {
      try {
        if (err) {
          return next(err);
        }

        // Handle authentication failure
        if (!user) {
          return res
            .status(401)
            .json({ message: info.message || "Authentication failed" });
        }

        // Require email verification
        if (!user.emailVerified) {
          return res.status(401).json({ message: "Verify your email first" });
        }

        // Generate session token
        const token = generateToken(user.id);

        // Create session record
        await prisma.session.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            sessionToken: token,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // Sanitize user data
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
          message: "Login successful",
          user: userWithoutPassword,
          token,
        });
      } catch (error) {
        next(error);
      }
    }
  )(req, res, next);
};

/**
 * Handles Google OAuth2 authentication flow
 * - Exchanges authorization code for tokens
 * - Validates ID token
 * - Creates or updates user account
 * - Establishes session
 */
export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { code } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ message: "Authorization code is required" });
    }

    // Exchange code for access/ID tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }
    );

    const { id_token, access_token } = tokenResponse.data;

    if (!id_token) {
      return res.status(400).json({ message: "Failed to retrieve ID token" });
    }

    // Decode and validate ID token
    const decoded: any = jwtDecode(id_token);
    const { email, name, email_verified, sub } = decoded;

    if (!email || !name || !email_verified || !sub) {
      return res.status(400).json({ message: "Invalid ID token data" });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Verify Google account association
      const gOAuthCheck = await prisma.account.findFirst({
        where: { userId: user.id, provider: "Google" },
      });

      if (!gOAuthCheck) {
        return res.status(400).json({
          message: "User exists but is not connected with Google",
        });
      }
    } else {
      // Create new user from Google profile
      user = await prisma.user.create({
        data: {
          email,
          name,
          isVerified: email_verified,
          emailVerified: new Date(),
        },
      });

      // Link Google account
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: "Google",
          providerAccountId: sub,
          accessToken: access_token,
        },
      });
    }

    // Generate session token
    const token = generateToken(user.id);

    // Create session record
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Sanitize response
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: "Google login successful",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("Google login error:", error.response?.data || error);
    res.status(500).json({ message: "Google login failed" });
  }
};

/**
 * Verifies user email using token
 * - Checks token validity
 * - Updates verification status
 * - Deletes consumed token
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.params;

    // Validate verification token
    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    // Mark email as verified
    await prisma.user.update({
      where: { email: verification.identifier },
      data: { isVerified: true, emailVerified: new Date() },
    });

    // Remove used token
    await prisma.verificationToken.delete({
      where: { token },
    });

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

// Type definition for authenticated user objects
interface AuthenticatedUser {
  id: string;
  email: string;
  password?: string;
  // Additional user properties as needed
}

/**
 * Retrieves current authenticated user
 * - Requires valid session
 * - Returns sanitized user data
 */
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // User attached by Passport authentication middleware
    const user = req.user as AuthenticatedUser;

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Sanitize response
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

/**
 * Placeholder for logout functionality
 * (Actual session invalidation would be implemented here)
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Note: Actual session destruction would happen here
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Refreshes JWT token
 * - Validates existing token
 * - Issues new token with extended expiration
 * - Updates session record
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify and decode existing token
    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Validate user existence
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Generate new token
      const newToken = generateToken(decoded.id);

      // Replace session token
      await prisma.session.delete({ 
        where: { 
          sessionToken: token,
          userId: decoded.id
        }
      });

      await prisma.session.create({
        data: {
          userId: decoded.id,
          sessionToken: newToken,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      res.status(200).json({ token: newToken });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validates JWT token authenticity
 * - Checks token signature
 * - Verifies user existence
 * - Confirms session record
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify token signature
    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
      if (err || !decoded?.id) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Check user existence
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Validate session record
      const session = await prisma.session.findUnique({
        where: {
          sessionToken: token,
          userId: decoded.id
        }
      });

      if (!session) {
        return res.status(401).json({ message: "Session not found" });
      }

      res.status(200).json({ valid: true });
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};