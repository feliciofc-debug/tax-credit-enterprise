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

// GET /api/dashboard/my-opportunities - Oportunidades reais do cliente (da análise)
router.get('/my-opportunities', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cnpj: true, company: true },
    });

    if (!user?.cnpj && !user?.company) {
      return res.json({ success: true, data: [] });
    }

    const whereClause: any = { status: 'completed' };
    if (user.cnpj) {
      whereClause.cnpj = user.cnpj;
    } else if (user.company) {
      whereClause.companyName = { contains: user.company, mode: 'insensitive' };
    }

    const analyses = await prisma.viabilityAnalysis.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        companyName: true,
        cnpj: true,
        estimatedCredit: true,
        status: true,
        aiSummary: true,
        opportunities: true,
        createdAt: true,
      },
    });

    const opportunities: any[] = [];
    for (const analysis of analyses) {
      if (analysis.opportunities) {
        try {
          const opps = typeof analysis.opportunities === 'string'
            ? JSON.parse(analysis.opportunities)
            : analysis.opportunities;
          if (Array.isArray(opps)) {
            opps.forEach((opp: any, i: number) => {
              opportunities.push({
                id: `${analysis.id}-${i}`,
                analysisId: analysis.id,
                tipo: opp.tipo || opp.tese || opp.name || 'Oportunidade',
                tributo: opp.tributo || '',
                valorEstimado: opp.valorEstimado || opp.valor || 0,
                probabilidadeRecuperacao: opp.probabilidade || opp.probabilidadeRecuperacao || 70,
                fundamentacaoLegal: opp.fundamentacao || opp.fundamentacaoLegal || '',
                descricao: opp.descricao || '',
                prazoRecuperacao: opp.prazo || opp.prazoRecuperacao || '3-12 meses',
                empresa: analysis.companyName || '',
              });
            });
          }
        } catch { /* ignore parse errors */ }
      }
    }

    return res.json({ success: true, data: opportunities });
  } catch (error: any) {
    logger.error('Error fetching client opportunities:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar oportunidades' });
  }
});

export default router;
