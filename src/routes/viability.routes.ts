import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';
import { getOperatorPartnerId } from '../utils/operator';

let aiClient: Anthropic | null = null;
try {
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here') {
    aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch (e) {
  console.warn('Anthropic client not available for viability analysis');
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const router = Router();

// Upload config
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.join(os.tmpdir(), 'viability-uploads');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/viability/analyze
 * Parceiro envia docs e recebe score de viabilidade
 */
router.post('/analyze', authenticateToken, upload.array('documents', 10), async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros e administradores' });
    }

    const { companyName, cnpj, regime, sector, annualRevenue } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
    }

    // Criar registro da analise
    const viability = await prisma.viabilityAnalysis.create({
      data: {
        partnerId,
        companyName,
        cnpj,
        regime,
        sector,
        annualRevenue: annualRevenue ? parseFloat(annualRevenue) : null,
        docsUploaded: files?.length || 0,
        status: 'analyzing',
      },
    });

    // Extrair texto dos documentos PDF enviados
    let extractedText = '';
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          if (file.originalname.toLowerCase().endsWith('.pdf')) {
            const buffer = await fs.readFile(file.path);
            const pdfData = await pdfParse(buffer);
            extractedText += `\n--- ${file.originalname} ---\n${pdfData.text}\n`;
          } else {
            // Para outros tipos de arquivo, ler como texto
            const content = await fs.readFile(file.path, 'utf-8').catch(() => '');
            if (content) extractedText += `\n--- ${file.originalname} ---\n${content}\n`;
          }
        } catch (e) {
          logger.warn(`Could not extract text from ${file.originalname}`);
        }
      }
    }

    let score;
    
    // Se a IA estiver disponivel E houver documentos, usar Claude para analise real
    if (aiClient && extractedText.length > 100) {
      logger.info(`Using Claude AI for viability analysis ${viability.id}`);
      score = await analyzeWithClaude(extractedText, companyName, cnpj, regime, sector, annualRevenue);
    } else {
      // Fallback: score simulado baseado nos dados informados
      logger.info(`Using simulated score for viability analysis ${viability.id} (AI: ${!!aiClient}, docs: ${extractedText.length} chars)`);
      score = generateViabilityScore(regime, annualRevenue, files?.length || 0, sector);
    }

    const updatedViability = await prisma.viabilityAnalysis.update({
      where: { id: viability.id },
      data: {
        viabilityScore: score.score,
        scoreLabel: score.label,
        estimatedCredit: score.estimatedCredit,
        opportunities: JSON.stringify(score.opportunities),
        aiSummary: score.summary,
        risks: JSON.stringify(score.risks),
        status: 'completed',
      },
    });

    logger.info(`Viability analysis completed: ${viability.id} - Score: ${score.score} (AI: ${score.aiPowered || false})`);

    // Limpar arquivos temp
    if (files) {
      await Promise.all(files.map(f => fs.unlink(f.path).catch(() => {})));
    }

    return res.json({
      success: true,
      data: {
        id: updatedViability.id,
        companyName: updatedViability.companyName,
        score: updatedViability.viabilityScore,
        scoreLabel: updatedViability.scoreLabel,
        estimatedCredit: updatedViability.estimatedCredit,
        opportunities: score.opportunities,
        summary: updatedViability.aiSummary,
        risks: score.risks,
        aiPowered: score.aiPowered || false,
      },
    });
  } catch (error: any) {
    logger.error('Error in viability analysis:', error);
    return res.status(500).json({ success: false, error: 'Erro na analise de viabilidade' });
  }
});

/**
 * GET /api/viability/list
 * Lista analises de viabilidade do parceiro
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
    return res.status(500).json({ success: false, error: 'Erro ao listar analises' });
  }
});

/**
 * GET /api/viability/:id
 * Detalhe de uma analise de viabilidade
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    const { id } = req.params;

    const viability = await prisma.viabilityAnalysis.findFirst({
      where: { id, partnerId: partnerId || undefined },
    });

    if (!viability) {
      return res.status(404).json({ success: false, error: 'Analise nao encontrada' });
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
    return res.status(500).json({ success: false, error: 'Erro ao buscar analise' });
  }
});

/**
 * Analisa viabilidade usando Claude AI com os documentos reais
 */
async function analyzeWithClaude(
  documentText: string,
  companyName: string,
  cnpj?: string,
  regime?: string,
  sector?: string,
  annualRevenue?: string
) {
  try {
    const prompt = `Voce e um consultor tributario especializado em recuperacao de creditos tributarios no Brasil.

Analise os documentos fiscais abaixo e forneca uma avaliacao de viabilidade para recuperacao de creditos tributarios.

DADOS DA EMPRESA:
- Empresa: ${companyName}
- CNPJ: ${cnpj || 'Nao informado'}
- Regime Tributario: ${regime || 'Nao informado'}
- Setor: ${sector || 'Nao informado'}
- Faturamento Anual: ${annualRevenue ? `R$ ${parseFloat(annualRevenue).toLocaleString('pt-BR')}` : 'Nao informado'}

DOCUMENTOS FISCAIS:
${documentText.substring(0, 15000)}

RESPONDA EXATAMENTE no formato JSON abaixo (sem markdown, sem codigo, apenas o JSON puro):
{
  "score": <numero de 0 a 100>,
  "label": "<excelente|bom|medio|baixo|inviavel>",
  "estimatedCredit": <valor numerico estimado em reais>,
  "summary": "<resumo executivo em 2-3 paragrafos sobre o potencial de recuperacao>",
  "opportunities": [
    {
      "tipo": "<tipo do credito - ex: PIS/COFINS sobre Insumos>",
      "estimativa": "<faixa de valor - ex: R$ 50.000 - R$ 200.000>",
      "probabilidade": <numero de 0 a 100>,
      "fundamentacao": "<artigo de lei ou IN>"
    }
  ],
  "risks": ["<risco 1>", "<risco 2>"]
}`;

    const message = await aiClient!.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Tentar extrair JSON da resposta
    let parsed;
    try {
      // Tentar parse direto
      parsed = JSON.parse(responseText);
    } catch {
      // Tentar extrair JSON de dentro do texto
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      label: parsed.label || 'medio',
      estimatedCredit: parsed.estimatedCredit || 0,
      summary: parsed.summary || 'Analise concluida pela IA.',
      opportunities: parsed.opportunities || [],
      risks: parsed.risks || [],
      aiPowered: true,
    };
  } catch (error: any) {
    logger.error('Claude AI analysis failed, falling back to simulated:', error.message);
    // Fallback para score simulado
    const fallback = generateViabilityScore(regime, annualRevenue, 1, sector);
    fallback.summary = `[Analise por IA indisponivel] ${fallback.summary}`;
    return fallback;
  }
}

/**
 * Gera score de viabilidade baseado nos dados (fallback sem IA)
 */
function generateViabilityScore(
  regime?: string,
  annualRevenue?: string,
  docsCount?: number,
  sector?: string
) {
  let baseScore = 50;
  const opportunities: any[] = [];
  const risks: string[] = [];

  // Regime tributario
  if (regime === 'lucro_real') {
    baseScore += 25;
    opportunities.push({
      tipo: 'PIS/COFINS sobre Insumos',
      estimativa: 'R$ 150.000 - R$ 500.000',
      probabilidade: 85,
    });
    opportunities.push({
      tipo: 'Exclusao ICMS da Base PIS/COFINS',
      estimativa: 'R$ 200.000 - R$ 800.000',
      probabilidade: 95,
    });
  } else if (regime === 'lucro_presumido') {
    baseScore += 15;
    opportunities.push({
      tipo: 'IRPJ/CSLL Pago a Maior',
      estimativa: 'R$ 50.000 - R$ 200.000',
      probabilidade: 70,
    });
  } else if (regime === 'simples') {
    baseScore -= 10;
    risks.push('Empresas do Simples possuem menos oportunidades de credito');
  }

  // Faturamento
  const revenue = parseFloat(annualRevenue || '0');
  if (revenue > 10000000) {
    baseScore += 15;
    opportunities.push({
      tipo: 'ICMS-ST Retido Indevidamente',
      estimativa: 'R$ 100.000 - R$ 400.000',
      probabilidade: 72,
    });
  } else if (revenue > 1000000) {
    baseScore += 8;
  } else if (revenue > 0) {
    baseScore += 3;
  }

  // Documentos enviados
  if (docsCount && docsCount >= 3) baseScore += 5;

  // Limitar entre 0 e 100
  const score = Math.max(0, Math.min(100, baseScore));

  // Label
  let label = 'inviavel';
  if (score >= 85) label = 'excelente';
  else if (score >= 70) label = 'bom';
  else if (score >= 50) label = 'medio';
  else if (score >= 30) label = 'baixo';

  // Credito estimado
  const estimatedCredit = revenue > 0
    ? Math.round(revenue * (score / 100) * 0.05)
    : score * 5000;

  const summary = score >= 70
    ? `Empresa apresenta alto potencial de recuperacao de creditos tributarios. Regime ${regime || 'nao informado'} com faturamento compativel. Recomendamos prosseguir com a operacao.`
    : score >= 50
    ? `Empresa apresenta potencial moderado. Sugerimos analise mais detalhada dos documentos para confirmar oportunidades.`
    : `Potencial limitado de recuperacao. Risco elevado de indeferimento. Avaliar custo-beneficio antes de prosseguir.`;

  if (score < 50) risks.push('Score baixo indica risco elevado de indeferimento');
  if (!regime) risks.push('Regime tributario nao informado - score pode variar');

  return { score, label, estimatedCredit, opportunities, risks, summary, aiPowered: false };
}

export default router;
