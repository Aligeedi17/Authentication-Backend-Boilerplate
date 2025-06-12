import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Initialize Prisma ORM client for database operations
const prisma = new PrismaClient();

// Retrieve JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * JWT Authentication Strategy Configuration
 * 
 * This strategy handles bearer token authentication for protected routes.
 * The token is extracted from the Authorization header and verified using
 * the application's secret key.
 */
const jwtOptions = {
  // Extract JWT from the 'Authorization: Bearer <token>' header
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  // Secret key for verifying token signature
  secretOrKey: JWT_SECRET,
};

// Register JWT authentication strategy with Passport
passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      // Find user by ID extracted from JWT payload
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      // Handle user not found scenario
      if (!user) {
        return done(null, false);
      }

      // Successful authentication - attach user to request
      return done(null, user);
    } catch (error) {
      // Pass any errors to Express error handling
      return done(error, false);
    }
  })
);

/**
 * Local Authentication Strategy (Email/Password)
 * 
 * This strategy handles traditional username/password authentication.
 * It verifies credentials against the database and returns user object on success.
 */
passport.use(
  new LocalStrategy(
    {
      // Customize field names to match login form (email instead of username)
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        // Find user by email address
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Validate user existence and password presence
        if (!user || !user.password) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Securely compare provided password with stored hash
        const isMatch = await bcrypt.compare(password, user.password);

        // Handle password mismatch
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Successful authentication - attach user to request
        return done(null, user);
      } catch (error) {
        // Pass database or bcrypt errors to Express
        return done(error);
      }
    }
  )
);

// Export configured Passport instance for use in Express middleware
export default passport;