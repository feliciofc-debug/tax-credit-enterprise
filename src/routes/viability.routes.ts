import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import { getOperatorPartnerId } from '../utils/operator';
import { claudeService } from '../services/claude.service';
import { documentProcessor } from '../services/documentProcessor.service';
import { zipProcessor } from '../services/zipProcessor.service';

const router = Router();

// Upload config — memoryStorage (buffer direto, sem salvar em disco)
// Aceita ZIP (até 50MB) e arquivos individuais (até 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB para ZIPs
  fileFilter: (_req, file, cb) => {
    if (zipProcessor.isSupported(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Tipo de arquivo não suportado: ${file.originalname}. ` +
        `Extensões aceitas: ${zipProcessor.getSupportedExtensions().join(', ')}`
      ));
    }
  },
});

// ============================================================
// HELPER: Processar documentos e extrair texto
// Suporta: ZIP (com SPED parser), PDF, Excel, TXT, Imagens
// ============================================================
async function processUploadedFiles(files: Express.Multer.File[]) {
  let combinedText = '';
  let totalPages = 0;
  let anyOcrUsed = false;
  let overallQuality: 'high' | 'medium' | 'low' = 'high';
  let zipInfo: any = null;

  for (const file of files) {
    const ext = file.originalname.toLowerCase().split('.').pop();

    try {
      // Se for ZIP, usar o zipProcessor especial (com SPED parser)
      if (ext === 'zip') {
        logger.info(`Processando ZIP: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        const zipResult = await zipProcessor.processUpload(file.buffer, file.originalname, file.mimetype);
        combinedText += zipProcessor.buildCombinedText(zipResult);
        totalPages += zipResult.resumo.processados;
        overallQuality = zipResult.speds.length > 0 ? 'high' : 'medium';
        zipInfo = zipResult.resumo;

        // Se ZIP contém dados da empresa, logar
        if (zipResult.empresa) {
          logger.info(`ZIP empresa identificada: ${zipResult.empresa.nome} | CNPJ: ${zipResult.empresa.cnpj}`);
        }
      }
      // Se for TXT, verificar se é SPED antes de processar normalmente
      else if (ext === 'txt') {
        const zipResult = await zipProcessor.processUpload(file.buffer, file.originalname, file.mimetype);
        combinedText += zipProcessor.buildCombinedText(zipResult);
        totalPages += 1;
        if (zipResult.speds.length > 0) overallQuality = 'high';
      }
      // Demais arquivos: usar o documentProcessor existente (com OCR)
      else {
        const processed = await documentProcessor.processDocument(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        combinedText += `\n--- ${file.originalname} ---\n${processed.text}\n`;
        totalPages += processed.pageCount;
        if (processed.ocrUsed) anyOcrUsed = true;
        if (processed.quality === 'low') overallQuality = 'low';
        else if (processed.quality === 'medium' && overallQuality === 'high') overallQuality = 'medium';
      }
    } catch (docError: any) {
      logger.warn(`Falha ao processar ${file.originalname}: ${docError.message}`);
    }
  }

  return { combinedText, totalPages, anyOcrUsed, overallQuality, zipInfo };
}

// ============================================================
// ROTA 1: SCORE DE VIABILIDADE (parceiro pode fazer livremente)
// ============================================================
/**
 * POST /api/viability/analyze
 * Parceiro envia docs e recebe SCORE de viabilidade (análise rápida)
 * NÃO requer pagamento nem contrato — é a pré-triagem
 * Retorna: score, resumo, oportunidades resumidas
 */
router.post('/analyze', authenticateToken, upload.array('documents', 10), async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros e administradores' });
    }

    const { companyName, cnpj, regime, sector, annualRevenue, documentType } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa é obrigatório' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um documento para análise' });
    }

    // Criar registro da análise
    const viability = await prisma.viabilityAnalysis.create({
      data: {
        partnerId,
        companyName,
        cnpj,
        regime,
        sector,
        annualRevenue: annualRevenue ? parseFloat(annualRevenue) : null,
        docsUploaded: files.length,
        status: 'analyzing',
      },
    });

    // Processar documentos
    const { combinedText, totalPages, anyOcrUsed, overallQuality } = await processUploadedFiles(files);

    // Verificar qualidade
    if (overallQuality === 'low' || combinedText.trim().length < 200) {
      await prisma.viabilityAnalysis.update({
        where: { id: viability.id },
        data: { status: 'failed' },
      });

      return res.status(422).json({
        success: false,
        error: 'Documento com qualidade insuficiente para análise',
        details: 'Texto extraído muito curto ou ilegível. Envie PDF de melhor qualidade ou use Excel.',
        ocrUsed: anyOcrUsed,
      });
    }

    // Construir info da empresa
    const companyInfo = {
      name: companyName,
      cnpj,
      regime: regime as 'lucro_real' | 'lucro_presumido' | 'simples' | undefined,
      sector,
    };

    // SCORE DE VIABILIDADE — análise rápida (Sonnet, não Opus)
    const quickResult = await claudeService.quickAnalysis(combinedText, companyInfo);

    // Determinar label a partir do score
    let scoreLabel = 'inviavel';
    if (quickResult.score >= 85) scoreLabel = 'excelente';
    else if (quickResult.score >= 70) scoreLabel = 'bom';
    else if (quickResult.score >= 50) scoreLabel = 'medio';
    else if (quickResult.score >= 30) scoreLabel = 'baixo';

    // Atualizar registro com resultado do score + salvar texto para análise completa futura
    const updatedViability = await prisma.viabilityAnalysis.update({
      where: { id: viability.id },
      data: {
        viabilityScore: quickResult.score,
        scoreLabel,
        aiSummary: quickResult.summary,
        docsText: combinedText, // Salvar texto para reutilizar na análise completa
        status: 'completed',
      },
    });

    logger.info(`Viability SCORE completed: ${viability.id} - Score: ${quickResult.score} (quick analysis)`);

    return res.json({
      success: true,
      data: {
        id: updatedViability.id,
        companyName: updatedViability.companyName,
        score: quickResult.score,
        scoreLabel,
        viable: quickResult.viable,
        summary: quickResult.summary,
        aiPowered: true,
        // Mensagem informando próximos passos
        nextSteps: quickResult.viable
          ? 'Score positivo! Para a consulta completa: 1) Convide o cliente, 2) Cliente paga a taxa de adesão (R$ 2.000), 3) Assine o contrato entre as 3 partes, 4) Cliente insere os documentos na plataforma.'
          : 'Score baixo. Recomendamos revisar os documentos ou avaliar outro período fiscal.',
        metadata: {
          documentType: documentType || 'dre',
          ocrUsed: anyOcrUsed,
          quality: overallQuality,
          pageCount: totalPages,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in viability score:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na análise de viabilidade',
    });
  }
});

// ============================================================
// ROTA 2: CONSULTA COMPLETA (requer pagamento + contrato + docs do cliente)
// ============================================================
/**
 * POST /api/viability/full-analysis
 * Consulta completa com IA profunda (Opus 4.6)
 * REQUER:
 *   1. Contrato assinado pelo parceiro E cliente
 *   2. Taxa de adesão paga (R$ 2.000)
 *   3. Documentos enviados pelo cliente
 */
router.post('/full-analysis', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const partnerId = await getOperatorPartnerId(user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros e administradores' });
    }

    const { contractId, documentType } = req.body;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        error: 'ID do contrato é obrigatório para consulta completa',
      });
    }

    // Buscar contrato e verificar todas as condições
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, partnerId },
      include: {
        client: {
          include: {
            documents: true, // Documentos que o cliente fez upload
          },
        },
      },
    });

    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato não encontrado' });
    }

    // VERIFICAÇÃO 1: Taxa paga?
    if (!contract.setupFeePaid) {
      return res.status(403).json({
        success: false,
        error: 'Taxa de adesão não paga',
        details: `O cliente precisa pagar a taxa de adesão de R$ ${contract.setupFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} antes da consulta completa.`,
        requirement: 'payment',
      });
    }

    // VERIFICAÇÃO 2: Contrato assinado pelo parceiro?
    if (!contract.partnerSignedAt) {
      return res.status(403).json({
        success: false,
        error: 'Contrato não assinado pelo parceiro',
        details: 'O parceiro precisa assinar o contrato antes da consulta completa.',
        requirement: 'partner_signature',
      });
    }

    // VERIFICAÇÃO 3: Contrato assinado pelo cliente?
    if (!contract.clientSignedAt) {
      return res.status(403).json({
        success: false,
        error: 'Contrato não assinado pelo cliente',
        details: 'O cliente precisa assinar o contrato antes da consulta completa.',
        requirement: 'client_signature',
      });
    }

    // VERIFICAÇÃO 4: Cliente tem documentos na plataforma?
    const clientDocs = contract.client.documents;
    if (!clientDocs || clientDocs.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Nenhum documento do cliente na plataforma',
        details: 'O cliente precisa fazer upload dos documentos contábeis (DRE, Balanço, Balancete) diretamente na plataforma.',
        requirement: 'client_documents',
      });
    }

    // VERIFICAÇÃO 5: Consulta liberada?
    if (!contract.consultaLiberada) {
      // Liberar automaticamente se todas as condições acima foram atendidas
      await prisma.contract.update({
        where: { id: contract.id },
        data: { consultaLiberada: true },
      });
    }

    // Buscar buffers dos documentos do cliente no banco
    // Os documentos do cliente ficam na tabela Document
    const docsWithContent = await prisma.document.findMany({
      where: { userId: contract.clientId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Últimos 10 documentos
    });

    if (docsWithContent.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Documentos do cliente não encontrados',
      });
    }

    // Processar documentos do cliente
    let combinedText = '';
    let totalPages = 0;

    for (const doc of docsWithContent) {
      if (doc.extractedText) {
        combinedText += `\n--- ${doc.fileName} ---\n${doc.extractedText}\n`;
        totalPages += 1;
      }
    }

    if (combinedText.trim().length < 200) {
      return res.status(422).json({
        success: false,
        error: 'Documentos do cliente não contêm texto suficiente para análise completa',
      });
    }

    // Construir info da empresa com dados do cliente
    const companyInfo = {
      name: contract.client.company || contract.client.name || 'Não informado',
      cnpj: contract.client.cnpj || undefined,
      regime: (contract.client.regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
    };

    // ANÁLISE COMPLETA com Claude (modelo ANALYSIS — Opus 4.6 quando disponível)
    const analysis = await claudeService.analyzeDocument(
      combinedText,
      documentType || 'dre',
      companyInfo
    );

    // Determinar label
    let scoreLabel = 'inviavel';
    if (analysis.score >= 85) scoreLabel = 'excelente';
    else if (analysis.score >= 70) scoreLabel = 'bom';
    else if (analysis.score >= 50) scoreLabel = 'medio';
    else if (analysis.score >= 30) scoreLabel = 'baixo';

    logger.info(`Full analysis completed for contract ${contractId} - Score: ${analysis.score}`);

    return res.json({
      success: true,
      data: {
        contractId: contract.id,
        companyName: companyInfo.name,
        score: analysis.score,
        scoreLabel,
        estimatedCredit: analysis.valorTotalEstimado,
        opportunities: analysis.oportunidades,
        summary: analysis.resumoExecutivo,
        risks: analysis.alertas,
        recomendacoes: analysis.recomendacoes,
        fundamentacaoGeral: analysis.fundamentacaoGeral,
        periodoAnalisado: analysis.periodoAnalisado,
        regimeTributario: analysis.regimeTributario,
        riscoGeral: analysis.riscoGeral,
        aiPowered: true,
        fullAnalysis: true,
      },
    });
  } catch (error: any) {
    logger.error('Error in full analysis:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na consulta completa',
    });
  }
});

/**
 * GET /api/viability/list
 * Lista análises de viabilidade do parceiro
 */
router.get('/list', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito' });
    }

    const analyses = await prisma.viabilityAnalysis.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, companyName: true, cnpj: true, viabilityScore: true,
        scoreLabel: true, estimatedCredit: true, status: true,
        convertedToContractId: true, createdAt: true,
      },
    });

    return res.json({ success: true, data: analyses });
  } catch (error: any) {
    logger.error('Error listing viabilities:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar análises' });
  }
});

/**
 * GET /api/viability/:id
 * Detalhe de uma análise de viabilidade
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    const { id } = req.params;

    const viability = await prisma.viabilityAnalysis.findFirst({
      where: { id, partnerId: partnerId || undefined },
    });

    if (!viability) {
      return res.status(404).json({ success: false, error: 'Análise não encontrada' });
    }

    return res.json({
      success: true,
      data: {
        ...viability,
        opportunities: viability.opportunities ? JSON.parse(viability.opportunities) : [],
        risks: viability.risks ? JSON.parse(viability.risks) : [],
      },
    });
  } catch (error: any) {
    logger.error('Error fetching viability:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar análise' });
  }
});

// ============================================================
// ROTA ADMIN: ANÁLISE COMPLETA (Opus 4.6 — sem checks de contrato)
// ============================================================
/**
 * POST /api/viability/:id/admin-full-analysis
 * Admin executa análise profunda com Opus 4.6 em uma viabilidade existente
 * Usa os documentos já enviados no quick score
 * Retorna extrato detalhado de oportunidades com valores
 */
router.post('/:id/admin-full-analysis', authenticateToken, upload.array('documents', 10), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Apenas admin pode usar esta rota
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const { id } = req.params;
    const { documentType } = req.body;
    const files = req.files as Express.Multer.File[];

    // Buscar viabilidade existente
    const viability = await prisma.viabilityAnalysis.findFirst({
      where: { id },
    });

    if (!viability) {
      return res.status(404).json({ success: false, error: 'Análise de viabilidade não encontrada' });
    }

    // Se tem novos arquivos enviados, processar eles
    // Se não, usar o texto já extraído do quick score
    let combinedText = '';

    if (files && files.length > 0) {
      const { combinedText: newText } = await processUploadedFiles(files);
      combinedText = newText;
    } else if (viability.docsText) {
      combinedText = viability.docsText;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Nenhum documento disponível. Envie documentos ou execute um quick score primeiro.',
      });
    }

    if (combinedText.trim().length < 200) {
      return res.status(422).json({
        success: false,
        error: 'Texto insuficiente para análise completa. Envie documentos de melhor qualidade.',
      });
    }

    // Construir info da empresa
    const companyInfo = {
      name: viability.companyName,
      cnpj: viability.cnpj || undefined,
      regime: (viability.regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
      sector: viability.sector || undefined,
    };

    logger.info(`Admin full analysis started for viability ${id}`, {
      company: companyInfo.name,
      textLength: combinedText.length,
    });

    // Atualizar status
    await prisma.viabilityAnalysis.update({
      where: { id },
      data: { status: 'analyzing' },
    });

    // ANÁLISE PROFUNDA COM OPUS 4.6
    const analysis = await claudeService.analyzeDocument(
      combinedText,
      (documentType || 'dre') as 'dre' | 'balanco' | 'balancete',
      companyInfo
    );

    // Salvar resultado detalhado no banco
    await prisma.viabilityAnalysis.update({
      where: { id },
      data: {
        viabilityScore: analysis.score,
        scoreLabel: analysis.score >= 85 ? 'excelente' : analysis.score >= 70 ? 'bom' : analysis.score >= 50 ? 'medio' : analysis.score >= 30 ? 'baixo' : 'inviavel',
        estimatedCredit: analysis.valorTotalEstimado,
        opportunities: JSON.stringify(analysis.oportunidades),
        aiSummary: analysis.resumoExecutivo,
        risks: JSON.stringify(analysis.alertas),
        status: 'completed',
      },
    });

    logger.info(`Admin full analysis completed for viability ${id}`, {
      score: analysis.score,
      opportunities: analysis.oportunidades.length,
      totalEstimated: analysis.valorTotalEstimado,
    });

    return res.json({
      success: true,
      data: {
        id: viability.id,
        companyName: viability.companyName,
        cnpj: viability.cnpj,
        score: analysis.score,
        scoreLabel: analysis.score >= 85 ? 'excelente' : analysis.score >= 70 ? 'bom' : analysis.score >= 50 ? 'medio' : analysis.score >= 30 ? 'baixo' : 'inviavel',
        estimatedCredit: analysis.valorTotalEstimado,
        resumoExecutivo: analysis.resumoExecutivo,
        fundamentacaoGeral: analysis.fundamentacaoGeral,
        periodoAnalisado: analysis.periodoAnalisado,
        regimeTributario: analysis.regimeTributario,
        riscoGeral: analysis.riscoGeral,
        recomendacoes: analysis.recomendacoes,
        alertas: analysis.alertas,
        // EXTRATO DETALHADO — cada oportunidade com valores
        oportunidades: analysis.oportunidades.map(op => ({
          tipo: op.tipo,
          tributo: op.tributo,
          descricao: op.descricao,
          valorEstimado: op.valorEstimado,
          fundamentacaoLegal: op.fundamentacaoLegal,
          prazoRecuperacao: op.prazoRecuperacao,
          complexidade: op.complexidade,
          probabilidadeRecuperacao: op.probabilidadeRecuperacao,
          risco: op.risco,
          documentacaoNecessaria: op.documentacaoNecessaria,
          passosPraticos: op.passosPraticos,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Error in admin full analysis:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na análise completa',
    });
  }
});

export default router;
