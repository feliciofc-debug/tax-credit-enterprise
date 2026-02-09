import { logger } from '../utils/logger';

// ============================================
// Queue system - funciona com ou sem Redis
// Para deploy inicial, opera sem Redis (mock)
// ============================================

const REDIS_AVAILABLE = !!(process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost') || process.env.USE_REDIS === 'true';

let documentQueue: any;
let batchConsolidationQueue: any;

if (REDIS_AVAILABLE) {
  try {
    const Queue = require('bull');
    const Redis = require('ioredis');

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    const createRedisClient = () => new Redis(redisConfig);

    documentQueue = new Queue('document-processing', {
      createClient: (type: string) => createRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    batchConsolidationQueue = new Queue('batch-consolidation', {
      createClient: (type: string) => createRedisClient(),
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    documentQueue.on('completed', (job: any) => {
      logger.info(`Job ${job.id} completed`, { documentId: job.data.documentId });
    });

    documentQueue.on('failed', (job: any, err: Error) => {
      logger.error(`Job ${job?.id} failed`, { documentId: job?.data?.documentId, error: err.message });
    });

    batchConsolidationQueue.on('completed', (job: any) => {
      logger.info(`Batch consolidation ${job.id} completed`, { batchJobId: job.data.batchJobId });
    });

    batchConsolidationQueue.on('failed', (job: any, err: Error) => {
      logger.error(`Batch consolidation ${job?.id} failed`, { batchJobId: job?.data?.batchJobId, error: err.message });
    });

    logger.info('Queue system initialized with Redis');
  } catch (error) {
    logger.warn('Redis not available, using mock queue system');
  }
}

// Mock queue para quando Redis nao esta disponivel
if (!documentQueue) {
  const mockQueue = {
    add: async (data: any) => {
      logger.info('Mock queue: job added (will process inline)', { documentId: data.documentId });
      return { id: `mock-${Date.now()}`, data };
    },
    getWaitingCount: async () => 0,
    getActiveCount: async () => 0,
    getCompletedCount: async () => 0,
    getFailedCount: async () => 0,
    getDelayedCount: async () => 0,
    clean: async () => {},
    on: () => {},
  };
  documentQueue = mockQueue;
  batchConsolidationQueue = mockQueue;
  logger.info('Queue system initialized in mock mode (no Redis)');
}

// Interfaces
export interface DocumentJobData {
  documentId: string;
  userId: string;
  batchJobId?: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  documentType: 'dre' | 'balanço' | 'balancete';
  companyInfo?: {
    name?: string;
    cnpj?: string;
    regime?: 'lucro_real' | 'lucro_presumido' | 'simples';
  };
}

export interface BatchConsolidationJobData {
  batchJobId: string;
  userId: string;
}

// Limpar jobs antigos
export async function cleanOldJobs() {
  try {
    await documentQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    await documentQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');
    logger.info('Old jobs cleaned');
  } catch (error) {
    logger.warn('Could not clean old jobs (queue may be in mock mode)');
  }
}

// Estatisticas da fila
export async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      documentQueue.getWaitingCount(),
      documentQueue.getActiveCount(),
      documentQueue.getCompletedCount(),
      documentQueue.getFailedCount(),
      documentQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed, total: waiting + active + completed + failed + delayed };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 };
  }
}

export { documentQueue, batchConsolidationQueue };
