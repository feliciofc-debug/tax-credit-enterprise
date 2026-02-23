import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { generateProcurationDocument, type ProcurationParams } from '../services/procuration.service';
import { getOperatorPartnerId } from '../utils/operator';

const router = Router();

function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
  }
  next();
}

// ============================================================
// STATIC ROUTES FIRST (before /:id)
// ============================================================

// GET /api/procuration/clients/list — clientes reais + empresas de análises
router.get('/clients/list', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'user' },
      select: {
        id: true, name: true, company: true, cnpj: true, email: true,
        endereco: true, cidade: true, estado: true,
        legalRepName: true, legalRepCpf: true, legalRepRg: true, legalRepCargo: true,
      },
      orderBy: { company: 'asc' },
    });

    const analyses = await prisma.viabilityAnalysis.findMany({
      where: { status: 'completed', estimatedCredit: { gt: 0 } },
      select: {
        id: true, companyName: true, cnpj: true, estimatedCredit: true,
        viabilityScore: true, partnerId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const seen = new Set(users.map(u => u.cnpj).filter(Boolean));
    const analysisClients = analyses
      .filter(a => !seen.has(a.cnpj))
      .reduce((acc: any[], a) => {
        const key = a.cnpj || a.companyName;
        if (!acc.find(x => (x.cnpj || x.company) === key)) {
          acc.push({
            id: `analysis_${a.id}`,
            name: a.companyName,
            company: a.companyName,
            cnpj: a.cnpj || '',
            email: '',
            endereco: null, cidade: null, estado: null,
            legalRepName: null, legalRepCpf: null, legalRepRg: null, legalRepCargo: null,
            _source: 'analysis',
            estimatedCredit: a.estimatedCredit,
            viabilityScore: a.viabilityScore,
          });
        }
        return acc;
      }, []);

    res.json({ success: true, data: [...users, ...analysisClients] });
  } catch (err: any) {
    logger.error('Erro ao listar clientes:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar clientes' });
  }
});

// GET /api/procuration/contracts/list — contratos + análises com crédito
router.get('/contracts/list', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { status: { not: 'cancelled' } },
      select: {
        id: true, contractNumber: true, contractType: true, status: true,
        clientId: true, partnerId: true,
        lawyerName: true, lawyerOab: true,
        client: { select: { id: true, name: true, company: true, cnpj: true } },
        partner: { select: { id: true, name: true, company: true, oabNumber: true, oabState: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const analyses = await prisma.viabilityAnalysis.findMany({
      where: {
        status: 'completed',
        estimatedCredit: { gt: 0 },
      },
      select: {
        id: true,
        companyName: true,
        cnpj: true,
        estimatedCredit: true,
        viabilityScore: true,
        scoreLabel: true,
        partnerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const partnerIds = [...new Set(analyses.filter(a => a.partnerId).map(a => a.partnerId))];
    let partnerMap: Record<string, any> = {};
    if (partnerIds.length > 0) {
      const partners = await prisma.partner.findMany({
        where: { id: { in: partnerIds as string[] } },
        select: { id: true, name: true, company: true, oabNumber: true, oabState: true },
      });
      partnerMap = Object.fromEntries(partners.map(p => [p.id, p]));
    }

    const analysisItems = analyses.map(a => ({
      id: `analysis_${a.id}`,
      analysisId: a.id,
      source: 'analysis' as const,
      companyName: a.companyName,
      cnpj: a.cnpj,
      estimatedCredit: a.estimatedCredit,
      viabilityScore: a.viabilityScore,
      scoreLabel: a.scoreLabel,
      partnerId: a.partnerId,
      partner: a.partnerId ? partnerMap[a.partnerId] || null : null,
      createdAt: a.createdAt,
    }));

    res.json({
      success: true,
      data: {
        contracts,
        analyses: analysisItems,
      },
    });
  } catch (err: any) {
    logger.error('Erro ao listar contratos/análises:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar contratos e análises' });
  }
});

// GET /api/procuration/list — admin lista todas
router.get('/list', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, type, lawyerScenario, clientId } = req.query;
    const where: any = {};
    if (status) where.status = status as string;
    if (type) where.type = type as string;
    if (lawyerScenario) where.lawyerScenario = lawyerScenario as string;
    if (clientId) where.clientId = clientId as string;

    const procurations = await prisma.procuration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const clientIds = [...new Set(procurations.map(p => p.clientId))];
    let clientMap: Record<string, any> = {};
    if (clientIds.length > 0) {
      const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, company: true, cnpj: true, email: true },
      });
      clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
    }

    const enriched = procurations.map(p => ({
      ...p,
      client: clientMap[p.clientId] || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    logger.error('Erro ao listar procurações:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar procurações' });
  }
});

// GET /api/procuration/my — cliente vê as dele
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.userId || user.id;
    const procurations = await prisma.procuration.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: procurations });
  } catch (err: any) {
    logger.error('Erro ao buscar procurações do cliente:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar procurações' });
  }
});

// GET /api/procuration/partner — parceiro vê dos clientes dele (só tripartite)
router.get('/partner', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partnerId = await getOperatorPartnerId(user);

    if (!partnerId) {
      return res.json({ success: true, data: [] });
    }

    const procurations = await prisma.procuration.findMany({
      where: {
        partnerId,
        lawyerScenario: 'partner_lawyer',
      },
      orderBy: { createdAt: 'desc' },
    });

    const clientIds = [...new Set(procurations.map(p => p.clientId))];
    let clientMap: Record<string, any> = {};
    if (clientIds.length > 0) {
      const clients = await prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, company: true, cnpj: true },
      });
      clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
    }

    const enriched = procurations.map(p => ({
      ...p,
      client: clientMap[p.clientId] || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    logger.error('Erro ao buscar procurações do parceiro:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar procurações' });
  }
});

// ============================================================
// POST /api/procuration/generate — gerar procuração (admin)
// ============================================================
router.post('/generate', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      clientId, contractId, type, lawyerScenario,
      advogadoNome, advogadoOab, advogadoCpf, advogadoEndereco,
      uf, prazoAnos, poderes,
    } = req.body;

    if (!clientId || !type || !lawyerScenario) {
      return res.status(400).json({
        success: false,
        error: 'clientId, type e lawyerScenario são obrigatórios',
      });
    }

    let clienteNome = '';
    let clienteCnpj = '';
    let clienteEndereco = '';
    let representanteNome = '';
    let representanteCpf = '';
    let representanteRg: string | undefined;
    let representanteCargo: string | undefined;
    let clienteEstado: string | undefined;
    let clienteCidade = 'Rio de Janeiro';
    let realClientId = clientId;
    let partnerId: string | null = null;

    const isAnalysisSource = clientId.startsWith('analysis_');

    if (isAnalysisSource) {
      const analysisId = clientId.replace('analysis_', '');
      const analysis = await prisma.viabilityAnalysis.findUnique({ where: { id: analysisId } });
      if (!analysis) {
        return res.status(404).json({ success: false, error: 'Análise não encontrada' });
      }
      clienteNome = analysis.companyName || 'EMPRESA';
      clienteCnpj = analysis.cnpj || '';
      realClientId = clientId;
      if (analysis.partnerId) partnerId = analysis.partnerId;
    } else {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      }
      clienteNome = client.company || client.name || 'EMPRESA';
      clienteCnpj = client.cnpj || '';
      clienteEndereco = [client.endereco, client.cidade, client.estado].filter(Boolean).join(', ') || '';
      representanteNome = client.legalRepName || client.name || '';
      representanteCpf = client.legalRepCpf || '';
      representanteRg = client.legalRepRg || undefined;
      representanteCargo = client.legalRepCargo || undefined;
      clienteEstado = client.estado || undefined;
      clienteCidade = client.cidade || 'Rio de Janeiro';
    }

    let contract: any = null;
    if (contractId) {
      contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: { partner: true },
      });
      if (contract?.partnerId) partnerId = contract.partnerId;
    }

    const hasAdv = lawyerScenario !== 'atom_lawyer' || !!advogadoNome;

    const procParams: ProcurationParams = {
      type,
      lawyerScenario,
      clienteNome,
      clienteCnpj,
      clienteEndereco,
      representanteNome,
      representanteCpf,
      representanteRg,
      representanteCargo,
      advogadoNome: advogadoNome || undefined,
      advogadoOab: advogadoOab || undefined,
      advogadoCpf: advogadoCpf || undefined,
      advogadoEndereco: advogadoEndereco || undefined,
      uf: uf || clienteEstado || undefined,
      prazoAnos: prazoAnos || 2,
      poderes: poderes || undefined,
      cidade: clienteCidade,
    };

    const documentText = generateProcurationDocument(procParams);

    const validadeDate = new Date();
    validadeDate.setFullYear(validadeDate.getFullYear() + (prazoAnos || 2));

    const procuration = await prisma.procuration.create({
      data: {
        clientId: realClientId,
        contractId: contractId || null,
        partnerId: lawyerScenario === 'partner_lawyer' ? partnerId : null,
        type,
        lawyerScenario,
        outorgadoAtom: true,
        outorgadoAdv: hasAdv && !!advogadoNome,
        advogadoNome: advogadoNome || null,
        advogadoOab: advogadoOab || null,
        advogadoCpf: advogadoCpf || null,
        advogadoEndereco: advogadoEndereco || null,
        uf: uf || clienteEstado || null,
        prazoAnos: prazoAnos || 2,
        poderes: poderes || null,
        documentText,
        dataValidade: validadeDate,
      },
    });

    logger.info(`Procuração gerada: ${procuration.id} tipo=${type} cenario=${lawyerScenario} cliente=${clienteNome}`);

    res.json({ success: true, data: procuration });
  } catch (err: any) {
    logger.error('Erro ao gerar procuração:', err);
    res.status(500).json({ success: false, error: 'Erro ao gerar procuração: ' + (err.message || '') });
  }
});

// ============================================================
// DYNAMIC ROUTES LAST (/:id pattern)
// ============================================================

// GET /api/procuration/:id — detalhes de uma procuração
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const procuration = await prisma.procuration.findUnique({ where: { id } });
    if (!procuration) {
      return res.status(404).json({ success: false, error: 'Procuração não encontrada' });
    }

    if (user.role !== 'admin') {
      const userId = user.userId || user.id;
      if (procuration.clientId !== userId) {
        const partnerId = await getOperatorPartnerId(user);
        if (!partnerId || procuration.partnerId !== partnerId) {
          return res.status(403).json({ success: false, error: 'Sem permissão' });
        }
      }
    }

    res.json({ success: true, data: procuration });
  } catch (err: any) {
    logger.error('Erro ao buscar procuração:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar procuração' });
  }
});

// PUT /api/procuration/:id/status — atualizar status (admin)
router.put('/:id/status', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['generated', 'sent', 'signed', 'active', 'expired', 'revoked'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, error: `Status inválido. Válidos: ${valid.join(', ')}` });
    }

    const data: any = { status };
    if (status === 'signed') data.dataAssinatura = new Date();

    const procuration = await prisma.procuration.update({ where: { id }, data });
    logger.info(`Procuração ${id} status -> ${status}`);
    res.json({ success: true, data: procuration });
  } catch (err: any) {
    logger.error('Erro ao atualizar status:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar status' });
  }
});

export default router;
