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
import AdmZip from 'adm-zip';

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
// HELPER: Extrai arquivos de ZIPs e detecta SPED
// ============================================================

function isSpedContent(text: string): boolean {
  const lines = text.split('\n').slice(0, 20);
  return lines.some(l => /^\|[0-9A-Z]{4}\|/.test(l.trim()));
}

function extractFilesFromUploads(
  files: Express.Multer.File[]
): { buffer: Buffer; originalname: string; mimetype: string }[] {
  const extracted: { buffer: Buffer; originalname: string; mimetype: string }[] = [];

  for (const file of files) {
    const ext = file.originalname.toLowerCase().split('.').pop();

    if (ext === 'zip') {
      try {
        const zip = new AdmZip(file.buffer);
        const entries = zip.getEntries();
        logger.info(`[HPC] ZIP "${file.originalname}" contem ${entries.length} arquivo(s)`);

        for (const entry of entries) {
          if (entry.isDirectory) continue;
          const name = entry.entryName.split('/').pop() || entry.entryName;
          if (name.startsWith('.') || name.startsWith('__MACOSX')) continue;

          const entryExt = name.toLowerCase().split('.').pop();
          const buf = entry.getData();

          if (entryExt === 'txt' || entryExt === 'sped' || !entryExt) {
            const preview = buf.toString('utf-8', 0, Math.min(buf.length, 2000));
            if (isSpedContent(preview)) {
              logger.info(`[HPC] SPED encontrado dentro do ZIP: "${name}" (${buf.length} bytes)`);
              extracted.push({ buffer: buf, originalname: name, mimetype: 'text/plain' });
              continue;
            }
          }

          logger.info(`[HPC] Arquivo extraido do ZIP: "${name}" (${buf.length} bytes)`);
          extracted.push({
            buffer: buf,
            originalname: name,
            mimetype: entryExt === 'pdf' ? 'application/pdf' :
                     entryExt === 'txt' ? 'text/plain' :
                     'application/octet-stream',
          });
        }
      } catch (err: any) {
        logger.warn(`[HPC] Falha ao extrair ZIP "${file.originalname}": ${err.message}`);
        extracted.push({ buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype });
      }
    } else {
      extracted.push({ buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype });
    }
  }

  return extracted;
}

function buildFallbackText(files: { buffer: Buffer; originalname: string }[]): string {
  const parts: string[] = [];
  for (const f of files) {
    const text = f.buffer.toString('utf-8');
    if (text.length > 50) {
      parts.push(`=== ARQUIVO: ${f.originalname} ===\n${text}`);
    }
  }
  return parts.join('\n\n');
}

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

    // -----------------------------------------------
    // PASSO 0: Extrair arquivos de ZIPs
    // -----------------------------------------------
    const extractedFiles = extractFilesFromUploads(files);

    logger.info(`[HPC-ROUTE] Nova analise HPC iniciada`, {
      user: user.email,
      empresa: companyName,
      arquivosOriginais: files.length,
      arquivosExtraidos: extractedFiles.length,
      tamanhoTotal: extractedFiles.reduce((sum, f) => sum + f.buffer.length, 0),
    });

    // Separar SPED de nao-SPED
    const spedFiles: typeof extractedFiles = [];
    const otherFiles: typeof extractedFiles = [];
    for (const f of extractedFiles) {
      const preview = f.buffer.toString('utf-8', 0, Math.min(f.buffer.length, 2000));
      if (isSpedContent(preview)) {
        spedFiles.push(f);
      } else {
        otherFiles.push(f);
      }
    }

    logger.info(`[HPC-ROUTE] Classificacao: ${spedFiles.length} SPED, ${otherFiles.length} outros`);

    const companyInfo = {
      name: companyName,
      cnpj: cnpj || undefined,
      regime: (regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
      sector: sector || undefined,
    };

    let textoParaClaude = '';
    let hpcData: any = null;
    let pipeline = '';

    // -----------------------------------------------
    // PASSO 1: Se tem SPED, enviar para HPC Go+Chapel
    // -----------------------------------------------
    if (spedFiles.length > 0) {
      const health = await hpcGateway.healthCheck();

      if (health) {
        logger.info(`[HPC-ROUTE] Enviando ${spedFiles.length} arquivo(s) SPED para HPC Go+Chapel...`);

        try {
          const hpcResult = await hpcGateway.processSped(spedFiles);

          if (hpcResult.success && hpcResult.textoUnificado && hpcResult.textoUnificado.length >= 200) {
            textoParaClaude = hpcResult.textoUnificado;
            hpcData = {
              arquivosProcessados: hpcResult.arquivosProcessados,
              tempoTotalMs: hpcResult.tempoTotalMs,
              resultados: hpcResult.resultados.map(r => ({
                arquivo: r.arquivo,
                tipo: r.tipo,
                periodo: r.periodo,
                empresa: r.empresa,
                resumo: r.resumo,
                processadoEm: r.processadoEm,
              })),
              erros: hpcResult.erros,
            };
            pipeline = 'hpc-go-chapel';
            logger.info(`[HPC-ROUTE] HPC OK: ${textoParaClaude.length} chars`);
          } else {
            logger.warn(`[HPC-ROUTE] HPC retornou texto insuficiente, usando fallback`);
          }
        } catch (err: any) {
          logger.warn(`[HPC-ROUTE] HPC falhou, usando fallback: ${err.message}`);
        }
      } else {
        logger.warn(`[HPC-ROUTE] HPC offline, usando fallback direto`);
      }
    }

    // -----------------------------------------------
    // PASSO 2: Fallback - se HPC nao gerou texto, ler arquivos direto
    // -----------------------------------------------
    if (!textoParaClaude || textoParaClaude.length < 200) {
      const allTextFiles = [...spedFiles, ...otherFiles];
      textoParaClaude = buildFallbackText(allTextFiles);
      pipeline = pipeline ? pipeline + ' + fallback-direto' : 'fallback-direto';
      logger.info(`[HPC-ROUTE] Fallback: leitura direta de ${allTextFiles.length} arquivo(s), ${textoParaClaude.length} chars`);
    } else if (otherFiles.length > 0) {
      const extraText = buildFallbackText(otherFiles);
      if (extraText.length > 50) {
        textoParaClaude += '\n\n' + extraText;
        logger.info(`[HPC-ROUTE] Adicionando ${otherFiles.length} arquivo(s) nao-SPED ao texto`);
      }
    }

    if (!textoParaClaude || textoParaClaude.length < 100) {
      return res.status(422).json({
        success: false,
        error: 'Nao foi possivel extrair texto dos arquivos. Verifique se sao arquivos SPED (.txt com registros |0000|, |C100|, etc) ou documentos de texto.',
        dica: 'Para melhor resultado, envie o arquivo SPED Fiscal (.txt) diretamente, sem compactar em ZIP.',
      });
    }

    // -----------------------------------------------
    // PASSO 3: Enviar texto para Claude Opus (cerebro juridico)
    // -----------------------------------------------
    const claudeStart = Date.now();
    logger.info(`[HPC-ROUTE] Enviando para Claude Opus (analise juridica)... ${textoParaClaude.length} chars`);

    const analysis = await claudeService.analyzeDocument(
      textoParaClaude,
      documentType || 'dre',
      companyInfo
    );

    const totalElapsed = Date.now() - startTime;
    const claudeMs = Date.now() - claudeStart;

    logger.info(`[HPC-ROUTE] Analise completa em ${totalElapsed}ms`, {
      pipeline,
      claudeMs,
      oportunidades: analysis.oportunidades.length,
      valorTotal: analysis.valorTotalEstimado,
      score: analysis.score,
    });

    pipeline += ' + claude-opus';

    // -----------------------------------------------
    // PASSO 4: Retornar resultado completo
    // -----------------------------------------------
    return res.json({
      success: true,
      pipeline,
      timing: {
        hpcProcessingMs: hpcData?.tempoTotalMs || 0,
        claudeAnalysisMs: claudeMs,
        totalMs: totalElapsed,
      },
      hpc: hpcData || { arquivosProcessados: 0, nota: 'Processamento direto (sem HPC parser)' },
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

    const extractedFiles = extractFilesFromUploads(files);

    const health = await hpcGateway.healthCheck();
    if (!health) {
      return res.status(503).json({ success: false, error: 'HPC indisponivel' });
    }

    const hpcResult = await hpcGateway.processSped(extractedFiles);

    return res.json({
      success: true,
      pipeline: 'hpc-go-chapel-only',
      arquivosOriginais: files.length,
      arquivosExtraidos: extractedFiles.length,
      hpcResult,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
