// src/utils/prisma.ts
// Prisma Client otimizado para Vercel serverless
// Evita criar múltiplas conexões em hot reload (dev) e cold starts (prod)

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

// Log de erros e warnings do Prisma
prisma.$on('error' as never, (e: any) => {
  logger.error('Prisma error:', e.message || e);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Prisma warning:', e.message || e);
});

// Em desenvolvimento, reutilizar a instância (evita esgotar conexões em hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log de conexão inicial
prisma
  .$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((err: Error) => {
    logger.error('Database connection failed:', err.message);
  });
