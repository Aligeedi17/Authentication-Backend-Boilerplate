import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Load environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const APP_NAME = process.env.APP_NAME || 'AuthBoilerplate';

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Email template wrapper
const createEmailTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f8fafc;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 300;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #1a202c;
            margin-bottom: 20px;
        }
        
        .message {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.7;
        }
        
        .button-container {
            text-align: center;
            margin: 40px 0;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        
        .link-fallback {
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .link-fallback p {
            font-size: 14px;
            color: #718096;
            margin-bottom: 10px;
        }
        
        .link-text {
            font-size: 14px;
            color: #667eea;
            word-break: break-all;
            font-family: monospace;
        }
        
        .expiry {
            background-color: #fef5e7;
            border-left: 4px solid #f6ad55;
            padding: 16px 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        
        .expiry p {
            font-size: 14px;
            color: #c05621;
            margin: 0;
        }
        
        .footer {
            background-color: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer p {
            font-size: 14px;
            color: #718096;
            margin-bottom: 10px;
        }
        
        .footer .brand {
            font-weight: 600;
            color: #667eea;
        }
        
        .security-note {
            background-color: #edf2f7;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .security-note p {
            font-size: 14px;
            color: #4a5568;
            margin: 0;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            
            .header,
            .content,
            .footer {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .button {
                padding: 14px 28px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>
`;

// Generate verification token and store it
export const createVerificationToken = async (email: string): Promise<string> => {
  // Generate a random token
  const verificationToken = crypto.randomUUID();
  
  try {
    // Delete any existing verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });
    
    // Create a new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    
    return verificationToken;
  } catch (error) {
    console.error('Error creating verification token:', error);
    throw new Error('Failed to create verification token');
  }
};

// Send verification email
export const sendVerificationEmail = async (email: string, name: string, token: string): Promise<void> => {
  const verificationLink = `${FRONTEND_URL}/verify-email/${token}`;
  
  const emailContent = `
    <div class="header">
        <h1>Welcome to ${APP_NAME}!</h1>
        <p>Verify your email to get started</p>
    </div>
    
    <div class="content">
        <div class="greeting">Hello ${name}! 👋</div>
        
        <div class="message">
            <p>Thank you for joining ${APP_NAME}! We're excited to have you on board.</p>
            <p>To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
        </div>
        
        <div class="button-container">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
        </div>
        
        <div class="link-fallback">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <div class="link-text">${verificationLink}</div>
        </div>
        
        <div class="expiry">
            <p><strong>⏰ This verification link expires in 24 hours</strong></p>
        </div>
        
        <div class="security-note">
            <p><strong>Security Note:</strong> If you didn't create an account with ${APP_NAME}, please ignore this email. Your security is important to us.</p>
        </div>
    </div>
    
    <div class="footer">
        <p>This email was sent by <span class="brand">${APP_NAME}</span></p>
        <p>If you have any questions, feel free to contact our support team.</p>
    </div>
  `;
  
  // Plain text alternative
  const textContent = `
Welcome to ${APP_NAME}!

Hello ${name},

Thank you for joining ${APP_NAME}! We're excited to have you on board.

To complete your registration and secure your account, please verify your email address by clicking the link below:

${verificationLink}

This verification link expires in 24 hours.

If you didn't create an account with ${APP_NAME}, please ignore this email. Your security is important to us.

Best regards,
The ${APP_NAME} Team

---
This email was sent by ${APP_NAME}
If you have any questions, feel free to contact our support team.
  `;
  
  try {
    // Send email
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `Welcome to ${APP_NAME} - Verify Your Email`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Verify Your Email - ${APP_NAME}`),
    });
    
    console.log('Verification email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, name: string): Promise<string> => {
  // Generate a token
  const resetToken = crypto.randomUUID();
  
  try {
    // Delete any existing verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { 
        identifier: email,
      },
    });
    
    // Create a new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: resetToken,
        expires: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
      },
    });
    
    const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;
    
    const emailContent = `
      <div class="header">
          <h1>Password Reset Request</h1>
          <p>Secure your account with a new password</p>
      </div>
      
      <div class="content">
          <div class="greeting">Hello ${name}! 🔒</div>
          
          <div class="message">
              <p>We received a request to reset your password for your ${APP_NAME} account.</p>
              <p>If you made this request, click the button below to create a new password. If you didn't request this, you can safely ignore this email.</p>
          </div>
          
          <div class="button-container">
              <a href="${resetLink}" class="button">Reset My Password</a>
          </div>
          
          <div class="link-fallback">
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <div class="link-text">${resetLink}</div>
          </div>
          
          <div class="expiry">
              <p><strong>⏰ This reset link expires in 1 hour for security</strong></p>
          </div>
          
          <div class="security-note">
              <p><strong>Security Reminder:</strong> Never share your password with anyone. ${APP_NAME} will never ask for your password via email.</p>
          </div>
      </div>
      
      <div class="footer">
          <p>This email was sent by <span class="brand">${APP_NAME}</span></p>
          <p>If you have any security concerns, please contact our support team immediately.</p>
      </div>
    `;
    
    // Plain text alternative
    const textContent = `
Password Reset Request - ${APP_NAME}

Hello ${name},

We received a request to reset your password for your ${APP_NAME} account.

If you made this request, click the link below to create a new password:
${resetLink}

This reset link expires in 1 hour for security.

If you didn't request a password reset, you can safely ignore this email.

Security Reminder: Never share your password with anyone. ${APP_NAME} will never ask for your password via email.

Best regards,
The ${APP_NAME} Team

---
This email was sent by ${APP_NAME}
If you have any security concerns, please contact our support team immediately.
    `;
    
    // Send email
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `${APP_NAME} - Password Reset Request`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Password Reset - ${APP_NAME}`),
    });
    
    console.log('Password reset email sent:', info.messageId);
    return resetToken;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send welcome email after successful verification
export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const dashboardLink = `${FRONTEND_URL}/dashboard`;
  
  const emailContent = `
    <div class="header">
        <h1>Welcome to ${APP_NAME}! 🎉</h1>
        <p>Your account is now active and ready to use</p>
    </div>
    
    <div class="content">
        <div class="greeting">Congratulations ${name}!</div>
        
        <div class="message">
            <p>Your email has been successfully verified and your ${APP_NAME} account is now fully activated.</p>
            <p>You're all set to explore everything we have to offer. Get started by accessing your dashboard:</p>
        </div>
        
        <div class="button-container">
            <a href="${dashboardLink}" class="button">Go to Dashboard</a>
        </div>
        
        <div class="security-note">
            <p><strong>Getting Started Tips:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #4a5568;">
                <li>Complete your profile to personalize your experience</li>
                <li>Explore the features and settings</li>
                <li>Don't hesitate to reach out if you need help</li>
            </ul>
        </div>
    </div>
    
    <div class="footer">
        <p>Welcome to the <span class="brand">${APP_NAME}</span> community!</p>
        <p>Need help getting started? Contact our support team anytime.</p>
    </div>
  `;
  
  const textContent = `
Welcome to ${APP_NAME}!

Congratulations ${name}!

Your email has been successfully verified and your ${APP_NAME} account is now fully activated.

You're all set to explore everything we have to offer. Get started by accessing your dashboard:
${dashboardLink}

Getting Started Tips:
- Complete your profile to personalize your experience
- Explore the features and settings  
- Don't hesitate to reach out if you need help

Welcome to the ${APP_NAME} community!
Need help getting started? Contact our support team anytime.

Best regards,
The ${APP_NAME} Team
  `;
  
  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `🎉 Welcome to ${APP_NAME} - You're All Set!`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Welcome to ${APP_NAME}`),
    });
    
    console.log('Welcome email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};