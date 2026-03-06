// src/routes/hpc.routes.ts
// Rotas ISOLADAS para teste de integracao com HPC Go+Chapel
// Usa processamento ASSINCRONO para evitar timeout em uploads grandes

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { getOperatorPartnerId } from '../utils/operator';
import { hpcGateway } from '../services/hpc-gateway.service';
import { claudeService } from '../services/claude.service';
import multer from 'multer';
import AdmZip from 'adm-zip';
import pdfParse from 'pdf-parse';
import crypto from 'crypto';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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
// ASYNC JOB STORE — keeps analysis results in memory
// Jobs are cleaned up after 30 minutes
// ============================================================
interface HpcJob {
  status: 'uploading' | 'extracting' | 'hpc-processing' | 'claude-analyzing' | 'saving' | 'completed' | 'failed';
  progress: string;
  startedAt: number;
  result?: any;
  error?: string;
}

const jobs = new Map<string, HpcJob>();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// ============================================================
// HELPERS
// ============================================================

function bufferToString(buf: Buffer): string {
  const utf8 = buf.toString('utf-8');
  if (utf8.includes('\uFFFD')) {
    return buf.toString('latin1');
  }
  return utf8;
}

function sanitizeUtf8(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
             .replace(/\uFFFD/g, '');
}

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
            const preview = bufferToString(buf.subarray(0, Math.min(buf.length, 2000)));
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

const MAX_PDF_TEXT = 80000;

async function extractPdfText(buffer: Buffer, filename: string): Promise<string> {
  try {
    const timeoutMs = 30000;
    const data = await Promise.race([
      pdfParse(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF parse timeout (30s)')), timeoutMs)
      ),
    ]);
    let text = (data.text || '').trim();
    if (text.length > MAX_PDF_TEXT) {
      text = text.substring(0, MAX_PDF_TEXT) + '\n\n[... texto truncado por limite ...]';
    }
    logger.info(`[HPC] PDF "${filename}" extraido: ${text.length} chars, ${data.numpages} paginas`);
    return text;
  } catch (err: any) {
    logger.warn(`[HPC] Falha ao extrair PDF "${filename}": ${err.message}`);
    return '';
  }
}

function isPdf(file: { originalname: string; mimetype: string }): boolean {
  return file.mimetype === 'application/pdf' ||
    file.originalname.toLowerCase().endsWith('.pdf');
}

const MAX_TOTAL_TEXT = 200000;

async function buildFallbackText(
  files: { buffer: Buffer; originalname: string; mimetype: string }[]
): Promise<string> {
  const parts: string[] = [];
  let totalLen = 0;
  for (const f of files) {
    if (totalLen >= MAX_TOTAL_TEXT) {
      logger.info(`[HPC] Limite de texto atingido (${MAX_TOTAL_TEXT}), pulando "${f.originalname}"`);
      break;
    }
    let text = '';
    if (isPdf(f)) {
      text = sanitizeUtf8(await extractPdfText(f.buffer, f.originalname));
    } else {
      text = sanitizeUtf8(bufferToString(f.buffer));
    }
    if (text.length > 50) {
      parts.push(`=== ARQUIVO: ${f.originalname} ===\n${text}`);
      totalLen += text.length;
    }
  }
  return parts.join('\n\n');
}

// ============================================================
// GET /api/hpc/status
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
// GET /api/hpc/job/:jobId
// Poll for async job status
// ============================================================
router.get('/job/:jobId', authenticateToken, async (req: Request, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job nao encontrado' });
  }

  const elapsed = Date.now() - job.startedAt;

  if (job.status === 'completed') {
    return res.json({
      success: true,
      status: 'completed',
      elapsed,
      ...job.result,
    });
  }

  if (job.status === 'failed') {
    return res.json({
      success: false,
      status: 'failed',
      elapsed,
      error: job.error,
      progress: job.progress,
    });
  }

  return res.json({
    success: true,
    status: job.status,
    progress: job.progress,
    elapsed,
  });
});

// ============================================================
// POST /api/hpc/analyze
// ASYNC: Receives files, returns jobId immediately, processes in background
// ============================================================
router.post('/analyze', authenticateToken, upload.array('documents', 50), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];
    const { companyName, cnpj, regime, sector, documentType } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo para analise' });
    }

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
    }

    const jobId = crypto.randomBytes(8).toString('hex');
    const job: HpcJob = {
      status: 'uploading',
      progress: 'Arquivos recebidos, iniciando processamento...',
      startedAt: Date.now(),
    };
    jobs.set(jobId, job);

    logger.info(`[HPC-ROUTE] Job ${jobId} criado para "${companyName}" — ${files.length} arquivo(s)`);

    // Return jobId immediately — processing continues in background
    res.json({ success: true, jobId, message: 'Analise iniciada em segundo plano' });

    // ====== BACKGROUND PROCESSING ======
    runAnalysisInBackground(jobId, job, user, files, { companyName, cnpj, regime, sector, documentType });

  } catch (error: any) {
    logger.error(`[HPC-ROUTE] Erro ao criar job:`, error.message);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao iniciar analise' });
  }
});

async function runAnalysisInBackground(
  jobId: string,
  job: HpcJob,
  user: any,
  files: Express.Multer.File[],
  params: { companyName: string; cnpj?: string; regime?: string; sector?: string; documentType?: string }
) {
  const startTime = Date.now();
  const { companyName, cnpj, regime, sector, documentType } = params;

  try {
    // PASSO 0: Extrair ZIPs
    job.status = 'extracting';
    job.progress = 'Extraindo arquivos...';
    const extractedFiles = extractFilesFromUploads(files);

    logger.info(`[HPC-JOB ${jobId}] Extraidos ${extractedFiles.length} arquivo(s)`, {
      user: user.email,
      empresa: companyName,
      tamanhoTotal: extractedFiles.reduce((sum, f) => sum + f.buffer.length, 0),
    });

    const spedFiles: typeof extractedFiles = [];
    const otherFiles: typeof extractedFiles = [];
    for (const f of extractedFiles) {
      const preview = bufferToString(f.buffer.subarray(0, Math.min(f.buffer.length, 2000)));
      if (isSpedContent(preview)) {
        spedFiles.push(f);
      } else {
        otherFiles.push(f);
      }
    }

    logger.info(`[HPC-JOB ${jobId}] Classificacao: ${spedFiles.length} SPED, ${otherFiles.length} outros`);

    const companyInfo = {
      name: companyName,
      cnpj: cnpj || undefined,
      regime: (regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
      sector: sector || undefined,
    };

    let textoParaClaude = '';
    let hpcData: any = null;
    let pipeline = '';

    // PASSO 1: HPC Go+Chapel para SPED
    if (spedFiles.length > 0) {
      job.status = 'hpc-processing';
      job.progress = `Processando ${spedFiles.length} arquivo(s) SPED no motor HPC...`;
      const health = await hpcGateway.healthCheck();

      if (health) {
        try {
          const hpcResult = await hpcGateway.processSped(spedFiles);
          if (hpcResult.success && hpcResult.textoUnificado && hpcResult.textoUnificado.length >= 200) {
            textoParaClaude = sanitizeUtf8(hpcResult.textoUnificado);
            hpcData = {
              arquivosProcessados: hpcResult.arquivosProcessados,
              tempoTotalMs: hpcResult.tempoTotalMs,
              resultados: hpcResult.resultados.map(r => ({
                arquivo: r.arquivo, tipo: r.tipo, periodo: r.periodo,
                empresa: r.empresa, resumo: r.resumo, processadoEm: r.processadoEm,
              })),
              erros: hpcResult.erros,
            };
            pipeline = 'hpc-go-chapel';
            logger.info(`[HPC-JOB ${jobId}] HPC OK: ${textoParaClaude.length} chars`);
          }
        } catch (err: any) {
          logger.warn(`[HPC-JOB ${jobId}] HPC falhou: ${err.message}`);
        }
      }
    }

    // PASSO 2: Fallback — leitura direta + extração de PDF
    if (!textoParaClaude || textoParaClaude.length < 200) {
      job.progress = `Extraindo texto de ${extractedFiles.length} arquivo(s)...`;
      const allTextFiles = [...spedFiles, ...otherFiles];
      textoParaClaude = await buildFallbackText(allTextFiles);
      pipeline = pipeline ? pipeline + ' + fallback-direto' : 'fallback-direto';
      logger.info(`[HPC-JOB ${jobId}] Fallback: ${textoParaClaude.length} chars`);
    } else if (otherFiles.length > 0) {
      job.progress = `Extraindo texto de ${otherFiles.length} arquivo(s) adicionais...`;
      const extraText = await buildFallbackText(otherFiles);
      if (extraText.length > 50) {
        textoParaClaude += '\n\n' + extraText;
      }
    }

    if (!textoParaClaude || textoParaClaude.length < 100) {
      job.status = 'failed';
      job.error = 'Nao foi possivel extrair texto dos arquivos. Verifique se sao SPED (.txt) ou PDFs com texto.';
      job.progress = 'Falha na extracao de texto';
      return;
    }

    // PASSO 3: Claude Opus
    job.status = 'claude-analyzing';
    job.progress = `Analise juridica com IA em andamento (${textoParaClaude.length.toLocaleString()} caracteres)...`;
    const claudeStart = Date.now();

    logger.info(`[HPC-JOB ${jobId}] Enviando para Claude: ${textoParaClaude.length} chars`);

    const analysis = await claudeService.analyzeDocument(
      textoParaClaude,
      documentType || 'dre',
      companyInfo
    );

    const claudeMs = Date.now() - claudeStart;
    pipeline += ' + claude-opus';

    logger.info(`[HPC-JOB ${jobId}] Claude OK em ${claudeMs}ms — score: ${analysis.score}, oportunidades: ${analysis.oportunidades.length}`);

    // PASSO 4: Salvar no banco
    job.status = 'saving';
    job.progress = 'Salvando resultado no banco de dados...';

    const scoreLabel = analysis.score >= 85 ? 'excelente'
      : analysis.score >= 70 ? 'bom'
      : analysis.score >= 50 ? 'medio'
      : analysis.score >= 30 ? 'baixo'
      : 'inviavel';

    const aiSummaryJson = JSON.stringify({
      resumoExecutivo: analysis.resumoExecutivo || '',
      fundamentacaoGeral: analysis.fundamentacaoGeral || '',
      periodoAnalisado: analysis.periodoAnalisado || 'Ultimos 5 anos',
      regimeTributario: analysis.regimeTributario || regime || '',
      riscoGeral: analysis.riscoGeral || '',
      recomendacoes: analysis.recomendacoes || [],
      source: 'hpc',
      pipeline,
    });

    let partnerId: string | null = null;
    try {
      partnerId = await getOperatorPartnerId(user);
      if (!partnerId) {
        const firstPartner = await prisma.partner.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } });
        partnerId = firstPartner?.id || null;
      }
    } catch {
      partnerId = null;
    }

    let savedId: string | null = null;
    let saveError: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        const saved = await prisma.viabilityAnalysis.create({
          data: {
            partnerId: partnerId || undefined,
            companyName: sanitizeUtf8(companyName || 'Empresa HPC'),
            cnpj: cnpj || null,
            regime: regime || null,
            sector: sector ? sanitizeUtf8(sector) : null,
            docsUploaded: files.length,
            docsText: sanitizeUtf8(textoParaClaude.substring(0, 50000)),
            viabilityScore: analysis.score,
            scoreLabel,
            estimatedCredit: analysis.valorTotalEstimado,
            opportunities: sanitizeUtf8(JSON.stringify(analysis.oportunidades)),
            aiSummary: sanitizeUtf8(aiSummaryJson),
            risks: sanitizeUtf8(JSON.stringify(analysis.alertas || [])),
            status: 'completed',
          },
        });
        savedId = saved.id;
        saveError = null;
        logger.info(`[HPC-JOB ${jobId}] Salvo: id=${saved.id}`);
        break;
      } catch (saveErr: any) {
        saveError = saveErr.message;
        logger.error(`[HPC-JOB ${jobId}] Save attempt ${attempt} failed: ${saveErr.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    const totalElapsed = Date.now() - startTime;

    // Mark job as completed with full result
    job.status = 'completed';
    job.progress = 'Analise concluida';
    job.result = {
      savedId,
      saveError,
      pipeline,
      timing: {
        hpcProcessingMs: hpcData?.tempoTotalMs || 0,
        claudeAnalysisMs: claudeMs,
        totalMs: totalElapsed,
      },
      hpc: hpcData || { arquivosProcessados: 0, nota: 'Processamento direto (sem HPC parser)' },
      analysis: {
        score: analysis.score,
        scoreLabel,
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
    };

    logger.info(`[HPC-JOB ${jobId}] CONCLUIDO em ${totalElapsed}ms — score: ${analysis.score}, valor: ${analysis.valorTotalEstimado}`);

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    logger.error(`[HPC-JOB ${jobId}] ERRO (${elapsed}ms): ${error.message}`);
    job.status = 'failed';
    job.error = error.message || 'Erro interno na analise';
    job.progress = 'Falha no processamento';
  }
}

// ============================================================
// POST /api/hpc/process-only
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
