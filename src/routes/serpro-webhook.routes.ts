import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { verifyOneProcuration } from '../services/consultri-scheduler.service';

// ============================================================
// Webhook PUBLICO SERPRO / Integra Contador
// ------------------------------------------------------------
// SERPRO/Integra Contador, em contratos premium, suporta callback
// HTTP de eventos (revogacao, alteracao de poderes, expiracao
// proxima). Esta rota recebe esses callbacks e dispara verificacao
// imediata da procuracao afetada (sem esperar o poll de 15min).
//
// Seguranca: HMAC-SHA256 do body com SERPRO_WEBHOOK_SECRET.
// Se a env nao estiver setada, aceita request sem validacao
// (modo desenvolvimento). Em producao SEMPRE setar a secret.
//
// Tambem aceita modo "ping interno" para testes.
// ============================================================

const router = Router();

function verifyHmac(body: string, signature?: string): boolean {
  const secret = process.env.SERPRO_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('[SerproWebhook] SERPRO_WEBHOOK_SECRET nao setado; aceitando sem validacao (modo dev)');
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace(/^sha256=/, '')));
  } catch { return false; }
}

// POST /api/webhooks/serpro
// Body esperado (exemplo):
// {
//   "event": "procuracao.revogada" | "procuracao.alterada" | "procuracao.expirando" | "caixa_postal.nova_msg",
//   "outorganteCnpj": "12345678000190",
//   "procuradorCnpj": "98765432000110",
//   "timestamp": "2026-05-16T13:45:00Z",
//   "payload": { ... }
// }
router.post('/serpro', async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body || {});
  const signature = (req.headers['x-serpro-signature'] || req.headers['x-hub-signature-256']) as string | undefined;

  if (!verifyHmac(rawBody, signature)) {
    logger.warn('[SerproWebhook] HMAC invalido');
    return res.status(401).json({ success: false, error: 'invalid signature' });
  }

  const { event, outorganteCnpj, procuradorCnpj, payload } = req.body || {};
  if (!event) return res.status(400).json({ success: false, error: 'event ausente' });

  logger.info(`[SerproWebhook] evento=${event} outorgante=${outorganteCnpj} procurador=${procuradorCnpj}`);

  try {
    // Sempre persiste o evento bruto pra auditoria
    if (outorganteCnpj && procuradorCnpj) {
      const proc = await prisma.procuration.findFirst({
        where: {
          procuradorCnpj,
          status: { notIn: ['expired'] },
          OR: [
            { client: { is: { cnpj: outorganteCnpj } } as any },
          ],
        } as any,
      }).catch(() => null);

      // Alternativa: busca por viability analysis (analysis_*)
      let procFound = proc;
      if (!procFound) {
        const analyses = await prisma.viabilityAnalysis.findMany({ where: { cnpj: outorganteCnpj }, select: { id: true } });
        if (analyses.length) {
          const ids = analyses.map(a => `analysis_${a.id}`);
          procFound = await prisma.procuration.findFirst({
            where: { procuradorCnpj, clientId: { in: ids }, status: { notIn: ['expired'] } },
            orderBy: { createdAt: 'desc' },
          });
        }
      }

      if (procFound) {
        await prisma.procurationAudit.create({
          data: {
            procurationId: procFound.id,
            event: 'webhook_received',
            message: `Evento SERPRO recebido: ${event}`,
            payload: { event, payload, receivedAt: new Date().toISOString() } as any,
            actorType: 'system',
          },
        });

        // Eventos que requerem re-check imediato
        if (event === 'procuracao.revogada' || event === 'procuracao.alterada') {
          const r = await verifyOneProcuration(procFound.id).catch((e: any) => ({ ok: false, error: e.message }));
          logger.info(`[SerproWebhook] re-check pos-evento: ${JSON.stringify(r)}`);
          return res.json({ success: true, action: 'verified', recheck: r });
        }

        return res.json({ success: true, action: 'audited', procurationId: procFound.id });
      }
    }

    logger.warn(`[SerproWebhook] nenhuma procuracao encontrada para outorgante=${outorganteCnpj} procurador=${procuradorCnpj}`);
    return res.json({ success: true, action: 'ignored', reason: 'procuracao nao encontrada' });
  } catch (err: any) {
    logger.error(`[SerproWebhook] erro: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Health/ping
router.get('/serpro/health', (_req, res) => {
  res.json({
    success: true,
    secured: !!process.env.SERPRO_WEBHOOK_SECRET,
    timestamp: new Date().toISOString(),
  });
});

export default router;
