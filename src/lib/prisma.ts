import { PrismaClient } from '@prisma/client';

/**
 * Initializes and returns a new instance of PrismaClient.
 * 
 * Encapsulated in a function to ensure type-safe reuse and maintain
 * singleton pattern behavior across different environments.
 */
const prismaClientSingleton = () => {
  return new PrismaClient();
};

/**
 * Extends the globalThis object to include a custom Prisma instance.
 * This allows the Prisma client to be globally reused across modules
 * during development without creating multiple connections to the database.
 */
declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

/**
 * Reuses the existing global Prisma client if available,
 * otherwise creates a new instance.
 * 
 * Ensures that only one Prisma client is active during
 * the lifecycle of the application, avoiding connection leaks.
 */
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

/**
 * In development mode, stores the Prisma client instance globally.
 * This prevents creating multiple instances during hot module reloads
 * typically triggered by tools like Next.js or similar.
 */
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
