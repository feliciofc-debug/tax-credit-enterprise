import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

prisma.$connect()
  .then(() => logger.info('Database connected'))
  .catch((err) => logger.error('Database connection failed:', err));

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
