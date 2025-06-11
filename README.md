# 🔐 Authentication Backend Boilerplate

A robust, production-ready authentication backend built with Node.js, Express, TypeScript, and Prisma. This boilerplate provides comprehensive authentication features including email/password registration, OAuth integration, email verification, and password reset functionality.

## ✨ Features

- **🔑 Multiple Authentication Methods**
  - Email/Password authentication
  - Google OAuth 2.0 integration
  - JWT-based session management

- **📧 Email Services**
  - Email verification for new accounts
  - Password reset via email
  - Resend verification emails

- **🛡️ Security Features**
  - Password hashing with bcrypt
  - JWT token authentication
  - Protected routes middleware
  - CORS configuration
  - Input validation

- **💾 Database Integration**
  - PostgreSQL with Prisma ORM
  - User, Account, Session, and VerificationToken models
  - Database migrations and seeding

- **🔧 Developer Experience**
  - TypeScript for type safety
  - Hot reload with nodemon
  - Comprehensive error handling
  - Environment-based configuration

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Passport.js
- **Email**: Nodemailer
- **Security**: bcrypt, jsonwebtoken

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [PostgreSQL](https://www.postgresql.org/) database
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AsheeSoftworks/Authentication-Backend-Boilerplate.git
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and configure the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"

# Server Configuration
PORT=5000
API_WEBSITE_URL="http://localhost:5000"
FRONTEND_WEBSITE_URL="http://localhost:3000"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email Configuration (SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-email-password"
EMAIL_FROM="noreply@yourapp.com"

# Environment
NODE_ENV="development"
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view your data
npm run prisma:studio
```

### 5. Start the Development Server

```bash
npm run dev
```

Your server will be running at `http://localhost:5000` (or your configured PORT).

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── config.ts          # Environment configuration
│   │   └── passport.ts        # Passport authentication strategies
│   ├── controllers/
│   │   └── authController.ts  # Authentication logic
│   ├── routes/
│   │   └── authRoutes.ts      # API routes
│   ├── services/
│   │   └── emailService.ts    # Email service functions
│   └── index.ts               # Application entry point
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── .env                       # Environment variables
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register new user | ❌ |
| `POST` | `/api/auth/login` | Login with email/password | ❌ |
| `POST` | `/api/auth/google/login` | Login with Google token | ❌ |
| `GET` | `/api/auth/google` | Initiate Google OAuth | ❌ |
| `GET` | `/api/auth/google/callback` | Google OAuth callback | ❌ |
| `GET` | `/api/auth/me` | Get current user | ✅ |
| `POST` | `/api/auth/logout` | Logout user | ❌ |

### Email & Password Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/verify/:token` | Verify email address | ❌ |
| `POST` | `/api/auth/resend-verification` | Resend verification email | ❌ |
| `POST` | `/api/auth/request-password-reset` | Request password reset | ❌ |
| `POST` | `/api/auth/reset-password` | Reset password with token | ❌ |
| `POST` | `/api/auth/refresh-token` | Refresh JWT token | ❌ |

## 📝 API Usage Examples

### Register a New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "confirm_password": "securePassword123"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

### Access Protected Route

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:studio` | Open Prisma Studio |

## 🔧 Configuration

### Database Models

The application uses the following Prisma models:

- **User**: Core user information and authentication data
- **Account**: OAuth provider account linking
- **Session**: User session management
- **VerificationToken**: Email verification and password reset tokens

### Authentication Strategies

- **Local Strategy**: Email/password authentication
- **JWT Strategy**: Token-based authentication for protected routes
- **Google OAuth**: Social login integration

## 🚀 Production Deployment

### Environment Variables for Production

Ensure these environment variables are set in your production environment:

```env
NODE_ENV="production"
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
API_WEBSITE_URL="https://your-api-domain.com"
FRONTEND_WEBSITE_URL="https://your-frontend-domain.com"
```

### Build and Start

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) section
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your environment and the issue

---

**Happy Coding! 🎉**