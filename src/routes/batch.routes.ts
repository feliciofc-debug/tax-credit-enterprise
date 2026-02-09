import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { documentQueue } from '../queues';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = Router();

// Configure multer for multiple file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const tempDir = path.join(os.tmpdir(), 'uploads');
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'image/png',
      'image/jpeg'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

const BatchUploadSchema = z.object({
  batchName: z.string().optional(),
  documentType: z.enum(['dre', 'balanço', 'balancete']),
  companyName: z.string().optional(),
  cnpj: z.string().optional(),
  regime: z.enum(['lucro_real', 'lucro_presumido', 'simples']).optional(),
});

// POST /api/batch/upload - Upload múltiplos arquivos
router.post('/upload', authenticateToken, upload.array('documents', 200), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    logger.info(`Batch upload: ${files.length} files received`);

    // Validar dados
    const validationResult = BatchUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      // Limpar arquivos
      await Promise.all(files.map(f => fs.unlink(f.path).catch(() => {})));
      
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validationResult.error.errors
      });
    }

    const { batchName, documentType, companyName, cnpj, regime } = validationResult.data;
    const userId = (req as any).user.userId;

    // Criar batch job
    const batchJob = await prisma.batchJob.create({
      data: {
        userId,
        name: batchName || `Lote ${new Date().toLocaleDateString('pt-BR')}`,
        totalDocuments: files.length,
        status: 'pending'
      }
    });

    logger.info(`Batch job created: ${batchJob.id}`);

    // Criar documentos e adicionar à fila
    const documentPromises = files.map(async (file) => {
      // Criar registro do documento
      const document = await prisma.document.create({
        data: {
          userId,
          batchJobId: batchJob.id,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          documentType,
          companyName,
          cnpj,
          regime,
          status: 'pending'
        }
      });

      // Adicionar à fila de processamento
      await documentQueue.add({
        documentId: document.id,
        userId,
        batchJobId: batchJob.id,
        filePath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        documentType,
        companyInfo: {
          name: companyName,
          cnpj,
          regime
        }
      }, {
        priority: 10, // Menor número = maior prioridade
        timeout: 600000 // 10 minutos timeout
      });

      return document;
    });

    const documents = await Promise.all(documentPromises);

    logger.info(`${documents.length} documents added to queue for batch ${batchJob.id}`);

    return res.json({
      success: true,
      data: {
        batchJobId: batchJob.id,
        batchName: batchJob.name,
        totalDocuments: files.length,
        documents: documents.map(d => ({
          id: d.id,
          fileName: d.fileName,
          status: d.status
        })),
        message: 'Arquivos recebidos e processamento iniciado'
      }
    });

  } catch (error: any) {
    logger.error('Error in batch upload:', error);
    
    // Limpar arquivos em caso de erro
    const files = req.files as Express.Multer.File[];
    if (files) {
      await Promise.all(files.map(f => fs.unlink(f.path).catch(() => {})));
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao processar upload em lote',
      message: error.message
    });
  }
});

// GET /api/batch/:batchId/status - Status do batch
router.get('/:batchId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const userId = (req as any).user.userId;

    const batch = await prisma.batchJob.findFirst({
      where: {
        id: batchId,
        userId
      },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
            processedAt: true,
            extractedPeriod: true,
            analysis: {
              select: {
                totalEstimatedValue: true
              }
            }
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    // Calcular progresso
    const progress = batch.totalDocuments > 0
      ? ((batch.processedDocs + batch.failedDocs) / batch.totalDocuments) * 100
      : 0;

    return res.json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        progress: Math.round(progress),
        totalDocuments: batch.totalDocuments,
        processedDocs: batch.processedDocs,
        failedDocs: batch.failedDocs,
        totalEstimatedValue: batch.totalEstimatedValue,
        totalOpportunities: batch.totalOpportunities,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        documents: batch.documents
      }
    });

  } catch (error: any) {
    logger.error('Error fetching batch status:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar status do lote',
      message: error.message
    });
  }
});

// GET /api/batch/:batchId/report - Relatório consolidado
router.get('/:batchId/report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const userId = (req as any).user.userId;

    const batch = await prisma.batchJob.findFirst({
      where: {
        id: batchId,
        userId
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    if (batch.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Lote ainda em processamento'
      });
    }

    const report = batch.consolidatedReport
      ? JSON.parse(batch.consolidatedReport)
      : null;

    return res.json({
      success: true,
      data: report
    });

  } catch (error: any) {
    logger.error('Error fetching batch report:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar relatório',
      message: error.message
    });
  }
});

// GET /api/batch/:batchId/export - Exportar relatório em Excel
router.get('/:batchId/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const userId = (req as any).user.userId;

    const batch = await prisma.batchJob.findFirst({
      where: {
        id: batchId,
        userId
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    if (batch.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Lote ainda em processamento'
      });
    }

    const { batchConsolidator } = await import('../services/batchConsolidator.service');
    const excelBuffer = await batchConsolidator.exportToExcel(batchId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${batch.name}.xlsx"`);
    
    return res.send(excelBuffer);

  } catch (error: any) {
    logger.error('Error exporting batch report:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao exportar relatório',
      message: error.message
    });
  }
});

// GET /api/batch - Listar todos os lotes do usuário
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { status, limit = '10', offset = '0' } = req.query;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [batches, total] = await Promise.all([
      prisma.batchJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          _count: {
            select: { documents: true }
          }
        }
      }),
      prisma.batchJob.count({ where })
    ]);

    return res.json({
      success: true,
      data: {
        batches: batches.map(b => ({
          id: b.id,
          name: b.name,
          status: b.status,
          totalDocuments: b.totalDocuments,
          processedDocs: b.processedDocs,
          failedDocs: b.failedDocs,
          totalEstimatedValue: b.totalEstimatedValue,
          createdAt: b.createdAt,
          completedAt: b.completedAt
        })),
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error: any) {
    logger.error('Error listing batches:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar lotes',
      message: error.message
    });
  }
});

// DELETE /api/batch/:batchId - Deletar lote
router.delete('/:batchId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const userId = (req as any).user.userId;

    const batch = await prisma.batchJob.findFirst({
      where: {
        id: batchId,
        userId
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote não encontrado'
      });
    }

    await prisma.batchJob.delete({
      where: { id: batchId }
    });

    return res.json({
      success: true,
      message: 'Lote deletado com sucesso'
    });

  } catch (error: any) {
    logger.error('Error deleting batch:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao deletar lote',
      message: error.message
    });
  }
});

export default router;
