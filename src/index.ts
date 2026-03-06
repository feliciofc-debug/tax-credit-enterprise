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
import formalizationRoutes from './routes/formalization.routes';
import hpcRoutes from './routes/hpc.routes';
import thesisRoutes from './routes/thesis.routes';
import procurationRoutes from './routes/procuration.routes';
import byceoRoutes from './routes/byceo.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// Middlewares de seguranca
// ==============================

// Trust proxy - necessario para Render/Heroku/Vercel (reverse proxy)
// Corrige o erro ERR_ERL_UNEXPECTED_X_FORWARDED_FOR do express-rate-limit
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// CORS - origens autorizadas
const allowedOrigins = [
  'https://tax-credit-enterprise-92lv.vercel.app',
  'https://taxcreditenterprise.com',
  'https://www.taxcreditenterprise.com',
  'https://hpc.taxcreditenterprise.com',
  process.env.FRONTEND_URL,
  process.env.CUSTOM_DOMAIN_URL,
].filter(Boolean) as string[];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Origem bloqueada: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==============================
// Rate limiting por tipo de rota
// ==============================

// Auth: mais restritivo (protege contra brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,                   // 20 tentativas
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload: limite por hora
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30,                   // 30 uploads por hora
  message: { success: false, error: 'Limite de uploads atingido. Tente novamente em 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API geral: mais permissivo
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// HPC: rate limit generoso (polling a cada 5s por ~10min = ~120 requests)
const hpcLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiters por rota
app.use('/api/auth', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/register', authLimiter);
app.use('/api/partner/login', authLimiter);
app.use('/api/partner/register', authLimiter);
app.use('/api/batch/upload', uploadLimiter);
app.use('/api/hpc', hpcLimiter);
app.use('/api/', apiLimiter);

// ==============================
// Health checks
// ==============================
app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB health check - sem informacoes sensiveis
app.get('/health/db', async (_req, res) => {
  try {
    const { prisma } = await import('./utils/prisma');
    await prisma.$queryRaw`SELECT 1 as test`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// ==============================
// Rotas da aplicacao
// ==============================
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
app.use('/api/formalization', formalizationRoutes);
app.use('/api/hpc', hpcRoutes);
app.use('/api/thesis', thesisRoutes);
app.use('/api/procuration', procurationRoutes);
app.use('/api/v1/byceo', byceoRoutes);

// Error handling
app.use(errorHandler);

// Validacao de seguranca na inicializacao
const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret || jwtSecret === 'secret' || jwtSecret.length < 32) {
  logger.warn('⚠️  JWT_SECRET fraco ou nao definido! Configure um secret forte (64+ chars) nas variaveis de ambiente.');
}

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
  logger.warn('⚠️  ANTHROPIC_API_KEY nao configurada. Analise de viabilidade usara modo simulado.');
}

app.listen(PORT, () => {
  logger.info(`Servidor na porta ${PORT}`);
  logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS: ${allowedOrigins.join(', ') || 'aberto (dev)'}`);
  logger.info(`Automacao de creditos: ATIVA`);
  logger.info(`HPC Gateway: ${process.env.HPC_GATEWAY_URL ? 'ATIVO (' + process.env.HPC_GATEWAY_URL + ')' : 'DESATIVADO'}`);
});

export default app;
