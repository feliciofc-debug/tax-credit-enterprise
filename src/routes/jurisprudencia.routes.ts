// src/routes/jurisprudencia.routes.ts
// Endpoints para classificação e gestão de jurisprudência vinculante

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { claudeService } from '../services/claude.service';
import { runJurisprudenciaVarredura } from '../services/jurisprudencia-varredura.service';

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}

/**
 * POST /api/jurisprudencia/classify
 * Classifica acórdão/decisão/norma via Claude e retorna JSON estruturado
 * Body: { texto: string, tipoFonte?: string }
 */
router.post('/classify', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { texto, tipoFonte } = req.body;

    if (!texto || typeof texto !== 'string') {
      return res.status(400).json({ success: false, error: 'Campo "texto" é obrigatório e deve ser string' });
    }

    if (texto.length < 50) {
      return res.status(400).json({ success: false, error: 'Texto muito curto para classificação (mínimo 50 caracteres)' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY não configurada' });
    }

    const resultado = await claudeService.classifyJurisprudencia(texto, tipoFonte);

    logger.info(`Jurisprudência classificada: ${resultado.tesesAfetadas.join(', ')} — ${resultado.resultado}`);

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (error: any) {
    logger.error('Erro ao classificar jurisprudência:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao classificar jurisprudência',
    });
  }
});

/**
 * GET /api/jurisprudencia/list
 * Lista itens de TeseJurisprudencia (overrides por tese)
 */
router.get('/list', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { teseCodigo, ativo } = req.query;

    const where: any = {};
    if (teseCodigo) where.teseCodigo = teseCodigo as string;
    if (ativo !== undefined) where.ativo = ativo === 'true';

    const items = await prisma.teseJurisprudencia.findMany({
      where,
      orderBy: [{ teseCodigo: 'asc' }, { dataJulgamento: 'desc' }],
    });

    return res.json({ success: true, data: items, total: items.length });
  } catch (error: any) {
    logger.error('Erro ao listar jurisprudência:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar jurisprudência' });
  }
});

/**
 * POST /api/jurisprudencia/create
 * Cria item de TeseJurisprudencia (após revisão no dashboard)
 */
router.post('/create', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      teseCodigo,
      temaVinculante,
      tribunal,
      dataJulgamento,
      resultado,
      probabilidadeMaxima,
      modulacao,
      notas,
    } = req.body;

    if (!teseCodigo || !resultado) {
      return res.status(400).json({ success: false, error: 'teseCodigo e resultado são obrigatórios' });
    }

    const item = await prisma.teseJurisprudencia.create({
      data: {
        teseCodigo: String(teseCodigo),
        temaVinculante: temaVinculante || null,
        tribunal: tribunal || null,
        dataJulgamento: dataJulgamento ? new Date(dataJulgamento) : null,
        resultado: String(resultado),
        probabilidadeMaxima: probabilidadeMaxima != null ? parseInt(probabilidadeMaxima) : null,
        modulacao: modulacao || null,
        notas: notas || null,
      },
    });

    logger.info(`TeseJurisprudencia criada: ${item.teseCodigo} — ${item.resultado}`);
    return res.json({ success: true, data: item });
  } catch (error: any) {
    logger.error('Erro ao criar jurisprudência:', error);
    return res.status(500).json({ success: false, error: 'Erro ao criar jurisprudência' });
  }
});

/**
 * PUT /api/jurisprudencia/update/:id
 */
router.put('/update/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: any = {};

    const fields = ['teseCodigo', 'temaVinculante', 'tribunal', 'resultado', 'probabilidadeMaxima', 'modulacao', 'notas', 'ativo'];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (req.body.dataJulgamento !== undefined) data.dataJulgamento = req.body.dataJulgamento ? new Date(req.body.dataJulgamento) : null;
    if (req.body.probabilidadeMaxima !== undefined) data.probabilidadeMaxima = parseInt(req.body.probabilidadeMaxima);

    const item = await prisma.teseJurisprudencia.update({ where: { id }, data });
    return res.json({ success: true, data: item });
  } catch (error: any) {
    logger.error('Erro ao atualizar jurisprudência:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar jurisprudência' });
  }
});

/**
 * POST /api/jurisprudencia/trigger-varredura
 * Dispara varredura de jurisprudência (busca decisões recentes via Claude)
 */
router.post('/trigger-varredura', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await runJurisprudenciaVarredura();
    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Erro na varredura de jurisprudência:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao executar varredura',
    });
  }
});

/**
 * DELETE /api/jurisprudencia/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.teseJurisprudencia.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Erro ao excluir jurisprudência:', error);
    return res.status(500).json({ success: false, error: 'Erro ao excluir jurisprudência' });
  }
});

export default router;
