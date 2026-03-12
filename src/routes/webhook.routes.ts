import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { IntegrationProcessor } from '../services/integrationProcessor.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// POST /api/webhook/:apiKey — Recebe dados de qualquer ERP
router.post('/:apiKey', upload.array('files', 50), async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.params;
    if (!apiKey) return res.status(401).json({ success: false, error: 'API Key obrigatória' });

    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash: hashKey(apiKey) },
      include: { integration: true },
    });

    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({ success: false, error: 'API Key inválida ou desativada' });
    }

    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
    });

    const integration = keyRecord.integration;
    const files = req.files as Express.Multer.File[];

    if (!files?.length) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo (field: files)' });
    }

    const results = [];
    let totalCreditos = 0;
    let totalAlerts = 0;
    let totalComissao = 0;

    for (const file of files) {
      const r = await IntegrationProcessor.processFile(
        file.buffer,
        file.originalname,
        {
          id: integration.id,
          cnpj: integration.cnpj,
          companyName: integration.companyName,
          comissaoPerc: integration.comissaoPerc,
          regime: integration.regime,
        }
      );
      totalCreditos += r.creditosFound;
      totalAlerts += r.alertsGenerated;
      totalComissao += r.comissaoGerada;
      results.push({ file: file.originalname, ...r });
    }

    return res.json({
      success: true,
      integration: { id: integration.id, company: integration.companyName },
      totalFiles: files.length,
      totalCreditos,
      totalAlerts,
      totalComissao,
      results,
    });
  } catch (err: any) {
    logger.error('[Webhook] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhook/:apiKey/batch — Alias para upload em lote (mesma lógica do principal)
router.post('/:apiKey/batch', upload.array('files', 100), async (req: Request, res: Response) => {
  const handler = (router as any).stack.find((layer: any) => layer.route?.path === '/:apiKey' && layer.route?.methods?.post);
  if (handler?.route?.stack?.[0]) {
    return handler.route.stack[0].handle(req, res, () => {});
  }
  return res.status(500).json({ success: false, error: 'Route not found' });
});

export default router;
