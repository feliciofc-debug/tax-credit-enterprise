import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

const BYCEO_TOKEN = process.env.BYCEO_API_TOKEN || 'byceo-taxcredit-2026';

function authenticateByCEO(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-byceo-token'] as string;
  if (!token || token !== BYCEO_TOKEN) {
    return res.status(401).json({ error: 'Token invalido ou ausente. Use header X-ByCEO-Token.' });
  }
  next();
}

router.use(authenticateByCEO);

// ============================================================
// GET /api/v1/byceo/contratos
// Lista todos os contratos ativos
// ============================================================
router.get('/contratos', async (_req: Request, res: Response) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { status: { not: 'cancelled' } },
      include: {
        client: { select: { name: true, company: true, cnpj: true, email: true } },
        partner: { select: { name: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = contracts.map(c => ({
      id: c.id,
      cnpj: c.client?.cnpj || null,
      razao_social: c.client?.company || c.client?.name || 'N/D',
      email: c.client?.email || null,
      contract_number: c.contractNumber,
      contract_type: c.contractType,
      data_contrato: c.createdAt.toISOString().split('T')[0],
      status: c.status,
      setup_fee: c.setupFee,
      setup_fee_paid: c.setupFeePaid,
      valor_total_identificado: c.estimatedCredits || 0,
      split: {
        cliente: c.clientSplitPercent,
        plataforma: c.platformSplitPercent,
        parceiro: c.partnerSplitPercent,
      },
      parceiro: c.partner?.company || c.partner?.name || null,
      advogado: c.lawyerName || null,
      advogado_oab: c.lawyerOab || null,
    }));

    return res.json({
      success: true,
      total: result.length,
      contratos: result,
    });
  } catch (error: any) {
    logger.error('[ByCEO] Erro ao listar contratos:', error.message);
    return res.status(500).json({ error: 'Erro interno ao listar contratos' });
  }
});

// ============================================================
// GET /api/v1/byceo/contratos/:cnpj
// Detalhes de um contrato por CNPJ
// ============================================================
router.get('/contratos/:cnpj', async (req: Request, res: Response) => {
  try {
    const { cnpj } = req.params;
    const cnpjClean = cnpj.replace(/[^\d]/g, '');

    const contracts = await prisma.contract.findMany({
      where: {
        client: { cnpj: { contains: cnpjClean } },
        status: { not: 'cancelled' },
      },
      include: {
        client: { select: { name: true, company: true, cnpj: true, email: true } },
        partner: { select: { name: true, company: true, cnpj: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (contracts.length === 0) {
      return res.status(404).json({ error: 'Nenhum contrato encontrado para este CNPJ' });
    }

    const contract = contracts[0] as any;

    let analysis = await prisma.viabilityAnalysis.findFirst({
      where: { cnpj: { contains: cnpjClean }, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    let oportunidades: any[] = [];
    if (analysis?.opportunities) {
      try { oportunidades = JSON.parse(analysis.opportunities); } catch {}
    }

    return res.json({
      success: true,
      contrato: {
        id: contract.id,
        cnpj: contract.client?.cnpj || cnpj,
        razao_social: contract.client?.company || contract.client?.name || 'N/D',
        email: contract.client?.email || null,
        contract_number: contract.contractNumber,
        contract_type: contract.contractType,
        data_contrato: contract.createdAt.toISOString().split('T')[0],
        status: contract.status,
        setup_fee: contract.setupFee,
        setup_fee_paid: contract.setupFeePaid,
        setup_fee_paid_at: contract.setupFeePaidAt?.toISOString() || null,
        valor_total_identificado: contract.estimatedCredits || 0,
        split: {
          cliente: contract.clientSplitPercent,
          plataforma: contract.platformSplitPercent,
          parceiro: contract.partnerSplitPercent,
        },
        parceiro: contract.partner ? {
          nome: contract.partner.company || contract.partner.name,
          cnpj: contract.partner.cnpj || null,
        } : null,
        advogado: contract.lawyerName || null,
        advogado_oab: contract.lawyerOab || null,
        escrow: {
          agencia: contract.escrowAgencia || null,
          conta: contract.escrowConta || null,
        },
        assinaturas: {
          parceiro: contract.partnerSignedAt?.toISOString() || null,
          cliente: contract.clientSignedAt?.toISOString() || null,
        },
        oportunidades: oportunidades.map((op: any, i: number) => ({
          id: i + 1,
          titulo: op.tese || op.titulo || op.tipo || 'Oportunidade identificada',
          tributo: op.tributo || 'N/D',
          valor_estimado: op.valorEstimado || op.valor || 0,
          probabilidade: op.probabilidade || op.score || 70,
          complexidade: op.complexidade || 'media',
          status: 'identificado',
          fundamentacao: op.fundamentacaoLegal || null,
          risco: op.risco || null,
        })),
        analise: analysis ? {
          id: analysis.id,
          score: analysis.viabilityScore,
          score_label: analysis.scoreLabel,
          data_analise: analysis.createdAt.toISOString().split('T')[0],
          resumo: analysis.aiSummary || null,
        } : null,
      },
    });
  } catch (error: any) {
    logger.error('[ByCEO] Erro ao buscar contrato:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar contrato' });
  }
});

// ============================================================
// GET /api/v1/byceo/extratos/:cnpj
// Extrato gerado para um CNPJ
// ============================================================
router.get('/extratos/:cnpj', async (req: Request, res: Response) => {
  try {
    const { cnpj } = req.params;
    const cnpjClean = cnpj.replace(/[^\d]/g, '');

    const analysis = await prisma.viabilityAnalysis.findFirst({
      where: { cnpj: { contains: cnpjClean }, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Nenhum extrato encontrado para este CNPJ' });
    }

    let oportunidades: any[] = [];
    let alertas: string[] = [];
    try { oportunidades = JSON.parse(analysis.opportunities || '[]'); } catch {}
    try { alertas = JSON.parse(analysis.risks || '[]'); } catch {}
    if (typeof alertas === 'string') alertas = [alertas];

    return res.json({
      success: true,
      extrato: {
        cnpj: analysis.cnpj || cnpj,
        razao_social: analysis.companyName,
        regime: analysis.regime || null,
        setor: analysis.sector || null,
        score: analysis.viabilityScore,
        score_label: analysis.scoreLabel,
        valor_total_estimado: analysis.estimatedCredit || 0,
        data_analise: analysis.createdAt.toISOString().split('T')[0],
        status: analysis.status,
        resumo_executivo: analysis.aiSummary || null,
        oportunidades: oportunidades.map((op: any, i: number) => ({
          id: i + 1,
          titulo: op.tese || op.titulo || op.tipo || 'Oportunidade',
          tributo: op.tributo || 'N/D',
          valor_estimado: op.valorEstimado || op.valor || 0,
          probabilidade: op.probabilidade || op.score || 70,
          complexidade: op.complexidade || 'media',
          descricao: op.descricao || op.description || null,
          fundamentacao_legal: op.fundamentacaoLegal || op.base_legal || null,
          risco: op.risco || null,
          passos_praticos: op.passosPraticos || op.steps || [],
        })),
        alertas,
        documentos_gerados: ['extrato', 'parecer', 'requerimento'],
        docs_analisados: analysis.docsUploaded || 0,
      },
    });
  } catch (error: any) {
    logger.error('[ByCEO] Erro ao buscar extrato:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar extrato' });
  }
});

// ============================================================
// GET /api/v1/byceo/status/:cnpj
// Status atual do processo de um CNPJ
// ============================================================
router.get('/status/:cnpj', async (req: Request, res: Response) => {
  try {
    const { cnpj } = req.params;
    const cnpjClean = cnpj.replace(/[^\d]/g, '');

    const [analysis, contract] = await Promise.all([
      prisma.viabilityAnalysis.findFirst({
        where: { cnpj: { contains: cnpjClean } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.findFirst({
        where: { client: { cnpj: { contains: cnpjClean } }, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { company: true, name: true } } },
      }),
    ]);

    if (!analysis && !contract) {
      return res.status(404).json({ error: 'Nenhum registro encontrado para este CNPJ' });
    }

    let etapa = 'nao_iniciado';
    let proximos_passos: string[] = [];
    let alertas: string[] = [];

    if (!analysis) {
      etapa = 'cadastrado';
      proximos_passos = ['Enviar documentos SPED para analise'];
    } else if (analysis.status === 'pending') {
      etapa = 'aguardando_analise';
      proximos_passos = ['Analise em fila de processamento'];
    } else if (analysis.status === 'analyzing') {
      etapa = 'em_analise';
      proximos_passos = ['Analise em andamento — aguardar conclusao'];
    } else if (analysis.status === 'completed' && !contract) {
      etapa = 'extrato_gerado';
      proximos_passos = [
        'Apresentar extrato ao cliente',
        'Assinar contrato de prestacao de servicos',
        'Pagar taxa de adesao R$ 2.000',
      ];
    } else if (contract && !contract.setupFeePaid) {
      etapa = 'contrato_assinado';
      proximos_passos = [
        'Aguardar pagamento da taxa de adesao',
        'Apos pagamento: gerar documentos de formalizacao',
      ];
    } else if (contract && contract.setupFeePaid && contract.status === 'active') {
      etapa = 'em_andamento';
      proximos_passos = [
        'Gerar kit de formalizacao (Requerimento SEFAZ + PER/DCOMP)',
        'Protocolar documentos nos orgaos competentes',
        'Acompanhar tramitacao',
      ];
    } else if (contract && contract.status === 'completed') {
      etapa = 'concluido';
      proximos_passos = ['Processo concluido — creditos recuperados'];
    }

    if (analysis?.risks) {
      try {
        const risks = JSON.parse(analysis.risks);
        alertas = Array.isArray(risks) ? risks : [risks];
      } catch {}
    }

    return res.json({
      success: true,
      status: {
        cnpj: cnpj,
        razao_social: contract?.client?.company || contract?.client?.name || analysis?.companyName || 'N/D',
        etapa,
        score: analysis?.viabilityScore || null,
        valor_total_estimado: analysis?.estimatedCredit || contract?.estimatedCredits || 0,
        data_analise: analysis?.createdAt?.toISOString().split('T')[0] || null,
        contrato: contract ? {
          numero: contract.contractNumber,
          tipo: contract.contractType,
          status: contract.status,
          taxa_paga: contract.setupFeePaid,
        } : null,
        proximos_passos,
        alertas,
      },
    });
  } catch (error: any) {
    logger.error('[ByCEO] Erro ao buscar status:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar status' });
  }
});

export default router;
