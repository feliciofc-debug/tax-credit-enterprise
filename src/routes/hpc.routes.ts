// src/routes/hpc.routes.ts
// Rotas ISOLADAS para teste de integracao com HPC Go+Chapel
// NAO interfere nos endpoints existentes de viabilidade/analise
// Estas rotas sao EXCLUSIVAS para a branch hpc-integration

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { hpcGateway } from '../services/hpc-gateway.service';
import { claudeService } from '../services/claude.service';
import multer from 'multer';

const router = Router();

// Upload config — memoryStorage (buffer direto, sem disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (HPC suporta arquivos grandes)
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowed = ['zip', 'txt', 'pdf', 'xlsx', 'xls', 'csv'];
    if (ext && allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo nao suportado: ${file.originalname}. Aceitos: ${allowed.join(', ')}`));
    }
  },
});

// ============================================================
// GET /api/hpc/status
// Verifica se o HPC esta online e retorna capabilities
// ============================================================
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const gatewayInfo = hpcGateway.getInfo();
    const health = await hpcGateway.healthCheck();

    return res.json({
      success: true,
      gateway: gatewayInfo,
      hpc: health || { status: 'offline', message: 'HPC nao respondeu ao health check' },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// POST /api/hpc/analyze
// Endpoint PRINCIPAL de teste:
//   1. Recebe arquivos SPED
//   2. Envia para Go+Chapel na VPS (processamento paralelo)
//   3. Recebe dados parseados
//   4. Envia texto consolidado para Claude Opus (analise juridica)
//   5. Retorna extrato completo com oportunidades
// ============================================================
router.post('/analyze', authenticateToken, upload.array('documents', 50), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];
    const { companyName, cnpj, regime, sector, documentType } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo SPED para analise' });
    }

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
    }

    logger.info(`[HPC-ROUTE] Nova analise HPC iniciada`, {
      user: user.email,
      empresa: companyName,
      arquivos: files.length,
      tamanhoTotal: files.reduce((sum, f) => sum + f.size, 0),
    });

    // -----------------------------------------------
    // PASSO 1: Verificar se HPC esta disponivel
    // -----------------------------------------------
    const health = await hpcGateway.healthCheck();
    if (!health) {
      return res.status(503).json({
        success: false,
        error: 'Motor HPC indisponivel no momento. Tente novamente em alguns minutos.',
        fallback: 'O sistema de processamento local continua disponivel em /api/viability/analyze',
      });
    }

    // -----------------------------------------------
    // PASSO 2: Enviar para Go+Chapel (processamento paralelo)
    // -----------------------------------------------
    logger.info(`[HPC-ROUTE] Enviando ${files.length} arquivo(s) para HPC Go+Chapel...`);

    const hpcResult = await hpcGateway.processSped(
      files.map(f => ({ buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype }))
    );

    if (!hpcResult.success || !hpcResult.textoUnificado || hpcResult.textoUnificado.length < 200) {
      return res.status(422).json({
        success: false,
        error: 'HPC nao conseguiu extrair texto suficiente dos arquivos',
        hpcResult: {
          arquivosProcessados: hpcResult.arquivosProcessados,
          tempoMs: hpcResult.tempoTotalMs,
          erros: hpcResult.erros,
        },
      });
    }

    const hpcElapsed = Date.now() - startTime;
    logger.info(`[HPC-ROUTE] HPC concluiu em ${hpcElapsed}ms. Texto: ${hpcResult.textoUnificado.length} chars`);

    // -----------------------------------------------
    // PASSO 3: Enviar texto para Claude Opus (cerebro juridico)
    // -----------------------------------------------
    logger.info(`[HPC-ROUTE] Enviando para Claude Opus (analise juridica)...`);

    const companyInfo = {
      name: companyName,
      cnpj: cnpj || undefined,
      regime: (regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
      sector: sector || undefined,
    };

    const analysis = await claudeService.analyzeDocument(
      hpcResult.textoUnificado,
      documentType || 'dre',
      companyInfo
    );

    const totalElapsed = Date.now() - startTime;

    logger.info(`[HPC-ROUTE] Analise completa em ${totalElapsed}ms`, {
      hpcMs: hpcResult.tempoTotalMs,
      claudeMs: totalElapsed - hpcElapsed,
      oportunidades: analysis.oportunidades.length,
      valorTotal: analysis.valorTotalEstimado,
      score: analysis.score,
    });

    // -----------------------------------------------
    // PASSO 4: Retornar resultado completo
    // -----------------------------------------------
    return res.json({
      success: true,
      pipeline: 'hpc-go-chapel + claude-opus',
      timing: {
        hpcProcessingMs: hpcResult.tempoTotalMs,
        claudeAnalysisMs: totalElapsed - hpcElapsed,
        totalMs: totalElapsed,
      },
      hpc: {
        arquivosProcessados: hpcResult.arquivosProcessados,
        resultados: hpcResult.resultados.map(r => ({
          arquivo: r.arquivo,
          tipo: r.tipo,
          periodo: r.periodo,
          empresa: r.empresa,
          resumo: r.resumo,
          processadoEm: r.processadoEm,
        })),
        erros: hpcResult.erros,
      },
      analysis: {
        score: analysis.score,
        regimeTributario: analysis.regimeTributario,
        riscoGeral: analysis.riscoGeral,
        valorTotalEstimado: analysis.valorTotalEstimado,
        periodoAnalisado: analysis.periodoAnalisado,
        resumoExecutivo: analysis.resumoExecutivo,
        fundamentacaoGeral: analysis.fundamentacaoGeral,
        oportunidades: analysis.oportunidades,
        recomendacoes: analysis.recomendacoes,
        alertas: analysis.alertas,
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    logger.error(`[HPC-ROUTE] ERRO na analise HPC (${elapsed}ms):`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na analise HPC',
      timing: { totalMs: elapsed },
    });
  }
});

// ============================================================
// POST /api/hpc/process-only
// Teste: envia para HPC mas NAO envia para Claude
// Util para validar que o parser Go+Chapel funciona corretamente
// ============================================================
router.post('/process-only', authenticateToken, upload.array('documents', 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo' });
    }

    const health = await hpcGateway.healthCheck();
    if (!health) {
      return res.status(503).json({ success: false, error: 'HPC indisponivel' });
    }

    const hpcResult = await hpcGateway.processSped(
      files.map(f => ({ buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype }))
    );

    return res.json({
      success: true,
      pipeline: 'hpc-go-chapel-only',
      hpcResult,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
