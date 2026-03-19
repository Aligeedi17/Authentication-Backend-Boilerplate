import nodemailer from 'nodemailer';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT ?? '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const FRONTEND_URL = process.env.FRONTEND_WEBSITE_URL ?? process.env.FRONTEND_URL;
const APP_NAME = process.env.APP_NAME ?? 'App';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

const createEmailTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
    .container { max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; color: #fff; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1a202c; margin-bottom: 20px; }
    .message { font-size: 16px; color: #4a5568; margin-bottom: 30px; line-height: 1.7; }
    .button-container { text-align: center; margin: 40px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none; box-shadow: 0 4px 15px rgba(102,126,234,0.4); transition: transform 0.2s ease; }
    .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102,126,234,0.6); }
    .link-fallback { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 30px 0; }
    .link-text { font-size: 14px; color: #667eea; word-break: break-all; font-family: monospace; }
    .expiry { background: #fef5e7; border-left: 4px solid #f6ad55; padding: 16px 20px; margin: 30px 0; border-radius: 4px; }
    .footer { background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer .brand { font-weight: 600; color: #667eea; }
    .security-note { background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 6px; padding: 20px; margin: 30px 0; }
    @media (max-width: 600px) {
      .container { margin: 10px; border-radius: 8px; }
      .header, .content, .footer { padding: 30px 20px; }
      .header h1 { font-size: 24px; }
      .button { padding: 14px 28px; font-size: 15px; }
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

export const createVerificationToken = async (email: string): Promise<string> => {
  const verificationToken = crypto.randomUUID();
  try {
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return verificationToken;
  } catch (err) {
    console.error('Error creating verification token:', err);
    throw new Error('Failed to create verification token');
  }
};

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
      <div class="button-container"><a href="${verificationLink}" class="button">Verify Email Address</a></div>
      <div class="link-fallback">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <div class="link-text">${verificationLink}</div>
      </div>
      <div class="expiry"><p><strong>⏰ This verification link expires in 24 hours</strong></p></div>
      <div class="security-note"><p><strong>Security Note:</strong> If you didn't create an account with ${APP_NAME}, please ignore this email.</p></div>
    </div>
    <div class="footer"><p>This email was sent by <span class="brand">${APP_NAME}</span></p></div>
  `;

  const textContent = `
Welcome to ${APP_NAME}!

Hello ${name},

Thank you for joining ${APP_NAME}! To verify your email, click the link below:
${verificationLink}

This link expires in 24 hours. If you didn’t request this, just ignore this email.

Best regards,
The ${APP_NAME} Team
`;

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `Welcome to ${APP_NAME} - Verify Your Email`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Verify Your Email - ${APP_NAME}`),
    });
    console.log('Verification email sent:', info.messageId);
  } catch (err) {
    console.error('Error sending verification email:', err);
    throw new Error('Failed to send verification email');
  }
};

export const sendPasswordResetEmail = async (email: string, name: string): Promise<string> => {
  const resetToken = crypto.randomUUID();

  try {
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: resetToken,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;
    const emailContent = `
      <div class="header"><h1>Password Reset Request</h1><p>Secure your account with a new password</p></div>
      <div class="content">
        <div class="greeting">Hello ${name}! 🔒</div>
        <div class="message"><p>We received a password reset request.</p><p>If this wasn’t you, ignore this email.</p></div>
        <div class="button-container"><a href="${resetLink}" class="button">Reset My Password</a></div>
        <div class="link-fallback"><p>If the button fails, paste this link into your browser:</p><div class="link-text">${resetLink}</div></div>
        <div class="expiry"><p><strong>⏰ This reset link expires in 1 hour</strong></p></div>
        <div class="security-note"><p><strong>Reminder:</strong> Don’t share your password. ${APP_NAME} will not ask for it via email.</p></div>
      </div>
      <div class="footer"><p>This email was sent by <span class="brand">${APP_NAME}</span></p></div>
    `;

    const textContent = `
Password Reset Request - ${APP_NAME}

Hello ${name},

To reset your password, click here:
${resetLink}

This link expires in 1 hour. Ignore this email if you didn’t request it.

– The ${APP_NAME} Team
`;

    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `${APP_NAME} - Password Reset Request`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Password Reset - ${APP_NAME}`),
    });
    console.log('Password reset email sent:', info.messageId);
    return resetToken;
  } catch (err) {
    console.error('Error sending password reset email:', err);
    throw new Error('Failed to send password reset email');
  }
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const dashboardLink = `${FRONTEND_URL}/dashboard`;
  const emailContent = `
    <div class="header"><h1>Welcome to ${APP_NAME}! 🎉</h1><p>Your account is now active</p></div>
    <div class="content">
      <div class="greeting">Congratulations ${name}!</div>
      <div class="message"><p>Your account is verified and ready.</p><p>Get started with:</p></div>
      <div class="button-container"><a href="${dashboardLink}" class="button">Go to Dashboard</a></div>
      <div class="security-note"><ul style="color:#4a5568; padding-left:20px; margin:10px 0;">
        <li>Complete your profile</li><li>Explore features</li><li>Contact support if needed</li>
      </ul></div>
    </div>
    <div class="footer"><p>Welcome to the <span class="brand">${APP_NAME}</span> community!</p></div>
  `;

  const textContent = `
Welcome to ${APP_NAME}!

Hi ${name},

Your account is now active. Start exploring here:
${dashboardLink}

Tips:
- Complete your profile
- Explore features
- Reach out if you need help

– The ${APP_NAME} Team
`;

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM}>`,
      to: email,
      subject: `🎉 Welcome to ${APP_NAME}!`,
      text: textContent,
      html: createEmailTemplate(emailContent, `Welcome to ${APP_NAME}`),
    });
    console.log('Welcome email sent:', info.messageId);
  } catch (err) {
    console.error('Error sending welcome email:', err);
    throw new Error('Failed to send welcome email');
  }
};
