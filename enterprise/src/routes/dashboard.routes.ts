import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { getQueueStats } from '../queues';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/dashboard/stats - Estatísticas gerais do usuário
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const [
      totalBatches,
      completedBatches,
      totalDocuments,
      completedDocuments,
      totalValue,
      recentBatches
    ] = await Promise.all([
      prisma.batchJob.count({ where: { userId } }),
      prisma.batchJob.count({ where: { userId, status: 'completed' } }),
      prisma.document.count({ where: { userId } }),
      prisma.document.count({ where: { userId, status: 'completed' } }),
      prisma.analysis.aggregate({
        where: { document: { userId } },
        _sum: { totalEstimatedValue: true }
      }),
      prisma.batchJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          totalDocuments: true,
          processedDocs: true,
          totalEstimatedValue: true,
          createdAt: true
        }
      })
    ]);

    const queueStats = await getQueueStats();

    res.json({
      success: true,
      data: {
        overview: {
          totalBatches,
          completedBatches,
          totalDocuments,
          completedDocuments,
          totalEstimatedValue: totalValue._sum.totalEstimatedValue || 0
        },
        queue: queueStats,
        recentBatches
      }
    });

  } catch (error: any) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

export default router;
