import Queue from 'bull';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Criar clientes Redis para Bull
const createRedisClient = () => new Redis(redisConfig);

// Queue para processamento de documentos individuais
export const documentQueue = new Queue('document-processing', {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return createRedisClient();
      case 'subscriber':
        return createRedisClient();
      case 'bclient':
        return createRedisClient();
      default:
        return createRedisClient();
    }
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Queue para consolidação de relatórios de batch
export const batchConsolidationQueue = new Queue('batch-consolidation', {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return createRedisClient();
      case 'subscriber':
        return createRedisClient();
      case 'bclient':
        return createRedisClient();
      default:
        return createRedisClient();
    }
  },
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Interface para jobs de documento
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

// Interface para jobs de consolidação
export interface BatchConsolidationJobData {
  batchJobId: string;
  userId: string;
}

// Eventos da fila de documentos
documentQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed`, { documentId: job.data.documentId });
});

documentQueue.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, { 
    documentId: job?.data?.documentId, 
    error: err.message 
  });
});

documentQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`, { documentId: job.data.documentId });
});

// Eventos da fila de consolidação
batchConsolidationQueue.on('completed', (job, result) => {
  logger.info(`Batch consolidation ${job.id} completed`, { 
    batchJobId: job.data.batchJobId 
  });
});

batchConsolidationQueue.on('failed', (job, err) => {
  logger.error(`Batch consolidation ${job?.id} failed`, { 
    batchJobId: job?.data?.batchJobId,
    error: err.message 
  });
});

// Limpar jobs antigos (executar periodicamente)
export async function cleanOldJobs() {
  try {
    await documentQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'); // 7 dias
    await documentQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed'); // 30 dias
    logger.info('Old jobs cleaned');
  } catch (error) {
    logger.error('Error cleaning old jobs:', error);
  }
}

// Estatísticas da fila
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    documentQueue.getWaitingCount(),
    documentQueue.getActiveCount(),
    documentQueue.getCompletedCount(),
    documentQueue.getFailedCount(),
    documentQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

logger.info('Queue system initialized');
