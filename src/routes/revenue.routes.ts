import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

const fmt = (v: number) => v.toFixed(2);

// GET /api/revenue/feed — Feed de eventos de receita em tempo real
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const take = Math.min(parseInt(req.query.take as string) || 30, 100);
    const skip = parseInt(req.query.skip as string) || 0;
    const fonte = req.query.fonte as string;

    const where: any = {};
    if (fonte) where.fonte = fonte;

    const events = await prisma.revenueEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return res.json({ success: true, data: events });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/revenue/dashboard — Totais agregados
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allTime, today, week, month, byFonte, byTributo, recentEvents, config] = await Promise.all([
      prisma.revenueEvent.aggregate({ _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.aggregate({ where: { createdAt: { gte: weekStart } }, _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.groupBy({ by: ['fonte'], _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.groupBy({ by: ['tributo'], _sum: { valorCredito: true, comissaoValor: true }, _count: true }),
      prisma.revenueEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
      prisma.revenueConfig.findFirst(),
    ]);

    return res.json({
      success: true,
      data: {
        totals: {
          allTime: { creditos: allTime._sum.valorCredito || 0, comissao: allTime._sum.comissaoValor || 0, events: allTime._count },
          today: { creditos: today._sum.valorCredito || 0, comissao: today._sum.comissaoValor || 0, events: today._count },
          week: { creditos: week._sum.valorCredito || 0, comissao: week._sum.comissaoValor || 0, events: week._count },
          month: { creditos: month._sum.valorCredito || 0, comissao: month._sum.comissaoValor || 0, events: month._count },
        },
        byFonte,
        byTributo,
        recentEvents,
        config: config || { comissaoPadraoPerc: 0.175, faturamentoGlobal: 0, metaMensal: 0, metaAnual: 0 },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/revenue/config — Atualizar configuração (faturamento Atom, percentual, metas)
router.patch('/config', async (req: Request, res: Response) => {
  try {
    const { comissaoPadraoPerc, faturamentoGlobal, metaMensal, metaAnual } = req.body;
    const existing = await prisma.revenueConfig.findFirst();
    const data: any = {};
    if (comissaoPadraoPerc !== undefined) data.comissaoPadraoPerc = comissaoPadraoPerc;
    if (faturamentoGlobal !== undefined) data.faturamentoGlobal = faturamentoGlobal;
    if (metaMensal !== undefined) data.metaMensal = metaMensal;
    if (metaAnual !== undefined) data.metaAnual = metaAnual;

    let config;
    if (existing) {
      config = await prisma.revenueConfig.update({ where: { id: existing.id }, data });
    } else {
      config = await prisma.revenueConfig.create({ data });
    }

    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/revenue/manual — Registrar evento manual (ex: recuperação 5 anos formalizada)
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { cnpj, companyName, tributo, valorCredito, comissaoPerc, descricao, fonte } = req.body;
    if (!cnpj || !valorCredito) return res.status(400).json({ success: false, error: 'cnpj e valorCredito obrigatórios' });

    const perc = comissaoPerc ?? 0.175;
    const event = await prisma.revenueEvent.create({
      data: {
        cnpj: cnpj.replace(/\D/g, ''),
        companyName: companyName || 'Empresa',
        eventType: 'recovery_identified',
        fonte: fonte || 'manual',
        tributo: tributo || 'Diversos',
        valorCredito: parseFloat(valorCredito),
        comissaoPerc: perc,
        comissaoValor: parseFloat(valorCredito) * perc,
        descricao: descricao || 'Evento registrado manualmente',
      },
    });

    return res.json({ success: true, data: event });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
