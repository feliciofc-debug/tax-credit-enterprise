import { logger } from './utils/logger';

// Worker placeholder - will be implemented when Redis is configured
// For now, document processing happens inline (without queue)

logger.info('Worker module loaded (placeholder mode)');
logger.info('To enable full queue processing, configure Redis and implement document processor');

export {};
