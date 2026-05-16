import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { serproService, SerproCredentials, SerproServiceName } from '../services/serpro.service';
import { runCrossAnalysisDirfFontes } from '../services/cross-analysis.service';

const router = Router();

function getCredentials(conn: any): SerproCredentials {
  return {
    consumerKey: conn.consumerKey,
    consumerSecret: conn.consumerSecret,
    certBase64: conn.certBase64 || undefined,
    certPassword: conn.certPassword || undefined,
    environment: conn.environment as 'trial' | 'production',
  };
}

async function logCall(connectionId: string, service: string, endpoint: string, result: any) {
  try {
    await prisma.serproLog.create({
      data: {
        connectionId,
        service,
        endpoint,
        statusCode: result.raw?.status || null,
        success: result.success,
        responseData: result.raw ? JSON.parse(JSON.stringify(result.raw)) : null,
        errorMessage: result.success ? null : (result.raw?.error || result.raw?.mensagens?.[0]?.texto || null),
        durationMs: result.durationMs || 0,
      },
    });
  } catch (e: any) {
    logger.warn('[SERPRO] Falha ao gravar log:', e.message);
  }
}

// ============================================================
// CRUD de Conexoes SERPRO
// ============================================================

router.get('/connections', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const connections = await prisma.serproConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });
    const safe = connections.map(c => ({
      ...c,
      consumerKey: c.consumerKey.substring(0, 6) + '***',
      consumerSecret: '***',
      certBase64: c.certBase64 ? '(configurado)' : null,
      certPassword: c.certPassword ? '***' : null,
    }));
    return res.json({ success: true, data: safe });
  } catch (err: any) {
    logger.error('[SERPRO] Erro ao listar conexoes:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { cnpj, companyName, consumerKey, consumerSecret, certBase64, certPassword, environment } = req.body;
    if (!cnpj || !companyName || !consumerKey || !consumerSecret) {
      return res.status(400).json({ success: false, error: 'CNPJ, nome, consumerKey e consumerSecret sao obrigatorios' });
    }
    const connection = await prisma.serproConnection.create({
      data: {
        cnpj: cnpj.replace(/\D/g, ''),
        companyName,
        consumerKey,
        consumerSecret,
        certBase64: certBase64 || null,
        certPassword: certPassword || null,
        environment: environment || 'trial',
        status: 'pending',
      },
    });
    return res.json({ success: true, data: { id: connection.id, status: connection.status } });
  } catch (err: any) {
    logger.error('[SERPRO] Erro ao criar conexao:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/connections/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    await prisma.serproLog.deleteMany({ where: { connectionId: req.params.id } });
    await prisma.serproConnection.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Testar Conexao (autenticar + verificar procuracao)
// ============================================================

router.post('/connections/:id/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);

    const tokens = await serproService.authenticate(creds);
    if (!tokens.accessToken) {
      await prisma.serproConnection.update({ where: { id: conn.id }, data: { status: 'error', lastError: 'Falha na autenticacao' } });
      return res.json({ success: false, error: 'Falha na autenticacao SERPRO' });
    }

    const procResult = await serproService.checkProcuracao(creds, conn.cnpj, conn.cnpj, conn.cnpj);
    await logCall(conn.id, 'procuracoes', 'Consultar', procResult);

    await prisma.serproConnection.update({
      where: { id: conn.id },
      data: {
        status: 'active',
        lastSyncAt: new Date(),
        lastError: null,
        procuracaoOk: procResult.success,
      },
    });

    return res.json({
      success: true,
      data: {
        authenticated: true,
        procuracao: procResult.success,
        procuracaoData: procResult.data,
        environment: conn.environment,
      },
    });
  } catch (err: any) {
    logger.error('[SERPRO] Erro ao testar conexao:', err.message);
    await prisma.serproConnection.update({
      where: { id: req.params.id },
      data: { status: 'error', lastError: err.message },
    }).catch(() => {});
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Catalogo de Servicos Disponiveis
// ============================================================

router.get('/services', authenticateToken, async (_req: Request, res: Response) => {
  return res.json({ success: true, data: serproService.getAvailableServices() });
});

// ============================================================
// Executar Servico SERPRO
// ============================================================

router.post('/connections/:id/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { service, contribuinteCnpj, dados } = req.body;
    if (!service) return res.status(400).json({ success: false, error: 'Servico obrigatorio' });

    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const targetCnpj = contribuinteCnpj || conn.cnpj;

    const result = await serproService.callService(
      creds,
      service as SerproServiceName,
      conn.cnpj,
      targetCnpj,
      dados || {},
    );

    await logCall(conn.id, service, 'execute', result);

    await prisma.serproConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date() },
    });

    return res.json({
      success: result.success,
      data: result.data,
      durationMs: result.durationMs,
      messages: result.raw?.mensagens || [],
    });
  } catch (err: any) {
    logger.error('[SERPRO] Erro ao executar servico:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Atalhos — Servicos mais usados
// ============================================================

router.post('/connections/:id/pagamentos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contribuinteCnpj, periodo } = req.body;
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const result = await serproService.consultarPagamentos(creds, conn.cnpj, contribuinteCnpj || conn.cnpj, periodo || '');
    await logCall(conn.id, 'pagamentos', 'Consultar', result);

    return res.json({ success: result.success, data: result.data, durationMs: result.durationMs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/connections/:id/dctfweb', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contribuinteCnpj, periodoApuracao } = req.body;
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const result = await serproService.consultarDCTFWeb(creds, conn.cnpj, contribuinteCnpj || conn.cnpj, periodoApuracao || '');
    await logCall(conn.id, 'dctfweb_completa', 'Consultar', result);

    return res.json({ success: result.success, data: result.data, durationMs: result.durationMs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/connections/:id/situacao-fiscal', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contribuinteCnpj } = req.body;
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const protocoloResult = await serproService.solicitarSituacaoFiscal(creds, conn.cnpj, contribuinteCnpj || conn.cnpj);
    await logCall(conn.id, 'sitfis_protocolo', 'Apoiar', protocoloResult);

    if (!protocoloResult.success) {
      return res.json({ success: false, data: null, error: 'Falha ao solicitar protocolo', durationMs: protocoloResult.durationMs });
    }

    const protocolo = protocoloResult.data?.protocolo || protocoloResult.data?.numProtocolo || '';
    if (!protocolo) {
      return res.json({ success: true, data: protocoloResult.data, step: 'protocolo_gerado', durationMs: protocoloResult.durationMs });
    }

    const relResult = await serproService.obterRelatorioSitFis(creds, conn.cnpj, contribuinteCnpj || conn.cnpj, protocolo);
    await logCall(conn.id, 'sitfis_relatorio', 'Emitir', relResult);

    return res.json({ success: relResult.success, data: relResult.data, durationMs: relResult.durationMs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/connections/:id/caixa-postal', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contribuinteCnpj } = req.body;
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const result = await serproService.consultarCaixaPostal(creds, conn.cnpj, contribuinteCnpj || conn.cnpj);
    await logCall(conn.id, 'caixa_postal_msgs', 'Consultar', result);

    return res.json({ success: result.success, data: result.data, durationMs: result.durationMs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/connections/:id/processos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contribuinteCnpj } = req.body;
    const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ success: false, error: 'Conexao nao encontrada' });

    const creds = getCredentials(conn);
    const result = await serproService.consultarProcessos(creds, conn.cnpj, contribuinteCnpj || conn.cnpj);
    await logCall(conn.id, 'eprocesso_consultar', 'Consultar', result);

    return res.json({ success: result.success, data: result.data, durationMs: result.durationMs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Logs
// ============================================================

// ============================================================
// Onda 3 — Coletas federais via procuracao
// ============================================================

async function loadConn(req: Request, res: Response) {
  const conn = await prisma.serproConnection.findUnique({ where: { id: req.params.id } });
  if (!conn) { res.status(404).json({ success: false, error: 'Conexao nao encontrada' }); return null; }
  return conn;
}

router.post('/connections/:id/perdcomp/lista', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, periodoInicio, periodoFim } = req.body;
    const r = await serproService.listarPerdcomp(getCredentials(conn), conn.cnpj, contribuinteCnpj, periodoInicio, periodoFim);
    await logCall(conn.id, 'perdcomp_lista', 'LISTARPERDCOMP22', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/perdcomp/consulta', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, numero } = req.body;
    const r = await serproService.consultarPerdcomp(getCredentials(conn), conn.cnpj, contribuinteCnpj, numero);
    await logCall(conn.id, 'perdcomp_consulta', 'CONSPERDCOMP21', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/perdcomp/despacho', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, numero } = req.body;
    const r = await serproService.consultarDespachoPerdcomp(getCredentials(conn), conn.cnpj, contribuinteCnpj, numero);
    await logCall(conn.id, 'perdcomp_despacho', 'CONSDESPACHO23', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/dctf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, pa } = req.body;
    const r = await serproService.consultarDCTF(getCredentials(conn), conn.cnpj, contribuinteCnpj, pa);
    await logCall(conn.id, 'dctf_consultar', 'CONSDECLARACAO15', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/dirf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, anoBase } = req.body;
    const r = await serproService.consultarDIRF(getCredentials(conn), conn.cnpj, contribuinteCnpj, parseInt(anoBase, 10));
    await logCall(conn.id, 'dirf_consultar', 'CONSDECLARACAO17', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/fontes-pagadoras', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, anoBase } = req.body;
    const r = await serproService.consultarFontesPagadoras(getCredentials(conn), conn.cnpj, contribuinteCnpj, parseInt(anoBase, 10));
    await logCall(conn.id, 'fontes_pagadoras', 'CONSFONTES18', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/parcelamento-pgfn', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj } = req.body;
    const r = await serproService.consultarParcelamentoPGFN(getCredentials(conn), conn.cnpj, contribuinteCnpj);
    await logCall(conn.id, 'parcelamento_pgfn', 'CONSPARCSIMP41', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/parcelamento-rfb', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj } = req.body;
    const r = await serproService.consultarParcelamentoRFB(getCredentials(conn), conn.cnpj, contribuinteCnpj);
    await logCall(conn.id, 'parcelamento_rfb', 'CONSPARCDEB42', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/connections/:id/caixa-postal/detalhe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, isn } = req.body;
    const r = await serproService.detalharCaixaPostal(getCredentials(conn), conn.cnpj, contribuinteCnpj, isn);
    await logCall(conn.id, 'caixa_postal_detalhe2', 'MSGDETALHAMENTO62', r);
    res.json({ success: r.success, data: r.data });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ============================================================
// Cross-Analysis: DIRF x Fontes Pagadoras
// Detector automatico de divergencias e teses tributarias
// ============================================================
router.post('/connections/:id/analise-cruzada/dirf-fontes', authenticateToken, async (req: Request, res: Response) => {
  try {
    const conn = await loadConn(req, res); if (!conn) return;
    const { contribuinteCnpj, anoBase } = req.body;
    if (!contribuinteCnpj || !anoBase) return res.status(400).json({ success: false, error: 'contribuinteCnpj e anoBase obrigatorios' });
    const result = await runCrossAnalysisDirfFontes(getCredentials(conn), conn.cnpj, contribuinteCnpj, parseInt(anoBase, 10));
    await logCall(conn.id, 'analise_cruzada_dirf_fontes', 'CROSS_ANALYSIS', { success: true, raw: { result: result.resumo }, durationMs: 0 });
    res.json({ success: true, data: result });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/connections/:id/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.serproLog.findMany({
      where: { connectionId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
