import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { OmieConnector } from '../services/omieConnector.service';
import { IntegrationProcessor } from '../services/integrationProcessor.service';
import { analyzeSimples } from '../services/simplesRecovery.service';

const router = Router();

function generateApiKey(): string {
  return 'tcx_' + crypto.randomBytes(32).toString('hex');
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// POST /api/integrations — Criar nova integração
router.post('/', async (req: Request, res: Response) => {
  try {
    const { cnpj, companyName, provider, configJson, comissaoPerc, regime } = req.body;
    if (!cnpj || !provider) return res.status(400).json({ success: false, error: 'cnpj e provider são obrigatórios' });

    const integration = await prisma.integration.create({
      data: {
        cnpj: cnpj.replace(/\D/g, ''),
        companyName: companyName || 'Empresa',
        provider,
        configJson: configJson || {},
        comissaoPerc: comissaoPerc ?? 0.175,
        regime: regime || null,
      },
    });

    const rawKey = generateApiKey();
    await prisma.apiKey.create({
      data: {
        integrationId: integration.id,
        keyHash: hashKey(rawKey),
        keyPrefix: rawKey.substring(0, 12),
        label: 'Chave principal',
      },
    });

    const webhookUrl = `${process.env.BACKEND_URL || 'https://taxcredit-api.onrender.com'}/api/webhook/${rawKey}`;

    return res.json({
      success: true,
      data: {
        integration,
        apiKey: rawKey,
        webhookUrl,
        instructions: getProviderInstructions(provider, webhookUrl),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/integrations — Listar todas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        apiKeys: { select: { keyPrefix: true, isActive: true, lastUsedAt: true, usageCount: true } },
        _count: { select: { logs: true, revenueEvents: true } },
      },
    });
    return res.json({ success: true, data: integrations });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/integrations/:id — Detalhes
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.id },
      include: {
        apiKeys: { select: { id: true, keyPrefix: true, isActive: true, lastUsedAt: true, usageCount: true, createdAt: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 20 },
        revenueEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!integration) return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    return res.json({ success: true, data: integration });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/integrations/:id — Atualizar
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, configJson, comissaoPerc, companyName, regime } = req.body;
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (configJson !== undefined) data.configJson = configJson;
    if (comissaoPerc !== undefined) data.comissaoPerc = comissaoPerc;
    if (companyName !== undefined) data.companyName = companyName;
    if (regime !== undefined) data.regime = regime;

    const integration = await prisma.integration.update({ where: { id: req.params.id }, data });
    return res.json({ success: true, data: integration });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/integrations/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.apiKey.deleteMany({ where: { integrationId: req.params.id } });
    await prisma.integrationLog.deleteMany({ where: { integrationId: req.params.id } });
    await prisma.revenueEvent.deleteMany({ where: { integrationId: req.params.id } });
    await prisma.integration.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/integrations/:id/generate-key — Nova API key
router.post('/:id/generate-key', async (req: Request, res: Response) => {
  try {
    const rawKey = generateApiKey();
    await prisma.apiKey.create({
      data: {
        integrationId: req.params.id,
        keyHash: hashKey(rawKey),
        keyPrefix: rawKey.substring(0, 12),
        label: req.body.label || 'Nova chave',
      },
    });
    const webhookUrl = `${process.env.BACKEND_URL || 'https://taxcredit-api.onrender.com'}/api/webhook/${rawKey}`;
    return res.json({ success: true, apiKey: rawKey, webhookUrl });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/integrations/:id/sync — Sincronizar Omie
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) return res.status(404).json({ success: false, error: 'Não encontrada' });
    if (integration.provider !== 'omie') return res.status(400).json({ success: false, error: 'Sync só disponível para Omie' });

    const config = integration.configJson as any;
    if (!config?.appKey || !config?.appSecret) {
      return res.status(400).json({ success: false, error: 'App Key e App Secret não configurados' });
    }

    const omie = new OmieConnector({ appKey: config.appKey, appSecret: config.appSecret });
    const nfes = await omie.fetchAllNFes(req.body.dtInicio, req.body.dtFim);
    const { items, totalNfes } = omie.toNFeItems(nfes);

    if (!items.length) {
      return res.json({ success: true, message: 'Nenhuma NFe encontrada no período', totalNfes: 0 });
    }

    const analysis = analyzeSimples({
      cnpj: integration.cnpj,
      companyName: integration.companyName,
      items,
    });

    if (analysis.totalRecuperavel > 0) {
      const comissao = analysis.totalRecuperavel * integration.comissaoPerc;
      await prisma.revenueEvent.create({
        data: {
          integrationId: integration.id,
          cnpj: integration.cnpj,
          companyName: integration.companyName,
          eventType: 'credit_found',
          fonte: 'simples_recovery',
          tributo: 'PIS/COFINS',
          valorCredito: analysis.totalRecuperavel,
          comissaoPerc: integration.comissaoPerc,
          comissaoValor: comissao,
          descricao: `Sync Omie: ${totalNfes} NFes, ${analysis.itensMonofasicos} monofásicos`,
        },
      });
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), totalCreditos: { increment: analysis.totalRecuperavel } },
    });

    await prisma.integrationLog.create({
      data: {
        integrationId: integration.id,
        eventType: 'sync_completed',
        status: 'success',
        itemsProcessed: items.length,
        creditosFound: analysis.totalRecuperavel,
        alertsGenerated: analysis.itensMonofasicos + analysis.itensIcmsSt,
      },
    });

    return res.json({
      success: true,
      totalNfes,
      totalItens: items.length,
      totalRecuperavel: analysis.totalRecuperavel,
      itensMonofasicos: analysis.itensMonofasicos,
      itensIcmsSt: analysis.itensIcmsSt,
    });
  } catch (err: any) {
    logger.error('[Omie Sync] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/integrations/:id/test — Testar conexão Omie
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) return res.status(404).json({ success: false, error: 'Não encontrada' });
    if (integration.provider !== 'omie') return res.json({ success: true, message: 'Teste disponível apenas para Omie. Webhook pronto para receber dados.' });

    const config = integration.configJson as any;
    const omie = new OmieConnector({ appKey: config.appKey, appSecret: config.appSecret });
    const result = await omie.testConnection();
    return res.json({ success: result.success, empresa: result.empresa, error: result.error });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/integrations/:id/logs
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.integrationLog.findMany({
      where: { integrationId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

function getProviderInstructions(provider: string, webhookUrl: string): string {
  switch (provider) {
    case 'omie': return 'Configure App Key e App Secret do painel Omie. Use "Sincronizar" para puxar NFes automaticamente.';
    case 'oracle': return `Configure Outbound REST Service no Oracle EBS/Cloud para POST em: ${webhookUrl}`;
    case 'sap': return `Configure RFC Destination ou IDOC no SAP para enviar SPED/NFe para: ${webhookUrl}`;
    case 'totvs': return `Em Integrações > Webservices do TOTVS Protheus, configure envio automático para: ${webhookUrl}`;
    default: return `Envie arquivos via POST para: ${webhookUrl} (field: files). Aceita .xml, .txt, .zip`;
  }
}

export default router;
