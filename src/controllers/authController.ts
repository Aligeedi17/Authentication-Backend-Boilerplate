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

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Generate JWT token
const generateToken = (id: string): string => {
  return (jwt.sign as any)({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register a new user
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { name, email, password, confirm_password } = req.body;

    console.log(req.body);

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords dose not match" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        provider: "credential",
        providerAccountId: user.id,
        accessToken: null,
      },
    });

    console.log(user, account);

    // Create verification token and send email
    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, name, verificationToken);

    // Generate session JWT token
    const token = generateToken(user.id);

    // Create a new session
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    console.log("User Created");

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

// Request password reset
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security reasons, don't reveal that the email doesn't exist
      return res.status(200).json({
        message:
          "If your email exists in our database, you will receive a password reset link.",
      });
    }

    // Send password reset email
    await sendPasswordResetEmail(email, user.name);
    console.log("Reset Email Sent");

    res.status(200).json({
      message:
        "If your email exists in our database, you will receive a password reset link.",
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token, password, confirm_password } = req.body;

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords dose not match" });
    }

    // Find verification token
    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user's password
    await prisma.user.update({
      where: { email: verification.identifier },
      data: { password: hashedPassword },
    });

    // Delete verification token
    await prisma.verificationToken.delete({
      where: { token },
    });

    console.log("Password has been reseted");
    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
export const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { email } = req.body;

    // Check if user exists and is not already verified
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Create verification token and send email
    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, user.name, verificationToken);

    res.status(200).json({ message: "Verification email has been sent" });
  } catch (error) {
    next(error);
  }
};

// Login with email and password
export const login = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "local",
    { session: false },
    async (err: any, user: any, info: any) => {
      try {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res
            .status(401)
            .json({ message: info.message || "Authentication failed" });
        }

        if (!user.emailVerified) {
          return res.status(401).json({ message: "Verify your email first" });
        }

        // Generate JWT token
        const token = generateToken(user.id);

        // Create a new session
        await prisma.session.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            sessionToken: token,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        console.log("Get current user", userWithoutPassword);
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

// Google OAuth login callback
export const googleCallback = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  passport.authenticate("google", { session: false }, async (err, user) => {
    try {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ message: "Authentication failed" });
      }

      // Generate JWT token
      const token = generateToken(user.id);

      // Create a new session
      await prisma.session.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          sessionToken: token,
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Redirect to frontend with token
      // You can customize this URL to your frontend app
      res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};

// Google OAuth Login for frontend on a different port
export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { access_token }: { access_token: string } = req.body;

    if (!access_token) {
      return res.status(400).json({ message: "Access token is required" });
    }

    const data = jwtDecode(access_token);

    const { email, name, email_verified, sub } = data as {
      email: string;
      name: string;
      email_verified: boolean;
      sub: string;
    };

    if (
      !data ||
      typeof data !== "object" ||
      !email ||
      !name ||
      !email_verified ||
      !sub
    ) {
      return res.status(400).json({ message: "Invalid access token data" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const gOAuthCheck = await prisma.account.findFirst({
        where: { userId: existingUser.id },
      });

      if (gOAuthCheck.provider === "Google") {
        // If user exists and has a Google account, return existing user
        // Generate session JWT token
        const token = generateToken(existingUser.id);

        // Create a new session
        await prisma.session.create({
          data: {
            userId: existingUser.id,
            sessionToken: token,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
        console.log("Session Created");

        // Remove password from response
        const { password: _, ...userWithoutPassword } = existingUser;

        res.status(201).json({
          message:
            "Registration successful. Please check your email to verify your account.",
          user: userWithoutPassword,
          token,
        });
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        name,
        isVerified: email_verified,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        provider: "Google",
        providerAccountId: sub,
        accessToken: access_token,
      },
    });

    // Generate session JWT token
    const token = generateToken(user.id);

    // Create a new session
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    console.log("User Created");

    // Remove password from response
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
// Verify email
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.params;

    // Find verification token
    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    // Update user's email verification status
    await prisma.user.update({
      where: { email: verification.identifier },
      data: { isVerified: true, emailVerified: new Date() },
    });

    // Delete verification token
    await prisma.verificationToken.delete({
      where: { token },
    });

    console.log("Email is verified");
    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

interface AuthenticatedUser {
  id: string;
  email: string;
  password?: string; // optional, since you want to remove it before sending a response
  // add other fields as needed
}

// Get current user
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // User is attached by passport middleware
    const user = req.user as AuthenticatedUser;

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Remove password from response
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    console.log("Get current user", userWithoutPassword);
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Delete session
    // Note: For JWT tokens, you typically don't invalidate them server-side
    // Instead, client-side should remove the token

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

export const refeshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Generate a new token
      const newToken = generateToken(decoded.id);

      res.status(200).json({ token: newToken });
    });
  } catch (error) {
    next(error);
  }
}
