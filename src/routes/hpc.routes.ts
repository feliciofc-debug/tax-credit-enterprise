// src/routes/hpc.routes.ts
// HPC analysis with async processing and DB-persisted job state

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { getOperatorPartnerId } from '../utils/operator';
import { hpcGateway } from '../services/hpc-gateway.service';
import { claudeService } from '../services/claude.service';
import { zipProcessor } from '../services/zipProcessor.service';
import { buildDemonstrativo, formatDemonstrativoTexto, formatExtratoPorOperacaoHtml, formatExtratoBancarioHtml } from '../services/demonstrativo.service';
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

// In-memory progress tracker (supplements DB state for real-time progress)
const jobProgress = new Map<string, string>();

// ============================================================
// HELPERS
// ============================================================

function bufferToString(buf: Buffer): string {
  const utf8 = buf.toString('utf-8');
  if (utf8.includes('\uFFFD')) return buf.toString('latin1');
  return utf8;
}

function sanitizeUtf8(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').replace(/\uFFFD/g, '');
}

function isSpedContent(text: string): boolean {
  const lines = text.split('\n').slice(0, 20);
  return lines.some(l => /^\|[0-9A-Z]{4}\|/.test(l.trim()));
}

/** Extrai período (YYYYMM) do registro |0000| para ordenação determinística */
function getSpedPeriod(buf: Buffer): string {
  const text = bufferToString(buf.subarray(0, Math.min(buf.length, 3000)));
  const lines = text.split('\n').slice(0, 25);
  const line0000 = lines.find(l => l.trim().startsWith('|0000|'));
  if (!line0000) return '000000';
  const fields = line0000.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
  const dtFim = fields[4] || ''; // DTA_FIM formato YYYYMMDD
  return dtFim.substring(0, 6) || '000000';
}

const MAX_PDFS = 5;
const MAX_PDF_SIZE = 8 * 1024 * 1024; // 8MB per PDF
const MAX_PDF_TEXT = 40000;
const MAX_TOTAL_TEXT = 120000;
const MAX_ZIP_EXTRACT = 50 * 1024 * 1024; // 50MB total extracted from ZIP

function extractFilesFromUploads(
  files: Express.Multer.File[]
): { buffer: Buffer; originalname: string; mimetype: string }[] {
  const extracted: { buffer: Buffer; originalname: string; mimetype: string }[] = [];
  let totalExtracted = 0;

  for (const file of files) {
    const ext = file.originalname.toLowerCase().split('.').pop();

    if (ext === 'zip') {
      try {
        const zip = new AdmZip(file.buffer);
        const entries = zip.getEntries();
        logger.info(`[HPC] ZIP "${file.originalname}" contem ${entries.length} arquivo(s)`);

        // Sort: SPED/txt first (small, high value), then PDFs by size ascending
        const sorted = [...entries].sort((a, b) => {
          const aExt = (a.entryName.split('.').pop() || '').toLowerCase();
          const bExt = (b.entryName.split('.').pop() || '').toLowerCase();
          if (aExt === 'txt' && bExt !== 'txt') return -1;
          if (bExt === 'txt' && aExt !== 'txt') return 1;
          return a.header.size - b.header.size;
        });

        for (const entry of sorted) {
          if (entry.isDirectory) continue;
          if (totalExtracted >= MAX_ZIP_EXTRACT) {
            logger.warn(`[HPC] Limite de extracao (${(MAX_ZIP_EXTRACT / 1024 / 1024).toFixed(0)}MB) atingido`);
            break;
          }

          const name = entry.entryName.split('/').pop() || entry.entryName;
          if (name.startsWith('.') || name.startsWith('__MACOSX')) continue;

          const entryExt = name.toLowerCase().split('.').pop();
          const buf = entry.getData();

          if (entryExt === 'txt' || entryExt === 'sped' || !entryExt) {
            const preview = bufferToString(buf.subarray(0, Math.min(buf.length, 2000)));
            if (isSpedContent(preview)) {
              logger.info(`[HPC] SPED: "${name}" (${buf.length} bytes)`);
              extracted.push({ buffer: buf, originalname: name, mimetype: 'text/plain' });
              totalExtracted += buf.length;
              continue;
            }
          }

          if (entryExt === 'pdf' && buf.length > MAX_PDF_SIZE) {
            logger.warn(`[HPC] PDF grande demais, pulando: "${name}" (${(buf.length / 1024 / 1024).toFixed(1)}MB > ${MAX_PDF_SIZE / 1024 / 1024}MB)`);
            continue;
          }

          extracted.push({
            buffer: buf,
            originalname: name,
            mimetype: entryExt === 'pdf' ? 'application/pdf' : entryExt === 'txt' ? 'text/plain' : 'application/octet-stream',
          });
          totalExtracted += buf.length;
        }

        // Free ZIP buffer from memory
        file.buffer = Buffer.alloc(0);
      } catch (err: any) {
        logger.warn(`[HPC] Falha ao extrair ZIP "${file.originalname}": ${err.message}`);
      }
    } else {
      extracted.push({ buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype });
      totalExtracted += file.buffer.length;
    }
  }

  // Ordenar SPEDs por período (mais recentes primeiro) para garantir determinismo
  // com o mesmo ZIP — evita resultados diferentes por ordem de tamanho de arquivo
  const speds: typeof extracted = [];
  const others: typeof extracted = [];
  for (const f of extracted) {
    const preview = bufferToString(f.buffer.subarray(0, Math.min(f.buffer.length, 2000)));
    if (isSpedContent(preview)) speds.push(f);
    else others.push(f);
  }
  speds.sort((a, b) => getSpedPeriod(b.buffer).localeCompare(getSpedPeriod(a.buffer)));
  const ordered = [...speds, ...others];
  if (speds.length > 1) {
    logger.info(`[HPC] SPEDs ordenados por periodo (${speds.length} arquivos)`);
  }

  logger.info(`[HPC] Total extraido: ${(totalExtracted / 1024 / 1024).toFixed(1)}MB em ${ordered.length} arquivo(s)`);
  return ordered;
}

async function extractPdfText(buffer: Buffer, filename: string): Promise<string> {
  try {
    const data = await Promise.race([
      pdfParse(buffer),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF timeout 30s')), 30000)),
    ]);
    let text = (data.text || '').trim();
    if (text.length > MAX_PDF_TEXT) {
      text = text.substring(0, MAX_PDF_TEXT) + '\n[... truncado ...]';
    }
    logger.info(`[HPC] PDF "${filename}": ${text.length} chars, ${data.numpages} pags`);
    return text;
  } catch (err: any) {
    logger.warn(`[HPC] Falha PDF "${filename}": ${err.message}`);
    return '';
  }
}

function isPdf(file: { originalname: string; mimetype: string }): boolean {
  return file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
}

async function buildFallbackText(
  files: { buffer: Buffer; originalname: string; mimetype: string }[]
): Promise<string> {
  const parts: string[] = [];
  let totalLen = 0;
  let pdfCount = 0;

  for (const f of files) {
    if (totalLen >= MAX_TOTAL_TEXT) break;

    let text = '';
    if (isPdf(f)) {
      if (pdfCount >= MAX_PDFS) {
        logger.info(`[HPC] Limite de ${MAX_PDFS} PDFs atingido, pulando "${f.originalname}"`);
        continue;
      }
      pdfCount++;
      text = sanitizeUtf8(await extractPdfText(f.buffer, f.originalname));
    } else {
      text = sanitizeUtf8(bufferToString(f.buffer));
    }

    // Free buffer after text extraction to reduce memory usage
    f.buffer = Buffer.alloc(0);

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
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /api/hpc/job/:jobId — Poll for job status (DB-backed)
// ============================================================
router.get('/job/:jobId', authenticateToken, async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const record = await prisma.viabilityAnalysis.findUnique({ where: { id: jobId } });

    if (!record) {
      return res.status(404).json({ success: false, error: 'Job nao encontrado' });
    }

    const elapsed = Date.now() - record.createdAt.getTime();

    if (record.status === 'completed') {
      let opportunities: any[] = [];
      let risks: string[] = [];
      let aiData: any = {};
      try { opportunities = JSON.parse(record.opportunities || '[]'); } catch {}
      try { risks = JSON.parse(record.risks || '[]'); } catch {}
      try { aiData = JSON.parse(record.aiSummary || '{}'); } catch {}

      return res.json({
        success: true,
        status: 'completed',
        elapsed,
        savedId: record.id,
        pipeline: aiData.pipeline || 'unknown',
        timing: aiData.timing || { hpcProcessingMs: 0, claudeAnalysisMs: 0, totalMs: elapsed },
        hpc: aiData.hpc || { arquivosProcessados: 0, resultados: [], erros: [] },
        demonstrativo: aiData.demonstrativo || null,
        authorizedByNames: aiData.authorizedByNames || record.authorizedByNames || null,
        authorizedByCargos: aiData.authorizedByCargos || record.authorizedByCargos || null,
        dataSources: aiData.dataSources || [],
        analysis: {
          score: record.viabilityScore,
          scoreLabel: record.scoreLabel,
          regimeTributario: aiData.regimeTributario || record.regime,
          riscoGeral: aiData.riscoGeral || '',
          valorTotalEstimado: record.estimatedCredit,
          periodoAnalisado: aiData.periodoAnalisado || '',
          resumoExecutivo: aiData.resumoExecutivo || '',
          fundamentacaoGeral: aiData.fundamentacaoGeral || '',
          oportunidades: opportunities,
          recomendacoes: aiData.recomendacoes || [],
          alertas: risks,
        },
      });
    }

    if (record.status === 'failed') {
      return res.json({
        success: false,
        status: 'failed',
        elapsed,
        error: record.aiSummary || 'Erro no processamento',
      });
    }

    // Still processing — return progress from in-memory tracker
    const progress = jobProgress.get(jobId) || 'Processando...';
    return res.json({
      success: true,
      status: 'processing',
      progress,
      elapsed,
    });
  } catch (err: any) {
    logger.error(`[HPC-POLL] Erro ao consultar job ${jobId}: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Erro ao consultar status' });
  }
});

// ============================================================
// POST /api/hpc/analyze — Async: returns jobId, processes in background
// ============================================================
router.post('/analyze', authenticateToken, upload.array('documents', 50), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];
    const { companyName, cnpj, regime, sector, documentType, authorizedByNames, authorizedByCargos, interviewData } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Envie pelo menos um arquivo para analise' });
    }
    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
    }

    // Resolve partnerId
    let partnerId: string | null = null;
    try {
      partnerId = await getOperatorPartnerId(user);
      if (!partnerId) {
        const first = await prisma.partner.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } });
        partnerId = first?.id || null;
      }
    } catch { partnerId = null; }

    // Create DB record immediately with status 'analyzing'
    const record = await prisma.viabilityAnalysis.create({
      data: {
        partnerId: partnerId || undefined,
        companyName: sanitizeUtf8(companyName),
        cnpj: cnpj || null,
        regime: regime || null,
        sector: sector ? sanitizeUtf8(sector) : null,
        authorizedByNames: authorizedByNames ? sanitizeUtf8(authorizedByNames) : null,
        authorizedByCargos: authorizedByCargos ? sanitizeUtf8(authorizedByCargos) : null,
        interviewData: interviewData || null,
        docsUploaded: files.length,
        status: 'analyzing',
      },
    });

    const jobId = record.id;
    jobProgress.set(jobId, 'Arquivos recebidos, iniciando processamento...');
    logger.info(`[HPC] Job ${jobId} criado para "${companyName}" — ${files.length} arquivo(s)`);

    // Return immediately
    res.json({ success: true, jobId });

    // Background processing
    runAnalysis(jobId, user, files, {
      companyName, cnpj, regime, sector, documentType,
      authorizedByNames, authorizedByCargos, interviewData,
    });

  } catch (error: any) {
    logger.error(`[HPC] Erro ao criar job: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function runAnalysis(
  jobId: string,
  user: any,
  files: Express.Multer.File[],
  params: {
    companyName: string; cnpj?: string; regime?: string; sector?: string; documentType?: string;
    authorizedByNames?: string; authorizedByCargos?: string; interviewData?: string;
  }
) {
  const startTime = Date.now();
  const { companyName, cnpj, regime, sector, documentType, authorizedByNames, authorizedByCargos, interviewData } = params;

  const setProgress = (msg: string) => {
    jobProgress.set(jobId, msg);
    logger.info(`[HPC-JOB ${jobId}] ${msg}`);
  };

  try {
    let extractedFiles: { buffer: Buffer; originalname: string; mimetype: string }[] = [];
    let textoParaClaude = '';
    let pipeline = '';
    let hpcData: any = null;

    // STEP 0: ZIP único → usar zipProcessor (mesma lógica da viabilidade, determinístico)
    const isSingleZip = files.length === 1 && files[0].originalname.toLowerCase().endsWith('.zip');
    let zipResult: Awaited<ReturnType<typeof zipProcessor.processUpload>> | null = null;
    if (isSingleZip) {
      setProgress('Processando ZIP com zipProcessor (fluxo unificado)...');
      zipResult = await zipProcessor.processUpload(files[0].buffer, files[0].originalname, files[0].mimetype);
      textoParaClaude = zipProcessor.buildCombinedText(zipResult);
      extractedFiles = zipResult.documentos.map((d: any) => ({
        buffer: Buffer.from(String(d.conteudo || ''), 'utf8'),
        originalname: d.nome,
        mimetype: 'text/plain',
      }));
      pipeline = 'zipProcessor-unificado';
      setProgress(`${zipResult.speds.length} SPED(s) + ${zipResult.demonstrativos.length + zipResult.nfes.length + zipResult.outros.length} outros processados`);
    }

    // STEP 1: Extract files (quando não é ZIP único)
    if (!isSingleZip) {
      setProgress('Extraindo arquivos do ZIP...');
      extractedFiles = extractFilesFromUploads(files);
    }

    const spedFiles = extractedFiles.filter(f => {
      const preview = bufferToString(f.buffer.subarray(0, Math.min(f.buffer.length, 2000)));
      return isSpedContent(preview);
    });
    const otherFiles = extractedFiles.filter(f => !spedFiles.includes(f));

    if (!isSingleZip) {
      setProgress(`${extractedFiles.length} arquivo(s) extraidos (${spedFiles.length} SPED, ${otherFiles.length} outros)`);
    }

    // STEP 1b: Se não temos zipResult mas temos SPEDs, processar via zipProcessor para gerar demonstrativo/extrato
    if (!zipResult && spedFiles.length > 0) {
      setProgress(`Processando ${spedFiles.length} SPED(s) para demonstrativo e extrato...`);
      const zipResults = await Promise.all(
        spedFiles.map(f => zipProcessor.processUpload(f.buffer, f.originalname, f.mimetype))
      );
      const allSpeds = zipResults.flatMap(r => r.speds);
      if (allSpeds.length > 0) {
        const firstSped = allSpeds[0] as { empresa: string; cnpj: string; ie: string; uf: string; fantasia?: string };
        zipResult = {
          empresa: { nome: firstSped.empresa, cnpj: firstSped.cnpj, ie: firstSped.ie, uf: firstSped.uf, fantasia: firstSped.fantasia || '' },
          documentos: zipResults.flatMap(r => r.documentos),
          speds: allSpeds,
          nfes: zipResults.flatMap(r => r.nfes),
          demonstrativos: zipResults.flatMap(r => r.demonstrativos),
          contratos: zipResults.flatMap(r => r.contratos),
          outros: zipResults.flatMap(r => r.outros),
          resumo: {
            totalArquivos: allSpeds.length,
            processados: allSpeds.length,
            ignorados: 0,
            erros: zipResults.flatMap(r => r.resumo.erros),
            tiposEncontrados: ['sped'],
          },
        };
        setProgress(`Demonstrativo disponivel: ${allSpeds.length} SPED(s) processados`);
      }
    }

    let interviewParsed: Record<string, string> | undefined;
    try {
      if (interviewData && typeof interviewData === 'string') {
        interviewParsed = JSON.parse(interviewData) as Record<string, string>;
      }
    } catch { interviewParsed = undefined; }

    // Build dataSources for transparency in report
    const dataSourcesArr: { tipo: string; descricao: string }[] = [];
    if (zipResult) {
      if (zipResult.speds.length > 0) {
        dataSourcesArr.push({ tipo: 'SPED', descricao: `${zipResult.speds.length} arquivo(s) EFD Fiscal/Contribuições` });
      }
      if (zipResult.demonstrativos.length > 0) dataSourcesArr.push({ tipo: 'Demonstrativo', descricao: 'Demonstrativos fiscais' });
      if (zipResult.nfes.length > 0) dataSourcesArr.push({ tipo: 'NFe', descricao: 'Notas fiscais' });
    } else {
      if (spedFiles.length > 0) {
        dataSourcesArr.push({ tipo: 'SPED', descricao: `${spedFiles.length} arquivo(s) EFD Fiscal/Contribuições` });
      }
    }
    const hasDarf = extractedFiles.some(f => /darfs?|comprovante|arrecadacao/i.test(f.originalname));
    const hasPerdcomp = extractedFiles.some(f => /perdcomp|per.?dcomp|recibo.*compensacao/i.test(f.originalname));
    const hasPdf = extractedFiles.some(f => /\.pdf$/i.test(f.originalname));
    if (hasDarf) dataSourcesArr.push({ tipo: 'DARF', descricao: 'Comprovantes de arrecadação' });
    if (hasPerdcomp) dataSourcesArr.push({ tipo: 'PER/DCOMP', descricao: 'Recibos de compensação' });
    if (hasPdf && !hasDarf && !hasPerdcomp) dataSourcesArr.push({ tipo: 'PDF', descricao: 'Documentos em PDF' });
    if (interviewParsed && Object.keys(interviewParsed).length > 0) {
      dataSourcesArr.push({ tipo: 'Entrevista', descricao: 'Dados declarados pelo cliente' });
    }

    const companyInfo = {
      name: companyName,
      cnpj: cnpj || undefined,
      regime: (regime as 'lucro_real' | 'lucro_presumido' | 'simples') || undefined,
      sector: sector || undefined,
      authorizedByNames: authorizedByNames || undefined,
      authorizedByCargos: authorizedByCargos || undefined,
      interviewData: interviewParsed,
    };

    // STEP 2: HPC for SPED files (pular quando ZIP único — já temos texto do zipProcessor)
    if (!isSingleZip && spedFiles.length > 0) {
      setProgress(`Processando ${spedFiles.length} SPED no motor HPC...`);
      const health = await hpcGateway.healthCheck();
      if (health) {
        try {
          const hpcResult = await hpcGateway.processSped(spedFiles);
          if (hpcResult.success && hpcResult.textoUnificado && hpcResult.textoUnificado.length >= 200) {
            textoParaClaude = sanitizeUtf8(hpcResult.textoUnificado);
            hpcData = {
              arquivosProcessados: hpcResult.arquivosProcessados,
              tempoTotalMs: hpcResult.tempoTotalMs,
              resultados: hpcResult.resultados.map((r: any) => ({
                arquivo: r.arquivo, tipo: r.tipo, periodo: r.periodo,
                empresa: r.empresa, resumo: r.resumo,
              })),
              erros: hpcResult.erros,
            };
            pipeline = 'hpc-go-chapel';
          }
        } catch (err: any) {
          logger.warn(`[HPC-JOB ${jobId}] HPC falhou: ${err.message}`);
        }
      }
    }

    // STEP 3: Fallback — extract text from PDFs/other files
    if (!textoParaClaude || textoParaClaude.length < 200) {
      const pdfCount = otherFiles.filter(f => isPdf(f)).length;
      setProgress(`Extraindo texto de ${pdfCount} PDF(s) e ${otherFiles.length - pdfCount} outro(s)...`);
      textoParaClaude = await buildFallbackText([...spedFiles, ...otherFiles]);
      pipeline = pipeline ? pipeline + ' + fallback' : 'fallback-direto';
    } else if (otherFiles.length > 0) {
      setProgress(`Extraindo texto de ${otherFiles.length} arquivo(s) adicionais...`);
      const extra = await buildFallbackText(otherFiles);
      if (extra.length > 50) textoParaClaude += '\n\n' + extra;
    }

    if (!textoParaClaude || textoParaClaude.length < 100) {
      await prisma.viabilityAnalysis.update({
        where: { id: jobId },
        data: { status: 'failed', aiSummary: 'Nao foi possivel extrair texto dos arquivos.' },
      });
      jobProgress.delete(jobId);
      return;
    }

    // STEP 3b: Quando temos SPED processado, injetar valores extraídos para coerência da IA
    if (zipResult && zipResult.speds.length > 0) {
      const linhas: string[] = [];
      linhas.push('\n\n=== DADOS EXTRAÍDOS DO SPED (valores determinísticos — USE COMO REFERÊNCIA para valorEstimado) ===');
      let totalRealSped = 0;
      for (const sped of zipResult.speds) {
        const s = sped as { periodo?: { fim?: string }; resumo?: { saldoCredor?: number; cfopBreakdown?: { cfop: string; vlOpr: number; vlPis: number; vlCofins: number }[]; operacoesExtrato?: { cfop: string; vlOpr: number; vlPis: number; vlCofins: number }[] } };
        const periodo = s.periodo?.fim || 'N/D';
        const saldo = s.resumo?.saldoCredor ?? 0;
        if (saldo > 0) {
          linhas.push(`ICMS Saldo credor: período ${periodo} = R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
          totalRealSped += saldo;
        }
        const ops = s.resumo?.operacoesExtrato || s.resumo?.cfopBreakdown || [];
        for (const op of ops) {
          const tot = (op.vlPis || 0) + (op.vlCofins || 0);
          if (tot > 0) {
            linhas.push(`PIS/COFINS CFOP ${op.cfop}: período ${periodo} = R$ ${tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            totalRealSped += tot;
          }
        }
      }
      if (totalRealSped > 0) {
        linhas.push(`TOTAL REAL EXTRAÍDO DO SPED: R$ ${totalRealSped.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        linhas.push('=== Use estes valores como base. Não extrapole. ===\n');
        textoParaClaude = linhas.join('\n') + '\n' + textoParaClaude;
      }
    }

    // STEP 4: Claude analysis
    setProgress(`Analise juridica com IA em andamento (${(textoParaClaude.length / 1000).toFixed(0)}K caracteres)...`);
    const claudeStart = Date.now();

    const analysis = await claudeService.analyzeDocument(
      textoParaClaude,
      (documentType as 'dre' | 'balancete' | 'balanco') || 'dre',
      companyInfo
    );

    const claudeMs = Date.now() - claudeStart;
    pipeline += ' + claude-opus';

    setProgress('Salvando resultado no banco de dados...');

    // STEP 5: Save results to DB
    const scoreLabel = analysis.score >= 85 ? 'excelente'
      : analysis.score >= 70 ? 'bom'
      : analysis.score >= 50 ? 'medio'
      : analysis.score >= 30 ? 'baixo'
      : 'inviavel';

    const totalMs = Date.now() - startTime;
    const hpcMs = hpcData?.tempoTotalMs || 0;

    // Demonstrativo cálculo por cálculo (real vs hipótese) — quando temos ZIP processado
    let demonstrativo: any = null;
    if (zipResult && zipResult.speds.length > 0) {
      try {
        demonstrativo = buildDemonstrativo(zipResult, analysis);
        demonstrativo.textoFormatado = formatDemonstrativoTexto(demonstrativo);
        demonstrativo.extratoHtml = formatExtratoPorOperacaoHtml(demonstrativo);
        demonstrativo.extratoBancarioHtml = formatExtratoBancarioHtml(demonstrativo);
        setProgress(`Demonstrativo gerado: ${demonstrativo.itens.filter((i: any) => i.tipo === 'real').length} itens reais, ${demonstrativo.itens.filter((i: any) => i.tipo === 'hipotese').length} hipóteses`);
      } catch (demoErr: any) {
        logger.warn(`[HPC-JOB ${jobId}] Demonstrativo falhou: ${demoErr.message}`);
      }
    }

    const aiSummaryJson = JSON.stringify({
      resumoExecutivo: analysis.resumoExecutivo || '',
      fundamentacaoGeral: analysis.fundamentacaoGeral || '',
      periodoAnalisado: analysis.periodoAnalisado || 'Ultimos 5 anos',
      regimeTributario: analysis.regimeTributario || regime || '',
      riscoGeral: analysis.riscoGeral || '',
      recomendacoes: analysis.recomendacoes || [],
      source: 'hpc',
      pipeline,
      authorizedByNames: authorizedByNames || null,
      authorizedByCargos: authorizedByCargos || null,
      dataSources: dataSourcesArr,
      timing: {
        hpcProcessingMs: hpcMs,
        claudeAnalysisMs: claudeMs,
        totalMs,
      },
      hpc: hpcData || { arquivosProcessados: 0, resultados: [], erros: [] },
      demonstrativo: demonstrativo ? {
        itens: demonstrativo.itens,
        totalReal: demonstrativo.totalReal,
        totalHipotese: demonstrativo.totalHipotese,
        totalGeral: demonstrativo.totalGeral,
        resumoReal: demonstrativo.resumoReal,
        resumoHipotese: demonstrativo.resumoHipotese,
        textoFormatado: demonstrativo.textoFormatado,
        extratoHtml: demonstrativo.extratoHtml,
        extratoBancarioHtml: demonstrativo.extratoBancarioHtml,
      } : null,
    });

    await prisma.$disconnect();
    await prisma.$connect();

    let estimatedCredit = analysis.valorTotalEstimado;
    if (demonstrativo && demonstrativo.totalReal > 0) {
      estimatedCredit = demonstrativo.totalReal;
      logger.info(`[HPC-JOB ${jobId}] Using SPED real total R$ ${demonstrativo.totalReal.toFixed(2)} instead of AI estimate R$ ${analysis.valorTotalEstimado.toFixed(2)}`);

      const capAi = demonstrativo.totalReal * 2;
      if (analysis.valorTotalEstimado > capAi) {
        logger.warn(`[HPC-JOB ${jobId}] AI total R$ ${analysis.valorTotalEstimado.toFixed(2)} exceeds 2x SPED real. Capping.`);
        analysis.valorTotalEstimado = Math.round(demonstrativo.totalReal * 1.5);
      }
    }

    await prisma.viabilityAnalysis.update({
      where: { id: jobId },
      data: {
        docsText: sanitizeUtf8(textoParaClaude.substring(0, 50000)),
        viabilityScore: analysis.score,
        scoreLabel,
        estimatedCredit,
        opportunities: sanitizeUtf8(JSON.stringify(analysis.oportunidades)),
        aiSummary: sanitizeUtf8(aiSummaryJson),
        risks: sanitizeUtf8(JSON.stringify(analysis.alertas || [])),
        dataSources: JSON.stringify(dataSourcesArr),
        status: 'completed',
      },
    });

    jobProgress.delete(jobId);
    logger.info(`[HPC-JOB ${jobId}] CONCLUIDO em ${totalMs}ms — score: ${analysis.score}, valor: ${estimatedCredit} (AI original: ${analysis.valorTotalEstimado})`);

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    logger.error(`[HPC-JOB ${jobId}] ERRO (${elapsed}ms): ${error.message}`);
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      await prisma.viabilityAnalysis.update({
        where: { id: jobId },
        data: { status: 'failed', aiSummary: `Erro: ${error.message}` },
      });
    } catch (dbErr: any) {
      logger.error(`[HPC-JOB ${jobId}] Falha ao salvar erro no DB: ${dbErr.message}`);
    }
    jobProgress.delete(jobId);
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
    if (!health) return res.status(503).json({ success: false, error: 'HPC indisponivel' });
    const hpcResult = await hpcGateway.processSped(extractedFiles);
    return res.json({ success: true, pipeline: 'hpc-go-chapel-only', hpcResult });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
