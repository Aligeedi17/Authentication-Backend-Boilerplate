import express from "express";
import bodyParser from "body-parser";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import passport from "@/config/passport";
import authRoutes from '@/routes/authRoutes';

dotenv.config();

const apiURL = process.env.API_WEBSITE_URL;
const Port = process.env.PORT ?? '5000';

if (!process.env.FRONTEND_WEBSITE_URL) {
  throw new Error('FRONTEND_WEBSITE_URL must be set');
}

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.FRONTEND_WEBSITE_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use('/api/auth', authRoutes);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(Port, () => {
  console.log(`🚀 Server running at ${apiURL} on port ${Port}`);
  console.log(`🔒 Authentication endpoints available at ${apiURL}/api/auth`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛡️  CORS Origin: ${process.env.FRONTEND_WEBSITE_URL}`);
});
