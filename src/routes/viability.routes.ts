import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import { getOperatorPartnerId } from '../utils/operator';
import { claudeService } from '../services/claude.service';
import { documentProcessor } from '../services/documentProcessor.service';

const router = Router();

// Upload config — agora usa memoryStorage (buffer direto, sem salvar em disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (documentProcessor.isSupported(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Tipo de arquivo não suportado: ${file.originalname}. ` +
        `Extensões aceitas: ${documentProcessor.getSupportedExtensions().join(', ')}`
      ));
    }
  },
});

/**
 * POST /api/viability/analyze
 * Parceiro envia docs e recebe análise de viabilidade com Opus 4.5
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

    // Processar todos os documentos e concatenar textos
    let combinedText = '';
    let totalPages = 0;
    let anyOcrUsed = false;
    let overallQuality: 'high' | 'medium' | 'low' = 'high';

    for (const file of files) {
      try {
        const processed = await documentProcessor.processDocument(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        combinedText += `\n--- ${file.originalname} ---\n${processed.text}\n`;
        totalPages += processed.pageCount;
        if (processed.ocrUsed) anyOcrUsed = true;

        // Qualidade geral é a menor encontrada
        if (processed.quality === 'low') overallQuality = 'low';
        else if (processed.quality === 'medium' && overallQuality === 'high') overallQuality = 'medium';
      } catch (docError: any) {
        logger.warn(`Falha ao processar ${file.originalname}: ${docError.message}`);
        // Continuar com os outros documentos
      }
    }

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

    // Construir info da empresa (usar metadados extraídos como fallback)
    const lastProcessed = await documentProcessor.processDocument(
      files[0].buffer,
      files[0].originalname,
      files[0].mimetype
    ).catch(() => null);

    const companyInfo = {
      name: companyName || lastProcessed?.metadata.extractedCompanyName || 'Não informado',
      cnpj: cnpj || lastProcessed?.metadata.extractedCNPJ,
      regime: regime as 'lucro_real' | 'lucro_presumido' | 'simples' | undefined,
      sector,
    };

    // Analisar com Claude Opus 4.5
    const analysis = await claudeService.analyzeDocument(
      combinedText,
      documentType || 'dre',
      companyInfo
    );

    // Determinar label a partir do score
    let scoreLabel = 'inviavel';
    if (analysis.score >= 85) scoreLabel = 'excelente';
    else if (analysis.score >= 70) scoreLabel = 'bom';
    else if (analysis.score >= 50) scoreLabel = 'medio';
    else if (analysis.score >= 30) scoreLabel = 'baixo';

    // Atualizar registro com resultado
    const updatedViability = await prisma.viabilityAnalysis.update({
      where: { id: viability.id },
      data: {
        viabilityScore: analysis.score,
        scoreLabel,
        estimatedCredit: analysis.valorTotalEstimado,
        opportunities: JSON.stringify(analysis.oportunidades),
        aiSummary: analysis.resumoExecutivo,
        risks: JSON.stringify(analysis.alertas),
        status: 'completed',
      },
    });

    logger.info(`Viability analysis completed: ${viability.id} - Score: ${analysis.score} (AI: true, Opus 4.5)`);

    return res.json({
      success: true,
      data: {
        id: updatedViability.id,
        companyName: updatedViability.companyName,
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
        metadata: {
          documentType: documentType || 'dre',
          ocrUsed: anyOcrUsed,
          quality: overallQuality,
          pageCount: totalPages,
          extractedPeriod: lastProcessed?.metadata.extractedPeriod,
          extractedCNPJ: lastProcessed?.metadata.extractedCNPJ,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in viability analysis:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na análise de viabilidade',
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

export default router;
