import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
  }
  next();
}

// ============================================================
// GET /api/thesis/list — lista teses (admin)
// ============================================================
router.get('/list', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tributo, status, tribunal, setor, regime, ativo } = req.query;

    const where: any = {};
    if (tributo) where.tributo = { contains: tributo as string, mode: 'insensitive' };
    if (status) where.status = status as string;
    if (tribunal) where.tribunal = { contains: tribunal as string, mode: 'insensitive' };
    if (ativo !== undefined) where.ativo = ativo === 'true';

    if (setor) {
      where.OR = [
        { setoresAplicaveis: { contains: setor as string, mode: 'insensitive' } },
        { setoresAplicaveis: { contains: 'todos', mode: 'insensitive' } },
      ];
    }
    if (regime) {
      where.regimesAplicaveis = { contains: regime as string, mode: 'insensitive' };
    }

    const theses = await prisma.taxThesis.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    res.json({ success: true, data: theses, total: theses.length });
  } catch (err: any) {
    logger.error('Erro ao listar teses:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar teses' });
  }
});

// ============================================================
// GET /api/thesis/active — teses ativas para uso no prompt
// ============================================================
router.get('/active', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const theses = await prisma.taxThesis.findMany({
      where: { ativo: true, status: 'active' },
      orderBy: { code: 'asc' },
    });
    res.json({ success: true, data: theses });
  } catch (err: any) {
    logger.error('Erro ao buscar teses ativas:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar teses ativas' });
  }
});

// ============================================================
// GET /api/thesis/stats — estatísticas rápidas
// ============================================================
router.get('/stats', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [total, active, pending, deprecated, pendingUpdates] = await Promise.all([
      prisma.taxThesis.count(),
      prisma.taxThesis.count({ where: { ativo: true, status: 'active' } }),
      prisma.taxThesis.count({ where: { status: 'pending' } }),
      prisma.taxThesis.count({ where: { status: 'deprecated' } }),
      prisma.thesisUpdate.count({ where: { reviewed: false } }),
    ]);
    res.json({ success: true, data: { total, active, pending, deprecated, pendingUpdates } });
  } catch (err: any) {
    logger.error('Erro ao buscar stats:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

// ============================================================
// POST /api/thesis/create — criar nova tese
// ============================================================
router.post('/create', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      code, name, description, tributo, fundamentacao,
      tribunal, tema, status: thesisStatus, risco, probabilidade,
      setoresAplicaveis, regimesAplicaveis, formulaCalculo,
      fonte, dataDecisao,
    } = req.body;

    if (!code || !name || !description || !tributo || !fundamentacao) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: code, name, description, tributo, fundamentacao',
      });
    }

    const existing = await prisma.taxThesis.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ success: false, error: `Código ${code} já existe` });
    }

    const thesis = await prisma.taxThesis.create({
      data: {
        code,
        name,
        description,
        tributo,
        fundamentacao,
        tribunal: tribunal || null,
        tema: tema || null,
        status: thesisStatus || 'active',
        risco: risco || 'medio',
        probabilidade: probabilidade ? parseInt(probabilidade) : 70,
        setoresAplicaveis: typeof setoresAplicaveis === 'string' ? setoresAplicaveis : JSON.stringify(setoresAplicaveis || []),
        regimesAplicaveis: typeof regimesAplicaveis === 'string' ? regimesAplicaveis : JSON.stringify(regimesAplicaveis || []),
        formulaCalculo: formulaCalculo || null,
        fonte: fonte || null,
        dataDecisao: dataDecisao ? new Date(dataDecisao) : null,
      },
    });

    logger.info(`Tese criada: ${code} - ${name}`);
    res.json({ success: true, data: thesis });
  } catch (err: any) {
    logger.error('Erro ao criar tese:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar tese' });
  }
});

// ============================================================
// PUT /api/thesis/update/:id — editar tese
// ============================================================
router.put('/update/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: any = {};

    const fields = [
      'name', 'description', 'tributo', 'fundamentacao', 'tribunal',
      'tema', 'status', 'risco', 'formulaCalculo', 'fonte',
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (req.body.probabilidade !== undefined) data.probabilidade = parseInt(req.body.probabilidade);
    if (req.body.ativo !== undefined) data.ativo = req.body.ativo;
    if (req.body.dataDecisao !== undefined) data.dataDecisao = req.body.dataDecisao ? new Date(req.body.dataDecisao) : null;
    if (req.body.setoresAplicaveis !== undefined) {
      data.setoresAplicaveis = typeof req.body.setoresAplicaveis === 'string'
        ? req.body.setoresAplicaveis
        : JSON.stringify(req.body.setoresAplicaveis);
    }
    if (req.body.regimesAplicaveis !== undefined) {
      data.regimesAplicaveis = typeof req.body.regimesAplicaveis === 'string'
        ? req.body.regimesAplicaveis
        : JSON.stringify(req.body.regimesAplicaveis);
    }

    const thesis = await prisma.taxThesis.update({ where: { id }, data });
    logger.info(`Tese atualizada: ${thesis.code}`);
    res.json({ success: true, data: thesis });
  } catch (err: any) {
    logger.error('Erro ao atualizar tese:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar tese' });
  }
});

// ============================================================
// DELETE /api/thesis/:id — deprecar tese (soft delete)
// ============================================================
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const thesis = await prisma.taxThesis.update({
      where: { id },
      data: { ativo: false, status: 'deprecated' },
    });
    logger.info(`Tese deprecada: ${thesis.code}`);
    res.json({ success: true, data: thesis });
  } catch (err: any) {
    logger.error('Erro ao deprecar tese:', err);
    res.status(500).json({ success: false, error: 'Erro ao deprecar tese' });
  }
});

// ============================================================
// FEED DE ATUALIZAÇÕES
// ============================================================

// GET /api/thesis/updates — lista atualizações pendentes
router.get('/updates', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reviewed } = req.query;
    const where: any = {};
    if (reviewed !== undefined) where.reviewed = reviewed === 'true';

    const updates = await prisma.thesisUpdate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: updates });
  } catch (err: any) {
    logger.error('Erro ao listar atualizações:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar atualizações' });
  }
});

// PUT /api/thesis/updates/:id/review — aprovar ou rejeitar atualização
router.put('/updates/:id/review', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const user = (req as any).user;

    const update = await prisma.thesisUpdate.update({
      where: { id },
      data: {
        reviewed: true,
        approved: !!approved,
        reviewedBy: user.email || user.name || 'admin',
        reviewedAt: new Date(),
      },
    });

    if (approved && update.type === 'new_thesis' && update.thesisCode) {
      logger.info(`Atualização ${id} aprovada — nova tese pode ser criada manualmente`);
    }

    res.json({ success: true, data: update });
  } catch (err: any) {
    logger.error('Erro ao revisar atualização:', err);
    res.status(500).json({ success: false, error: 'Erro ao revisar atualização' });
  }
});

// ============================================================
// POST /api/thesis/ai-update — Buscar novidades via IA
// ============================================================
router.post('/ai-update', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return res.status(400).json({ success: false, error: 'ANTHROPIC_API_KEY não configurada' });
    }

    const existingTheses = await prisma.taxThesis.findMany({
      where: { ativo: true },
      select: { code: true, name: true, tributo: true, tema: true },
      orderBy: { code: 'asc' },
    });

    const thesesList = existingTheses.map(t => `${t.code}: ${t.name} (${t.tributo}${t.tema ? ` — ${t.tema}` : ''})`).join('\n');

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Você é um especialista em direito tributário brasileiro.

Analise as últimas novidades jurídicas relevantes e identifique:

1. NOVAS DECISÕES do STF, STJ e CARF relevantes para recuperação de créditos tributários
2. MUDANÇAS LEGISLATIVAS (novas leis, decretos, instruções normativas da RFB, resoluções SEFAZ)
3. TESES que foram FORTALECIDAS ou ENFRAQUECIDAS por decisões recentes
4. NOVAS OPORTUNIDADES de recuperação tributária identificadas

## TESES ATUAIS NA PLATAFORMA:
${thesesList}

Para cada novidade encontrada, forneça:
- title: Título descritivo
- description: Descrição detalhada da novidade/decisão
- type: "new_thesis" | "update" | "deprecation" | "jurisprudence"
- tribunal: STF | STJ | CARF | RFB | SEFAZ | Legislativo | null
- source: Número do processo/tema/lei (se disponível)
- relevance: "low" | "medium" | "high" | "critical"
- thesisCode: Código da tese afetada (ex: "TESE-001") ou null se for nova
- suggestedAction: Ação sugerida para o admin

Responda APENAS em JSON válido no formato:
{
  "updates": [
    {
      "title": "...",
      "description": "...",
      "type": "...",
      "tribunal": "...",
      "source": "...",
      "relevance": "...",
      "thesisCode": null,
      "suggestedAction": "..."
    }
  ],
  "summary": "Resumo geral das novidades encontradas"
}`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return res.status(500).json({ success: false, error: 'Resposta inesperada da IA' });
    }

    let parsed: any;
    try {
      const jsonStr = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error('Resposta da IA não é JSON válido:', content.text.substring(0, 500));
      return res.status(500).json({ success: false, error: 'Resposta da IA em formato inválido' });
    }

    const savedUpdates = [];
    for (const u of (parsed.updates || [])) {
      const saved = await prisma.thesisUpdate.create({
        data: {
          type: u.type || 'jurisprudence',
          title: u.title || 'Sem título',
          description: `${u.description || ''}\n\nAção sugerida: ${u.suggestedAction || 'Revisar'}`,
          source: u.source || null,
          tribunal: u.tribunal || null,
          relevance: u.relevance || 'medium',
          thesisCode: u.thesisCode || null,
        },
      });
      savedUpdates.push(saved);
    }

    logger.info(`Atualização IA: ${savedUpdates.length} novidades encontradas`);

    res.json({
      success: true,
      data: {
        updates: savedUpdates,
        summary: parsed.summary || `${savedUpdates.length} novidades encontradas`,
        total: savedUpdates.length,
      },
    });
  } catch (err: any) {
    logger.error('Erro na atualização via IA:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar atualizações via IA' });
  }
});

export default router;
