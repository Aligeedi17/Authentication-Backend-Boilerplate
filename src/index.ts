import express from "express";
import bodyParser from "body-parser";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";

import dotenv from "dotenv";
import passport from "@/config/passport";
import authRoutes from '@/routes/authRoutes';

// Load environment variables from .env file
dotenv.config();

// Retrieve environment configuration
const apiURL = process.env.API_WEBSITE_URL;
const Port = process.env.PORT;

// Initialize Express application
const app = express();

/**
 * Middleware Configuration
 * 
 * These middleware functions enhance security, performance, and request handling
 * They process incoming requests before reaching route handlers
 */

// Parse JSON bodies (replaces body-parser.json() in modern Express)
app.use(express.json());

// Parse cookies for authentication tokens
app.use(cookieParser());

// Enable response compression for performance
app.use(compression());

// Parse JSON bodies (alternative method, express.json() is preferred)
app.use(bodyParser.json());

/**
 * CORS Configuration
 * 
 * Restricts cross-origin requests to approved frontend URL
 * Enables credentials for authentication cookies
 */
app.use(
  cors({
    origin: process.env.FRONTEND_WEBSITE_URL, // Whitelisted origin
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'] // Allowed request headers
  })
);

// Parse URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// Initialize Passport authentication middleware
app.use(passport.initialize());

/**
 * Route Configuration
 * 
 * Mounts authentication routes under /api/auth base path
 */
app.use('/api/auth', authRoutes);

/**
 * Error Handling Middleware
 * 
 * Centralized error handling for all routes
 * - Logs error details
 * - Returns appropriate HTTP status
 * - Provides error details in development mode
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

/**
 * Server Initialization
 * 
 * Starts listening on configured port
 * Logs server status to console
 */
app.listen(Port, () => {
  console.log(`🚀 Server running at ${apiURL} on port ${Port}`);
  console.log(`🔒 Authentication endpoints available at ${apiURL}/api/auth`);
  
  // Environment information
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛡️  CORS Origin: ${process.env.FRONTEND_WEBSITE_URL}`);
});