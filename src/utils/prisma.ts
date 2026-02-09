import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

prisma.$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((err) => {
    logger.error('Database connection failed:', err.message);
    logger.error('DATABASE_URL host:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@').substring(0, 80));
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
