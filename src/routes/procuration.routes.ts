import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import {
  generateProcurationDocument,
  listProcuracaoPresets,
  getProcuracaoPreset,
  diffPoderes,
  type ProcurationParams,
  type ProcuracaoPresetKey,
} from '../services/procuration.service';
import { serproService } from '../services/serpro.service';
import { notificationService } from '../services/notification.service';
import {
  jobPollSerpro,
  jobExpiryAlerts,
  jobCollectConformidade,
  jobPreventiveRenewal,
} from '../services/consultri-scheduler.service';
import { getOperatorPartnerId } from '../utils/operator';
import { generateConsultriReport } from '../services/consultri-report.service';

async function logAudit(
  procurationId: string,
  event: string,
  message: string,
  actorId?: string,
  payload?: any,
) {
  try {
    await prisma.procurationAudit.create({
      data: {
        procurationId,
        event,
        message,
        actorType: actorId ? 'user' : 'system',
        actorId,
        payload,
      },
    });
  } catch (e: any) {
    logger.error('Erro audit procuration:', e.message);
  }
}

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
    const { status, type, lawyerScenario, clientId, procuradorEntityId, procuradorCnpj, presetKey, serproStatus } = req.query;
    const where: any = {};
    if (status) where.status = status as string;
    if (type) where.type = type as string;
    if (lawyerScenario) where.lawyerScenario = lawyerScenario as string;
    if (clientId) where.clientId = clientId as string;
    if (procuradorEntityId) where.procuradorEntityId = procuradorEntityId as string;
    if (procuradorCnpj) where.procuradorCnpj = String(procuradorCnpj).replace(/\D/g, '');
    if (presetKey) where.presetKey = presetKey as string;
    if (serproStatus) where.serproStatus = serproStatus as string;

    const procurations = await prisma.procuration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { procuradorEntity: { select: { id: true, razaoSocial: true, cnpj: true, cor: true } } },
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
// PRESETS DE PROCURACAO ELETRONICA (CONSULTRI, ATOM, ...)
// ============================================================

// GET /api/procuration/presets — lista presets disponiveis
router.get('/presets', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const presets = listProcuracaoPresets().map(p => ({
      key: p.key,
      razaoSocial: p.razaoSocial,
      nomeFantasia: p.nomeFantasia,
      cnpj: p.cnpj,
      prazoMeses: p.prazoMeses,
      versaoDoc: p.versaoDoc,
      totalPoderes: p.poderes.length,
      poderes: p.poderes,
    }));
    res.json({ success: true, data: presets });
  } catch (err: any) {
    logger.error('Erro ao listar presets:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar presets' });
  }
});

// POST /api/procuration/generate-preset — gera guia + registra Procuration
//   body: { clientId, presetKey, contractId? }
router.post('/generate-preset', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId, presetKey, contractId } = req.body as {
      clientId: string;
      presetKey: ProcuracaoPresetKey;
      contractId?: string;
    };

    if (!clientId || !presetKey) {
      return res.status(400).json({ success: false, error: 'clientId e presetKey sao obrigatorios' });
    }

    const preset = getProcuracaoPreset(presetKey);
    if (!preset) {
      return res.status(400).json({ success: false, error: `Preset desconhecido: ${presetKey}` });
    }

    // resolver dados do cliente (suporta analise viability_ ou user)
    let clienteNome = '';
    let clienteCnpj = '';
    let clienteEndereco = '';
    let representanteNome = '';
    let representanteCpf = '';
    let representanteRg: string | undefined;
    let representanteCargo: string | undefined;
    let clienteCidade = 'Rio de Janeiro';
    let realClientId = clientId;
    let partnerId: string | null = null;

    if (clientId.startsWith('analysis_')) {
      const analysisId = clientId.replace('analysis_', '');
      const analysis = await prisma.viabilityAnalysis.findUnique({ where: { id: analysisId } });
      if (!analysis) return res.status(404).json({ success: false, error: 'Analise nao encontrada' });
      clienteNome = analysis.companyName || 'EMPRESA';
      clienteCnpj = analysis.cnpj || '';
      if (analysis.partnerId) partnerId = analysis.partnerId;
    } else {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client) return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
      clienteNome = client.company || client.name || 'EMPRESA';
      clienteCnpj = client.cnpj || '';
      clienteEndereco = [client.endereco, client.cidade, client.estado].filter(Boolean).join(', ') || '';
      representanteNome = client.legalRepName || client.name || '';
      representanteCpf = client.legalRepCpf || '';
      representanteRg = client.legalRepRg || undefined;
      representanteCargo = client.legalRepCargo || undefined;
      clienteCidade = client.cidade || 'Rio de Janeiro';
    }

    const procParams: ProcurationParams = {
      type: 'ecac_preset',
      lawyerScenario: 'partner_lawyer',
      clienteNome,
      clienteCnpj,
      clienteEndereco,
      representanteNome,
      representanteCpf,
      representanteRg,
      representanteCargo,
      prazoAnos: Math.max(1, Math.round(preset.prazoMeses / 12)),
      poderes: preset.poderes,
      cidade: clienteCidade,
      presetKey: preset.key,
    };

    const documentText = generateProcurationDocument(procParams);

    const validadeDate = new Date();
    validadeDate.setMonth(validadeDate.getMonth() + preset.prazoMeses);

    const procuration = await prisma.procuration.create({
      data: {
        clientId: realClientId,
        contractId: contractId || null,
        partnerId,
        type: 'ecac_preset',
        lawyerScenario: 'partner_lawyer',
        outorgadoAtom: false,
        outorgadoAdv: false,
        status: 'generated',
        prazoAnos: Math.max(1, Math.round(preset.prazoMeses / 12)),
        poderes: preset.poderes as any,
        documentText,
        dataValidade: validadeDate,
        presetKey: preset.key,
        procuradorCnpj: preset.cnpj,
        procuradorNome: preset.razaoSocial,
        serproStatus: 'pending_serpro',
      },
    });

    await logAudit(procuration.id, 'created', `Procuracao criada via preset ${preset.key}`, (req as any).user?.userId);
    await logAudit(procuration.id, 'guide_generated', `Guia gerado (${preset.poderes.length} poderes, ${preset.prazoMeses}m)`);

    logger.info(`Procuracao preset=${preset.key} gerada: ${procuration.id} cliente=${clienteNome} (${clienteCnpj})`);
    res.json({ success: true, data: procuration });
  } catch (err: any) {
    logger.error('Erro ao gerar procuracao por preset:', err);
    res.status(500).json({ success: false, error: 'Erro ao gerar procuracao: ' + (err.message || '') });
  }
});

// ============================================================
// CONVITES (link magico) + AUDIT + RENOVACAO + TRIGGERS
// ============================================================

// POST /api/procuration/:id/invite — gera invite com token e dispara notificacao
router.post('/:id/invite', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientEmail, recipientPhone, recipientName, expiresInDays } = req.body || {};

    const proc = await prisma.procuration.findUnique({ where: { id } });
    if (!proc) return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + (expiresInDays || 14) * 24 * 60 * 60 * 1000);

    const invite = await prisma.procurationInvite.create({
      data: {
        procurationId: id,
        token,
        recipientEmail: recipientEmail || null,
        recipientPhone: recipientPhone || null,
        recipientName: recipientName || null,
        expiresAt,
        createdById: (req as any).user?.userId || null,
      },
    });

    // Atualiza responsavel na procuration se ainda nao tiver
    if (recipientEmail || recipientPhone) {
      await prisma.procuration.update({
        where: { id },
        data: {
          responsavelEmail: proc.responsavelEmail || recipientEmail || null,
          responsavelPhone: proc.responsavelPhone || recipientPhone || null,
        },
      });
    }

    // Dispara notificacao
    let clienteNome = 'Cliente';
    if (proc.clientId.startsWith('analysis_')) {
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: proc.clientId.replace('analysis_', '') } });
      clienteNome = a?.companyName || 'Cliente';
    } else {
      const u = await prisma.user.findUnique({ where: { id: proc.clientId } });
      clienteNome = u?.company || u?.name || 'Cliente';
    }

    const results = await notificationService.notifyInvite({
      inviteId: invite.id,
      token,
      recipientEmail: invite.recipientEmail,
      recipientPhone: invite.recipientPhone,
      recipientName: invite.recipientName || 'Responsavel',
      clienteNome,
      procuradorNome: proc.procuradorNome || 'CONSULTRI',
    });

    await logAudit(id, 'invite_sent',
      `Convite gerado para ${recipientName || recipientEmail || recipientPhone}`,
      (req as any).user?.userId,
      { inviteId: invite.id, notificationResults: results.map(r => ({ channel: r.channel, status: r.status })) },
    );

    res.json({ success: true, data: { invite, link: `/outorga/${token}`, notifications: results } });
  } catch (err: any) {
    logger.error('Erro ao gerar invite:', err);
    res.status(500).json({ success: false, error: 'Erro ao gerar invite: ' + (err.message || '') });
  }
});

// GET /api/procuration/:id/invites — lista convites
router.get('/:id/invites', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const invites = await prisma.procurationInvite.findMany({
      where: { procurationId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invites });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao listar invites' });
  }
});

// GET /api/procuration/:id/audit — timeline de auditoria
router.get('/:id/audit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const audits = await prisma.procurationAudit.findMany({
      where: { procurationId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: audits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao buscar auditoria' });
  }
});

// POST /api/procuration/:id/renew — duplica com nova vigencia
router.post('/:id/renew', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const original = await prisma.procuration.findUnique({ where: { id } });
    if (!original) return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });

    const preset = getProcuracaoPreset(original.presetKey || 'consultri');
    const prazoMeses = preset?.prazoMeses || (original.prazoAnos || 1) * 12;
    const newValidade = new Date();
    newValidade.setMonth(newValidade.getMonth() + prazoMeses);

    const novo = await prisma.procuration.create({
      data: {
        clientId: original.clientId,
        contractId: original.contractId,
        partnerId: original.partnerId,
        type: original.type,
        lawyerScenario: original.lawyerScenario,
        status: 'generated',
        outorgadoAtom: original.outorgadoAtom,
        outorgadoAdv: original.outorgadoAdv,
        advogadoNome: original.advogadoNome,
        advogadoOab: original.advogadoOab,
        advogadoCpf: original.advogadoCpf,
        advogadoEndereco: original.advogadoEndereco,
        uf: original.uf,
        prazoAnos: original.prazoAnos,
        poderes: original.poderes as any,
        documentText: original.documentText,
        dataValidade: newValidade,
        presetKey: original.presetKey,
        procuradorCnpj: original.procuradorCnpj,
        procuradorNome: original.procuradorNome,
        serproStatus: 'pending_serpro',
        responsavelEmail: original.responsavelEmail,
        responsavelPhone: original.responsavelPhone,
      },
    });

    await prisma.procuration.update({
      where: { id: original.id },
      data: { status: 'expired' },
    });

    await logAudit(original.id, 'renewed', `Renovada como ${novo.id} (vigencia ate ${newValidade.toISOString()})`, (req as any).user?.userId, { newProcurationId: novo.id });
    await logAudit(novo.id, 'created', `Renovacao da procuracao ${original.id}`, (req as any).user?.userId);

    res.json({ success: true, data: novo, previousId: original.id });
  } catch (err: any) {
    logger.error('Erro ao renovar:', err);
    res.status(500).json({ success: false, error: 'Erro ao renovar: ' + (err.message || '') });
  }
});

// ============================================================
// MODO HIBRIDO — Outorga automatica via SERPRO AUTENTICAPROCURADOR
// ============================================================

// GET /api/procuration/auto-grant/capability — descobre se o contrato
// SERPRO permite outorga programatica (cache 24h no DB seria ideal,
// mas por ora consultamos on-demand).
router.get('/auto-grant/capability', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const conn = await prisma.serproConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn) {
      return res.json({
        success: true,
        data: { supported: false, reason: 'sem_conexao_serpro_ativa' },
      });
    }

    const creds = {
      consumerKey: conn.consumerKey,
      consumerSecret: conn.consumerSecret,
      certBase64: conn.certBase64 || undefined,
      certPassword: conn.certPassword || undefined,
      environment: (conn.environment || 'trial') as 'trial' | 'production',
    };

    const result = await serproService.checkAutoGrantCapability(creds as any, conn.cnpj);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/procuration/:id/auto-grant
//   body opcional: { xmlAssinadoBase64 }
// Tenta outorga programatica. Em caso de falha, atualiza grantMode
// para 'manual_invite' e o caller cai pro link magico.
router.post('/:id/auto-grant', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { xmlAssinadoBase64 } = req.body || {};

    const proc = await prisma.procuration.findUnique({ where: { id } });
    if (!proc) return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });
    if (!proc.procuradorCnpj) {
      return res.status(400).json({ success: false, error: 'Procuracao sem procuradorCnpj' });
    }

    // Resolve outorgante CNPJ
    let outorganteCnpj = '';
    if (proc.clientId.startsWith('analysis_')) {
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: proc.clientId.replace('analysis_', '') } });
      outorganteCnpj = a?.cnpj || '';
    } else {
      const u = await prisma.user.findUnique({ where: { id: proc.clientId } });
      outorganteCnpj = u?.cnpj || '';
    }
    if (!outorganteCnpj) {
      return res.status(400).json({ success: false, error: 'CNPJ outorgante nao encontrado' });
    }

    const conn = await prisma.serproConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn) {
      return res.status(400).json({ success: false, error: 'Nenhuma conexao SERPRO ativa' });
    }

    await prisma.procuration.update({
      where: { id },
      data: { autoGrantStatus: 'attempting', autoGrantAttemptedAt: new Date() },
    });

    const creds = {
      consumerKey: conn.consumerKey,
      consumerSecret: conn.consumerSecret,
      certBase64: conn.certBase64 || undefined,
      certPassword: conn.certPassword || undefined,
      environment: (conn.environment || 'trial') as 'trial' | 'production',
    };

    const result = await serproService.cadastrarProcuracaoAuto(
      creds as any,
      conn.cnpj,
      outorganteCnpj,
      proc.procuradorCnpj,
      xmlAssinadoBase64,
      (proc.poderes as any) || undefined,
    );

    if (result.success) {
      await prisma.procuration.update({
        where: { id },
        data: {
          grantMode: 'auto_serpro',
          autoGrantStatus: 'success',
          autoGrantProtocol: result.protocol || null,
          status: 'signed',
          dataAssinatura: new Date(),
        },
      });
      await logAudit(id, 'auto_grant_success',
        `Outorga programatica concluida (protocolo ${result.protocol || 'sem protocolo'})`,
        (req as any).user?.userId, { protocol: result.protocol });
      return res.json({ success: true, mode: 'auto_serpro', protocol: result.protocol });
    }

    // Falhou — marca como fallback pro manual
    await prisma.procuration.update({
      where: { id },
      data: {
        grantMode: 'manual_invite',
        autoGrantStatus: 'failed',
        autoGrantError: result.reason || 'desconhecido',
      },
    });
    await logAudit(id, 'auto_grant_failed',
      `Auto-grant indisponivel: ${result.reason}. Fluxo manual sera utilizado.`,
      (req as any).user?.userId, result);

    res.json({
      success: false,
      mode: 'manual_invite',
      reason: result.reason,
      message: 'Outorga automatica indisponivel neste cenario. Use o convite manual.',
    });
  } catch (err: any) {
    logger.error('Erro auto-grant:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/procuration/:id/detect-revocation
// Forca uma verificacao especifica de revogacao no e-CAC
router.post('/:id/detect-revocation', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proc = await prisma.procuration.findUnique({ where: { id } });
    if (!proc) return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });

    if (proc.serproStatus !== 'active') {
      return res.json({ success: true, message: 'Procuracao nao esta ativa — sem revogacao a detectar' });
    }

    const conn = await prisma.serproConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn || !proc.procuradorCnpj) {
      return res.status(400).json({ success: false, error: 'Sem conexao SERPRO ou procurador' });
    }

    let outorganteCnpj = '';
    if (proc.clientId.startsWith('analysis_')) {
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: proc.clientId.replace('analysis_', '') } });
      outorganteCnpj = a?.cnpj || '';
    } else {
      const u = await prisma.user.findUnique({ where: { id: proc.clientId } });
      outorganteCnpj = u?.cnpj || '';
    }

    const creds = {
      consumerKey: conn.consumerKey,
      consumerSecret: conn.consumerSecret,
      certBase64: conn.certBase64 || undefined,
      certPassword: conn.certPassword || undefined,
      environment: (conn.environment || 'trial') as 'trial' | 'production',
    };

    const result = await serproService.checkProcuracao(creds as any, conn.cnpj, outorganteCnpj, proc.procuradorCnpj);
    const stillActive = !!result?.success && !!result?.data;

    if (!stillActive) {
      await prisma.procuration.update({
        where: { id },
        data: {
          serproStatus: 'revoked_detected',
          status: 'revoked',
          revocationDetectedAt: new Date(),
        },
      });
      await logAudit(id, 'revoked', 'Revogacao detectada via OBTERPROCURACAO41 (procuracao nao retorna mais)', (req as any).user?.userId);
      return res.json({ success: true, revoked: true });
    }
    res.json({ success: true, revoked: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// TRIGGERS MANUAIS DOS JOBS (admin) — util para teste/operacao
// ============================================================

router.post('/jobs/poll-serpro', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await jobPollSerpro();
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/jobs/expiry-alerts', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await jobExpiryAlerts();
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/jobs/collect-conformidade', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await jobCollectConformidade();
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/jobs/preventive-renewal', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await jobPreventiveRenewal();
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Relatorio consolidado por cliente (HTML imprimivel -> PDF via Ctrl+P)
router.get('/:id/report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const anoBase = req.query.anoBase ? parseInt(String(req.query.anoBase), 10) : undefined;
    const includeCrossAnalysis = String(req.query.cross || 'true') !== 'false';
    const html = await generateConsultriReport({
      procurationId: req.params.id,
      anoBase,
      includeCrossAnalysis,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// EXPORT CSV da carteira CONSULTRI
// ============================================================
router.get('/carteira/csv', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { presetKey } = req.query;
    const where: any = presetKey ? { presetKey: presetKey as string } : {};
    const procs = await prisma.procuration.findMany({ where, orderBy: { createdAt: 'desc' } });

    const clientIds = [...new Set(procs.map(p => p.clientId))];
    const users = await prisma.user.findMany({
      where: { id: { in: clientIds.filter(id => !id.startsWith('analysis_')) } },
      select: { id: true, name: true, company: true, cnpj: true, email: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const rows = [
      ['Cliente', 'CNPJ', 'Procurador', 'CNPJ Procurador', 'Status', 'SERPRO', 'Poderes Outorgados', 'Poderes Faltando', 'Vigencia', 'Dias Restantes', 'Ultima Verificacao', 'Responsavel Email', 'Responsavel Phone'],
    ];
    const now = Date.now();
    for (const p of procs) {
      const u = userMap[p.clientId];
      const diff = p.serproDiff as any;
      const dias = p.dataValidade ? Math.ceil((new Date(p.dataValidade).getTime() - now) / (24 * 60 * 60 * 1000)) : '';
      rows.push([
        u?.company || u?.name || p.clientId,
        u?.cnpj || '',
        p.procuradorNome || '',
        p.procuradorCnpj || '',
        p.status,
        p.serproStatus || '',
        diff?.granted?.length?.toString() || '0',
        diff?.missing?.length?.toString() || '0',
        p.dataValidade ? new Date(p.dataValidade).toISOString().slice(0, 10) : '',
        dias.toString(),
        p.lastSerproCheckAt ? new Date(p.lastSerproCheckAt).toISOString() : '',
        p.responsavelEmail || '',
        p.responsavelPhone || '',
      ]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="carteira-consultri-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err: any) {
    logger.error('Erro export CSV:', err);
    res.status(500).json({ success: false, error: 'Erro export CSV: ' + err.message });
  }
});

// POST /api/procuration/:id/check-serpro — chama OBTERPROCURACAO41 e atualiza diff
//   body opcional: { connectionId } — usa a primeira ativa caso omitido
router.post('/:id/check-serpro', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { connectionId } = req.body || {};

    const procuration = await prisma.procuration.findUnique({ where: { id } });
    if (!procuration) {
      return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });
    }
    if (!procuration.procuradorCnpj) {
      return res.status(400).json({
        success: false,
        error: 'Procuracao sem procuradorCnpj (preset). Gere a procuracao via /generate-preset',
      });
    }

    // resolver CNPJ do outorgante (cliente final)
    let outorganteCnpj = '';
    if (procuration.clientId.startsWith('analysis_')) {
      const analysisId = procuration.clientId.replace('analysis_', '');
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: analysisId } });
      outorganteCnpj = a?.cnpj || '';
    } else {
      const u = await prisma.user.findUnique({ where: { id: procuration.clientId } });
      outorganteCnpj = u?.cnpj || '';
    }
    if (!outorganteCnpj) {
      return res.status(400).json({ success: false, error: 'CNPJ do outorgante nao encontrado' });
    }

    // resolver SerproConnection (contratante)
    let conn = null as any;
    if (connectionId) {
      conn = await prisma.serproConnection.findUnique({ where: { id: connectionId } });
    } else {
      conn = await prisma.serproConnection.findFirst({
        where: { status: 'active' },
        orderBy: { updatedAt: 'desc' },
      });
    }
    if (!conn) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma conexao SERPRO ativa disponivel. Cadastre em /admin/serpro',
      });
    }

    const creds = {
      consumerKey: conn.consumerKey,
      consumerSecret: conn.consumerSecret,
      certBase64: conn.certBase64 || undefined,
      certPassword: conn.certPassword || undefined,
      environment: (conn.environment || 'trial') as 'trial' | 'production',
    };

    const result = await serproService.checkProcuracao(
      creds as any,
      conn.cnpj,
      outorganteCnpj,
      procuration.procuradorCnpj,
    );

    const granted = !!result?.success && !!result?.data;
    const diff = granted
      ? diffPoderes(procuration.presetKey || 'consultri', result.data)
      : { granted: [], missing: (procuration.poderes as any) || [], extras: [] };

    let serproStatus: string;
    if (!granted) serproStatus = 'not_found';
    else if (diff.missing.length === 0) serproStatus = 'active';
    else serproStatus = 'partial';

    const updated = await prisma.procuration.update({
      where: { id },
      data: {
        lastSerproCheckAt: new Date(),
        serproStatus,
        serproDiff: diff as any,
        serproRaw: result?.raw || null,
        status: serproStatus === 'active' ? 'active' : procuration.status,
      },
    });

    // Loga no SerproLog para rastreabilidade
    await prisma.serproLog.create({
      data: {
        connectionId: conn.id,
        service: 'procuracoes',
        endpoint: 'OBTERPROCURACAO41',
        statusCode: granted ? 200 : 404,
        success: granted,
        responseData: result?.raw as any,
        errorMessage: granted ? null : 'Procuracao nao encontrada no e-CAC',
        durationMs: result?.durationMs || 0,
      },
    });

    res.json({ success: true, data: updated, diff, serproStatus });
  } catch (err: any) {
    logger.error('Erro ao verificar procuracao no SERPRO:', err);
    res.status(500).json({ success: false, error: 'Erro ao verificar SERPRO: ' + (err.message || '') });
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
