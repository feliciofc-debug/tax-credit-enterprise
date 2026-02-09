// src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Rotas
import batchRoutes from './routes/batch.routes';
import dashboardRoutes from './routes/dashboard.routes';
import taxCreditRoutes from './routes/tax-credit.routes';
import partnerRoutes from './routes/partner.routes';
import viabilityRoutes from './routes/viability.routes';
import inviteRoutes from './routes/invite.routes';
import contractRoutes from './routes/contract.routes';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 900000, // 15 minutos
  max: 100
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB health check
app.get('/health/db', async (_req, res) => {
  try {
    const { prisma } = await import('./utils/prisma');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    const userCount = await prisma.user.count();
    res.json({ status: 'ok', db: 'connected', users: userCount });
  } catch (err: any) {
    res.status(500).json({ status: 'error', db: 'failed', error: err.message });
  }
});

// Rotas
app.use('/api/batch', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tax-credit', taxCreditRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/viability', viabilityRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/contract', contractRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Servidor na porta ${PORT}`);
  logger.info(`Automacao de creditos: ATIVA`);
});

export default app;
