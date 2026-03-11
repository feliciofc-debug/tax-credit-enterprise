import { Router, Request, Response } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { analyzeSimples, parseNFeXml, extractCompetencia, isMonofasico, NCM_TABLE } from '../services/simplesRecovery.service';
import type { NFeItem } from '../services/simplesRecovery.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// POST /api/simples/analyze — Upload NFe XMLs + análise
router.post('/analyze', upload.array('files', 50), async (req: Request, res: Response) => {
  try {
    const { cnpj, companyName, faturamento12m } = req.body;
    if (!cnpj) return res.status(400).json({ success: false, error: 'CNPJ é obrigatório' });

    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo' });

    let allItems: NFeItem[] = [];
    let totalNfes = 0;

    for (const file of files) {
      if (file.originalname.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file.buffer);
        for (const [name, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          if (name.toLowerCase().endsWith('.xml')) {
            const content = await zipEntry.async('string');
            const competencia = extractCompetencia(content);
            const items = parseNFeXml(content);
            items.forEach(it => { if (!it.competencia && competencia) it.competencia = competencia; });
            allItems.push(...items);
            totalNfes++;
          }
        }
      } else if (file.originalname.toLowerCase().endsWith('.xml')) {
        const content = file.buffer.toString('utf-8');
        const competencia = extractCompetencia(content);
        const items = parseNFeXml(content);
        items.forEach(it => { if (!it.competencia && competencia) it.competencia = competencia; });
        allItems.push(...items);
        totalNfes++;
      }
    }

    if (!allItems.length) {
      return res.status(400).json({ success: false, error: 'Nenhum item encontrado nos XMLs enviados. Verifique se são NFe válidas.' });
    }

    const result = analyzeSimples({
      cnpj: cnpj.replace(/\D/g, ''),
      companyName: companyName || 'Empresa',
      faturamento12m: faturamento12m ? parseFloat(faturamento12m) : undefined,
      items: allItems,
    });

    // Persistir no banco
    const analysis = await prisma.simplesAnalysis.create({
      data: {
        cnpj: cnpj.replace(/\D/g, ''),
        companyName: companyName || 'Empresa',
        totalRecuperavel: result.totalRecuperavel,
        totalMonofasico: result.totalMonofasicoPis + result.totalMonofasicoCofins,
        totalIcmsSt: result.totalIcmsSt,
        totalNfes,
        totalItens: result.totalItens,
        mesesAnalisados: Object.keys(result.porCompetencia).length,
        resumoJson: {
          porGrupo: result.porGrupo,
          porCompetencia: result.porCompetencia,
          faixaSimples: result.faixaSimples,
          itensMonofasicos: result.itensMonofasicos,
          itensIcmsSt: result.itensIcmsSt,
        },
        items: {
          create: result.detalhamento.slice(0, 500).map(d => ({
            tipo: d.tipo,
            tributo: d.tributo,
            ncm: d.ncm,
            descricaoProduto: d.descricao,
            baseCalculo: d.valorBase,
            aliquotaDas: d.aliquotaDas,
            valorPagoIndevido: d.valorRecuperavel,
            valorRecuperavel: d.valorRecuperavel,
            competencia: d.competencia,
            baseLegal: d.baseLegal,
          })),
        },
      },
    });

    return res.json({
      success: true,
      analysisId: analysis.id,
      totalNfes,
      totalItens: result.totalItens,
      itensMonofasicos: result.itensMonofasicos,
      itensIcmsSt: result.itensIcmsSt,
      totalRecuperavel: result.totalRecuperavel,
      totalMonofasicoPis: result.totalMonofasicoPis,
      totalMonofasicoCofins: result.totalMonofasicoCofins,
      totalIcmsSt: result.totalIcmsSt,
      porGrupo: result.porGrupo,
      porCompetencia: result.porCompetencia,
      faixaSimples: result.faixaSimples,
    });
  } catch (err: any) {
    logger.error('[Simples] Erro na análise:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/simples/check-ncm — Verificar se um NCM é monofásico
router.post('/check-ncm', (req: Request, res: Response) => {
  const { ncm } = req.body;
  if (!ncm) return res.status(400).json({ success: false, error: 'NCM é obrigatório' });
  const result = isMonofasico(ncm);
  return res.json({ success: true, ncm, ...result });
});

// GET /api/simples/ncm-table — Lista completa de NCMs monofásicos
router.get('/ncm-table', (_req: Request, res: Response) => {
  const table = Object.entries(NCM_TABLE).map(([ncm, data]) => ({ ncm, ...data }));
  return res.json({ success: true, total: table.length, data: table });
});

// GET /api/simples/analyses — Listar análises
router.get('/analyses', async (_req: Request, res: Response) => {
  try {
    const analyses = await prisma.simplesAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        cnpj: true,
        companyName: true,
        totalRecuperavel: true,
        totalMonofasico: true,
        totalIcmsSt: true,
        totalNfes: true,
        totalItens: true,
        mesesAnalisados: true,
        status: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, data: analyses });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/simples/analyses/:id — Detalhe de uma análise
router.get('/analyses/:id', async (req: Request, res: Response) => {
  try {
    const analysis = await prisma.simplesAnalysis.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { valorRecuperavel: 'desc' }, take: 200 } },
    });
    if (!analysis) return res.status(404).json({ success: false, error: 'Análise não encontrada' });
    return res.json({ success: true, data: analysis });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/simples/dashboard — Dashboard resumo
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const analyses = await prisma.simplesAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalAnalises = analyses.length;
    const totalRecuperavel = analyses.reduce((s: number, a: any) => s + a.totalRecuperavel, 0);
    const totalMonofasico = analyses.reduce((s: number, a: any) => s + a.totalMonofasico, 0);
    const totalIcmsSt = analyses.reduce((s: number, a: any) => s + a.totalIcmsSt, 0);
    const totalNfes = analyses.reduce((s: number, a: any) => s + a.totalNfes, 0);

    const empresas = analyses.map((a: any) => ({
      id: a.id,
      cnpj: a.cnpj,
      nome: a.companyName,
      recuperavel: a.totalRecuperavel,
      monofasico: a.totalMonofasico,
      icmsSt: a.totalIcmsSt,
      nfes: a.totalNfes,
      data: a.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        totalAnalises,
        totalRecuperavel,
        totalMonofasico,
        totalIcmsSt,
        totalNfes,
        empresas,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
