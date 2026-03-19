import { Request, Response, NextFunction } from "express";
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
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

if (!JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN must be set");
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const generateToken = (id: string): string => {
  return (jwt.sign as any)({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const createSession = async (userId: string, sessionToken: string) => {
  await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      sessionToken,
      expires: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { name, email, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        provider: "credential",
        providerAccountId: user.id,
        accessToken: null,
      },
    });

    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, name, verificationToken);

    const token = generateToken(user.id);
    await createSession(user.id, token);

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

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      await sendPasswordResetEmail(email, user.name ?? "there");
    }

    res.status(200).json({
      message:
        "If your email exists in our database, you will receive a password reset link.",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { email: verification.identifier },
      data: { password: hashedPassword },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    next(error);
  }
};

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

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const verificationToken = await createVerificationToken(email);
    await sendVerificationEmail(email, user.name ?? "there", verificationToken);

    res.status(200).json({ message: "Verification email has been sent" });
  } catch (error) {
    next(error);
  }
};

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

        const token = generateToken(user.id);
        await createSession(user.id, token);

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

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("Google login error:", errorBody);
      return res.status(502).json({ message: "Google login failed" });
    }

    const { id_token, access_token } = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
    };

    if (!id_token) {
      return res.status(400).json({ message: "Failed to retrieve ID token" });
    }

    const decoded: any = jwtDecode(id_token);
    const { email, name, email_verified, sub } = decoded;

    if (!email || !name || !email_verified || !sub) {
      return res.status(400).json({ message: "Invalid ID token data" });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const gOAuthCheck = await prisma.account.findFirst({
        where: { userId: user.id, provider: "Google" },
      });

      if (!gOAuthCheck) {
        return res.status(400).json({
          message: "User exists but is not connected with Google",
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name,
          isVerified: email_verified,
          emailVerified: new Date(),
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
    }

    const token = generateToken(user.id);
    await createSession(user.id, token);

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: "Google login successful",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.params;

    const verification = await prisma.verificationToken.findFirst({
      where: { token },
    });

    if (!verification || verification.expires < new Date()) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { email: verification.identifier },
      data: { isVerified: true, emailVerified: new Date() },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

interface AuthenticatedUser {
  id: string;
  email: string;
  password?: string;
}

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const user = req.user as AuthenticatedUser;

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      res.status(400).json({ message: "Authorization token is required" });
      return;
    }

    await prisma.session.deleteMany({
      where: { sessionToken: token },
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

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

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
    });

    if (!session || session.expires < new Date()) {
      return res.status(401).json({ message: "Session not found" });
    }

    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
      if (err || !decoded?.id) {
        return res.status(401).json({ message: "Invalid token" });
      }

      if (session.userId !== decoded.id) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const newToken = generateToken(decoded.id);

      await prisma.session.delete({
        where: { sessionToken: token },
      });

      await createSession(decoded.id, newToken);

      res.status(200).json({ token: newToken });
    });
  } catch (error) {
    next(error);
  }
};

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

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
    });

    if (!session || session.expires < new Date()) {
      return res.status(401).json({ message: "Session not found" });
    }

    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
      if (err || !decoded?.id) {
        return res.status(401).json({ message: "Invalid token" });
      }

      if (session.userId !== decoded.id) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.status(200).json({ valid: true });
    });
  } catch (error) {
    next(error);
  }
};
