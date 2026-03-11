// src/routes/compliance.routes.ts
// Compliance em Tempo Real — Rotas API
// Módulo isolado: não interfere em HPC, Viabilidade ou Extratos

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import zipProcessor, { SpedDocument } from '../services/zipProcessor.service';
import { ComplianceAnalyzer } from '../services/compliance.service';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ============================================================
// GET /api/compliance/monitors — Lista monitores
// ============================================================
router.get('/monitors', async (_req: Request, res: Response) => {
  try {
    const monitors = await prisma.complianceMonitor.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { uploads: true, alerts: true } },
        alerts: {
          where: { status: 'new' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    res.json({ success: true, data: monitors });
  } catch (err: any) {
    logger.error(`[COMPLIANCE] Erro ao listar monitores: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/compliance/monitors/:id — Detalhe do monitor
// ============================================================
router.get('/monitors/:id', async (req: Request, res: Response) => {
  try {
    const monitor = await prisma.complianceMonitor.findUnique({
      where: { id: req.params.id },
      include: {
        uploads: { orderBy: { createdAt: 'desc' }, take: 50 },
        alerts: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!monitor) return res.status(404).json({ success: false, error: 'Monitor não encontrado' });
    res.json({ success: true, data: monitor });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/compliance/upload — Upload de SPED para análise
// ============================================================
router.post('/upload', upload.array('files', 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }

    const cnpj = (req.body.cnpj || '').replace(/\D/g, '');
    const companyName = req.body.companyName || 'Empresa';

    // Find or create monitor
    let monitor = await prisma.complianceMonitor.findUnique({ where: { cnpj } });
    if (!monitor && cnpj) {
      monitor = await prisma.complianceMonitor.create({
        data: {
          cnpj,
          companyName,
          regime: req.body.regime || null,
          sector: req.body.sector || null,
        },
      });
    }
    if (!monitor) {
      return res.status(400).json({ success: false, error: 'CNPJ é obrigatório' });
    }

    const results: any[] = [];

    for (const file of files) {
      try {
        const zipResult = await zipProcessor.processUpload(file.buffer, file.originalname, file.mimetype);

        for (const sped of zipResult.speds as SpedDocument[]) {
          const efdContrib = sped.efdContrib || undefined;
          const ecf = sped.ecf || undefined;
          const ecd = sped.ecd || undefined;

          const analysis = ComplianceAnalyzer.analyze(sped, efdContrib, ecf, ecd);

          // Save upload
          const uploadRecord = await prisma.complianceUpload.create({
            data: {
              monitorId: monitor.id,
              fileName: file.originalname,
              fileSize: file.size,
              spedType: analysis.spedType,
              periodoInicio: analysis.periodoInicio,
              periodoFim: analysis.periodoFim,
              ano: analysis.ano,
              mes: analysis.mes,
              status: 'completed',
              totalCreditos: analysis.totalCreditos,
              totalDebitos: analysis.totalDebitos,
              alertasGerados: analysis.alerts.length,
              resumoJson: JSON.stringify(analysis.resumo),
              processedAt: new Date(),
            },
          });

          // Save alerts
          for (const alert of analysis.alerts) {
            await prisma.complianceAlert.create({
              data: {
                monitorId: monitor.id,
                uploadId: uploadRecord.id,
                severity: alert.severity,
                category: alert.category,
                tributo: alert.tributo,
                title: alert.title,
                description: alert.description,
                valorEnvolvido: alert.valorEnvolvido,
                economiaEstimada: alert.economiaEstimada,
                baseLegal: alert.baseLegal,
                registroSped: alert.registroSped,
                parecer: alert.parecer,
                periodo: alert.periodo,
              },
            });
          }

          // Update monitor counters
          await prisma.complianceMonitor.update({
            where: { id: monitor.id },
            data: {
              totalUploads: { increment: 1 },
              totalAlerts: { increment: analysis.alerts.length },
              totalEconomia: { increment: analysis.resumo.economiaTotal },
              lastUploadAt: new Date(),
              companyName: sped.empresa || companyName,
            },
          });

          results.push({
            file: file.originalname,
            spedType: analysis.spedType,
            periodo: `${analysis.periodoInicio} - ${analysis.periodoFim}`,
            alerts: analysis.alerts.length,
            economiaEstimada: analysis.resumo.economiaTotal,
          });
        }
      } catch (fileErr: any) {
        logger.warn(`[COMPLIANCE] Erro processando ${file.originalname}: ${fileErr.message}`);
        results.push({ file: file.originalname, error: fileErr.message });
      }
    }

    res.json({
      success: true,
      monitorId: monitor.id,
      data: results,
      totalFiles: results.length,
      totalAlerts: results.reduce((s, r) => s + (r.alerts || 0), 0),
    });
  } catch (err: any) {
    logger.error(`[COMPLIANCE] Erro no upload: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/compliance/dashboard — Dados do dashboard
// ============================================================
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const monitors = await prisma.complianceMonitor.findMany({
      where: { active: true },
      include: { _count: { select: { alerts: true, uploads: true } } },
    });

    const totalEconomia = monitors.reduce((s, m) => s + m.totalEconomia, 0);
    const totalAlerts = monitors.reduce((s, m) => s + m.totalAlerts, 0);
    const totalUploads = monitors.reduce((s, m) => s + m.totalUploads, 0);

    const recentAlerts = await prisma.complianceAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { monitor: { select: { companyName: true, cnpj: true } } },
    });

    const alertsBySeverity = {
      critical: await prisma.complianceAlert.count({ where: { severity: 'critical', status: 'new' } }),
      warning: await prisma.complianceAlert.count({ where: { severity: 'warning', status: 'new' } }),
      info: await prisma.complianceAlert.count({ where: { severity: 'info', status: 'new' } }),
    };

    const alertsByCategory = await prisma.complianceAlert.groupBy({
      by: ['category'],
      _sum: { economiaEstimada: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        monitors: monitors.length,
        totalEconomia,
        totalAlerts,
        totalUploads,
        alertsBySeverity,
        alertsByCategory,
        recentAlerts,
        empresas: monitors.map(m => ({
          id: m.id,
          nome: m.companyName,
          cnpj: m.cnpj,
          economia: m.totalEconomia,
          alertas: m.totalAlerts,
          lastUpload: m.lastUploadAt,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PATCH /api/compliance/alerts/:id — Atualizar status do alerta
// ============================================================
router.patch('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'reviewed', 'accepted', 'dismissed', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status inválido. Usar: ${validStatuses.join(', ')}` });
    }

    const alert = await prisma.complianceAlert.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedAt: ['reviewed', 'accepted', 'dismissed'].includes(status) ? new Date() : undefined,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
      },
    });
    res.json({ success: true, data: alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/compliance/alerts — Lista todos os alertas
// ============================================================
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { severity, status, monitorId, limit } = req.query;
    const where: any = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (monitorId) where.monitorId = monitorId;

    const alerts = await prisma.complianceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit || '50'), 10),
      include: { monitor: { select: { companyName: true, cnpj: true } } },
    });
    res.json({ success: true, data: alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
