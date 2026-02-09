import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Padrao singleton - evita multiplas instancias em hot reload (dev) e serverless
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log de conexao (apenas na primeira vez)
prisma.$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((err) => {
    logger.error('Database connection failed:', err.message);
    // Mascarar credenciais no log
    const safeUrl = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@').substring(0, 80);
    logger.error('DATABASE_URL host:', safeUrl);
  });
