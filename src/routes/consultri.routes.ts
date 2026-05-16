import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/consultri/health — diagnostico para demo / status pagina
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [activeConn, procTotal, procActive, snapshotsHoje, alertsHoje] = await Promise.all([
      prisma.serproConnection.findFirst({ where: { status: 'active' }, select: { id: true, cnpj: true, environment: true, lastSyncAt: true } }),
      prisma.procuration.count({ where: { presetKey: 'consultri' } }),
      prisma.procuration.count({ where: { presetKey: 'consultri', serproStatus: 'active' } }),
      prisma.conformidadeSnapshot.count({ where: { collectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.notification.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        scheduler: {
          enabled: process.env.CONSULTRI_SCHEDULER_ENABLED === 'true',
          timezone: 'America/Sao_Paulo',
          jobs: ['pollSerpro@*/15min', 'expiryAlerts@08h', 'collectConformidade@06h'],
        },
        serpro: activeConn ? {
          connected: true,
          contratante: activeConn.cnpj,
          environment: activeConn.environment,
          lastSyncAt: activeConn.lastSyncAt,
        } : { connected: false, message: 'Cadastre em /consultri/configuracoes' },
        carteira: {
          totalProcuracoes: procTotal,
          ativas: procActive,
          ativacaoRate: procTotal > 0 ? Math.round((procActive / procTotal) * 100) : 0,
        },
        ultimas24h: {
          snapshotsConformidade: snapshotsHoje,
          notificacoesEnviadas: alertsHoje,
        },
        notifications: {
          emailReal: !!process.env.SMTP_URL,
          whatsappReal: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function requireAdmin(req: Request, res: Response, next: any) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
  }
  next();
}

// ============================================================
// Onda 6D — Executive Summary PDF (carteira inteira, alto nivel)
// Gera HTML imprimivel com posicionamento global da carteira CONSULTRI
// ============================================================
router.get('/executive-summary', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { procuradorEntityId } = req.query;
    const procWhere: any = { presetKey: 'consultri' };
    if (procuradorEntityId) procWhere.procuradorEntityId = procuradorEntityId as string;

    const dia = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const [procs, snaps, notifs, audits] = await Promise.all([
      prisma.procuration.findMany({ where: procWhere }),
      prisma.conformidadeSnapshot.findMany({ orderBy: { collectedAt: 'desc' }, take: 500 }),
      prisma.notification.findMany({ where: { createdAt: { gte: new Date(now - 7 * dia) } } }),
      prisma.procurationAudit.findMany({ where: { event: { in: ['serpro_active', 'auto_grant_success', 'revoked', 'invite_sent'] }, createdAt: { gte: new Date(now - 30 * dia) } } }),
    ]);

    const latestSnap = new Map<string, typeof snaps[number]>();
    for (const s of snaps) if (!latestSnap.has(s.clientId)) latestSnap.set(s.clientId, s);

    const total = procs.length;
    const ativas = procs.filter(p => p.serproStatus === 'active').length;
    const parciais = procs.filter(p => p.serproStatus === 'partial').length;
    const pendentes = procs.filter(p => p.serproStatus === 'pending_serpro' || p.serproStatus === 'not_found').length;
    const revogadas = procs.filter(p => p.serproStatus === 'revoked_detected').length;
    const vencendo30d = procs.filter(p => p.serproStatus === 'active' && p.dataValidade && new Date(p.dataValidade).getTime() - now < 30 * dia).length;
    const ativacaoRate = total > 0 ? Math.round((ativas / total) * 100) : 0;

    const scores = Array.from(latestSnap.values()).map(s => s.score || 0);
    const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const clientesRisco = Array.from(latestSnap.values()).filter(s => (s.score || 100) < 60).length;

    const auditCount = (ev: string) => audits.filter(a => a.event === ev).length;

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Executive Summary CONSULTRI</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #111; font-size: 11px; }
  .hero { background: linear-gradient(135deg,#4c1d95,#1e3a8a); color: white; padding: 24px; border-radius: 10px; margin-bottom: 18px; }
  .hero h1 { margin: 0; font-size: 26px; }
  .hero .sub { opacity: .85; font-size: 12px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #7c3aed; padding-bottom: 4px; color: #4c1d95; }
  .grid { display: grid; gap: 10px; }
  .grid-4 { grid-template-columns: repeat(4,1fr); }
  .grid-3 { grid-template-columns: repeat(3,1fr); }
  .kpi { background: #f8f9fc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
  .kpi .v { font-size: 28px; font-weight: 800; }
  .kpi .l { font-size: 10px; color: #6b7280; text-transform: uppercase; margin-top: 4px; font-weight: 700; }
  .green { color: #065f46; } .red { color: #991b1b; } .yellow { color: #92400e; } .blue { color: #1e40af; } .purple { color: #5b21b6; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f3f4f6; padding: 6px; text-align: left; color: #374151; }
  td { padding: 6px; border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
  .no-print { display: block; } @media print { .no-print { display: none; } }
</style></head><body>

<div class="hero">
  <h1>Executive Summary — Carteira CONSULTRI</h1>
  <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${procuradorEntityId ? 'Procurador filtrado' : 'Todos os procuradores'}</div>
</div>

<h2>1. Carteira (visão macro)</h2>
<div class="grid grid-4">
  <div class="kpi"><div class="v">${total}</div><div class="l">Total procurações</div></div>
  <div class="kpi"><div class="v green">${ativas}</div><div class="l">Ativas</div></div>
  <div class="kpi"><div class="v yellow">${parciais}</div><div class="l">Parciais</div></div>
  <div class="kpi"><div class="v red">${revogadas}</div><div class="l">Revogadas</div></div>
</div>

<h2>2. Indicadores chave (last 30d)</h2>
<div class="grid grid-4">
  <div class="kpi"><div class="v green">${ativacaoRate}%</div><div class="l">Taxa de ativação</div></div>
  <div class="kpi"><div class="v blue">${auditCount('serpro_active')}</div><div class="l">Ativadas pelo SERPRO</div></div>
  <div class="kpi"><div class="v purple">${auditCount('auto_grant_success')}</div><div class="l">Auto-grant SERPRO</div></div>
  <div class="kpi"><div class="v yellow">${vencendo30d}</div><div class="l">Vencendo &le; 30d</div></div>
</div>

<h2>3. Conformidade da carteira</h2>
<div class="grid grid-3">
  <div class="kpi"><div class="v ${scoreMedio >= 80 ? 'green' : scoreMedio >= 60 ? 'yellow' : 'red'}">${scoreMedio}/100</div><div class="l">Score médio</div></div>
  <div class="kpi"><div class="v red">${clientesRisco}</div><div class="l">Clientes em risco (&lt;60)</div></div>
  <div class="kpi"><div class="v">${latestSnap.size}</div><div class="l">Clientes monitorados</div></div>
</div>

<h2>4. Engajamento operacional (last 7d)</h2>
<div class="grid grid-4">
  <div class="kpi"><div class="v blue">${notifs.filter(n => n.status === 'sent').length}</div><div class="l">Notif. enviadas</div></div>
  <div class="kpi"><div class="v red">${notifs.filter(n => n.status === 'failed').length}</div><div class="l">Notif. falhadas</div></div>
  <div class="kpi"><div class="v purple">${auditCount('invite_sent')}</div><div class="l">Convites disparados</div></div>
  <div class="kpi"><div class="v">${notifs.filter(n => n.channel === 'whatsapp').length}</div><div class="l">WhatsApp 7d</div></div>
</div>

<h2>5. Top 10 clientes em risco</h2>
<table>
  <thead><tr><th>CNPJ</th><th>Score</th><th>Status Fiscal</th><th>Caixa Postal</th><th>Pendências</th></tr></thead>
  <tbody>
  ${Array.from(latestSnap.values())
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 10)
      .map(s => `<tr><td>${s.cnpj}</td><td><b class="${(s.score || 0) >= 80 ? 'green' : (s.score || 0) >= 60 ? 'yellow' : 'red'}">${s.score || 0}</b></td><td>${s.situacaoStatus || '—'}</td><td>${s.caixaPostalUnread}</td><td>${s.situacaoPendencias}</td></tr>`)
      .join('')}
  </tbody>
</table>

<div class="footer">
  TaxCredit Platform · Executive Summary CONSULTRI · ${new Date().toISOString()}
</div>

<div class="no-print" style="position:fixed;bottom:16px;right:16px;background:#7c3aed;color:white;padding:10px 16px;border-radius:8px;font-size:12px;cursor:pointer" onclick="window.print()">🖨️ Imprimir / Salvar PDF</div>

</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Onda 5B — Timeline consolidada por cliente
// Agrega procuracoes + audits + invites + notifications + snapshots
// + (opcional) eventos derivados de SerproLog em uma unica timeline.
// ============================================================
router.get('/cliente/:clientId/timeline', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(String(req.query.limit || '200'), 10);

    let clienteNome = 'Cliente', clienteCnpj = '';
    if (clientId.startsWith('analysis_')) {
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: clientId.replace('analysis_', '') } });
      clienteNome = a?.companyName || 'Cliente'; clienteCnpj = a?.cnpj || '';
    } else {
      const u = await prisma.user.findUnique({ where: { id: clientId } });
      clienteNome = u?.company || u?.name || 'Cliente'; clienteCnpj = u?.cnpj || '';
    }

    const procs = await prisma.procuration.findMany({
      where: { clientId },
      select: { id: true, presetKey: true, status: true, serproStatus: true, createdAt: true, dataValidade: true, procuradorNome: true, procuradorCnpj: true, grantMode: true },
      orderBy: { createdAt: 'desc' },
    });
    const procIds = procs.map(p => p.id);

    const [audits, invites, notifs, snaps] = await Promise.all([
      prisma.procurationAudit.findMany({ where: { procurationId: { in: procIds } }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.procurationInvite.findMany({ where: { procurationId: { in: procIds } }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.findMany({
        where: { refType: 'procuration', refId: { in: procIds } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.conformidadeSnapshot.findMany({
        where: { clientId },
        orderBy: { collectedAt: 'desc' },
        take: 30,
      }),
    ]);

    type Evt = { ts: string; kind: string; icon: string; title: string; description?: string; meta?: any; severity?: string };
    const events: Evt[] = [];

    for (const p of procs) {
      events.push({
        ts: p.createdAt.toISOString(),
        kind: 'procuration_created',
        icon: '📜',
        title: `Procuracao criada (${p.presetKey || 'preset'})`,
        description: `Procurador: ${p.procuradorNome || '-'} - Modo: ${p.grantMode || 'manual_invite'}`,
        meta: { procurationId: p.id, status: p.status, serproStatus: p.serproStatus },
        severity: 'info',
      });
    }
    for (const a of audits) {
      const iconMap: Record<string, string> = {
        serpro_active: '✅', serpro_partial: '🟡', revoked: '🚫', renewed: '🔁',
        invite_sent: '📨', webhook_received: '⚡', auto_grant_success: '⚡', auto_grant_failed: '❌',
        guide_generated: '📋', alert_sent: '🔔',
      };
      const sevMap: Record<string, string> = { revoked: 'critical', serpro_partial: 'warning', auto_grant_failed: 'warning' };
      events.push({
        ts: a.createdAt.toISOString(),
        kind: `audit:${a.event}`,
        icon: iconMap[a.event] || '📌',
        title: a.event,
        description: a.message || undefined,
        meta: { procurationId: a.procurationId, payload: a.payload },
        severity: sevMap[a.event] || 'info',
      });
    }
    for (const i of invites) {
      if (i.openedAt) events.push({ ts: i.openedAt.toISOString(), kind: 'invite_opened', icon: '👁️', title: 'Convite aberto pelo cliente', meta: { inviteId: i.id }, severity: 'info' });
      if (i.acknowledgedAt) events.push({ ts: i.acknowledgedAt.toISOString(), kind: 'invite_ack', icon: '✋', title: 'Cliente confirmou conclusao', meta: { inviteId: i.id }, severity: 'info' });
      if (i.completedAt) events.push({ ts: i.completedAt.toISOString(), kind: 'invite_completed', icon: '🎉', title: 'Outorga concluida (detectada via SERPRO)', meta: { inviteId: i.id }, severity: 'info' });
    }
    for (const n of notifs) {
      events.push({
        ts: n.createdAt.toISOString(),
        kind: `notif:${n.channel}`,
        icon: n.channel === 'email' ? '📧' : n.channel === 'whatsapp' ? '📱' : '🔔',
        title: n.subject || n.template || 'Notificacao enviada',
        description: n.body.slice(0, 200),
        meta: { recipient: n.recipient, status: n.status, link: n.link },
        severity: n.severity || 'info',
      });
    }
    for (const s of snaps) {
      const score = s.score || 0;
      events.push({
        ts: s.collectedAt.toISOString(),
        kind: 'snapshot',
        icon: score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴',
        title: `Snapshot conformidade - score ${score}/100`,
        description: `Caixa Postal: ${s.caixaPostalUnread} nao lidas - Pendencias fiscais: ${s.situacaoPendencias}`,
        meta: { snapshotId: s.id },
        severity: score >= 80 ? 'info' : score >= 60 ? 'warning' : 'critical',
      });
    }

    events.sort((a, b) => b.ts.localeCompare(a.ts));

    res.json({
      success: true,
      data: {
        cliente: { clientId, nome: clienteNome, cnpj: clienteCnpj },
        resumo: {
          procuracoes: procs.length,
          ativas: procs.filter(p => p.serproStatus === 'active').length,
          totalEventos: events.length,
        },
        procuracoes: procs,
        events: events.slice(0, limit),
      },
    });
  } catch (err: any) {
    logger.error('Erro timeline:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Onda 4D — Multi-procurador
// ============================================================
router.get('/procuradores', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const lista = await prisma.procuradorEntity.findMany({
      orderBy: [{ ativo: 'desc' }, { razaoSocial: 'asc' }],
      include: { _count: { select: { procurations: true } } },
    });
    res.json({ success: true, data: lista });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/procuradores', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cnpj, razaoSocial, nomeFantasia, presetKey, cor, observacao, ativo } = req.body;
    if (!cnpj || !razaoSocial) return res.status(400).json({ success: false, error: 'cnpj e razaoSocial obrigatorios' });
    const ent = await prisma.procuradorEntity.create({
      data: {
        cnpj: cnpj.replace(/\D/g, ''),
        razaoSocial, nomeFantasia, presetKey, cor, observacao,
        ativo: ativo !== false,
      },
    });
    res.json({ success: true, data: ent });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, error: 'CNPJ ja cadastrado' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/procuradores/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { razaoSocial, nomeFantasia, presetKey, cor, observacao, ativo } = req.body;
    const ent = await prisma.procuradorEntity.update({
      where: { id: req.params.id },
      data: { razaoSocial, nomeFantasia, presetKey, cor, observacao, ativo },
    });
    res.json({ success: true, data: ent });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/procuradores/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const usadas = await prisma.procuration.count({ where: { procuradorEntityId: req.params.id } });
    if (usadas > 0) {
      // Soft delete: marca inativo
      const ent = await prisma.procuradorEntity.update({ where: { id: req.params.id }, data: { ativo: false } });
      return res.json({ success: true, data: ent, softDeleted: true, usadas });
    }
    await prisma.procuradorEntity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ============================================================
// /metrics — KPIs comerciais da carteira CONSULTRI
// ============================================================
router.get('/metrics', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const dia = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const { procuradorEntityId } = req.query;

    const procWhere: any = { presetKey: 'consultri' };
    if (procuradorEntityId) procWhere.procuradorEntityId = procuradorEntityId as string;

    const all = await prisma.procuration.findMany({
      where: procWhere,
      select: {
        id: true, status: true, serproStatus: true, grantMode: true,
        createdAt: true, dataValidade: true, dataAssinatura: true,
        revocationDetectedAt: true, lastSerproCheckAt: true,
      },
    });
    const total = all.length;
    const ativas = all.filter(p => p.serproStatus === 'active').length;
    const pendentes = all.filter(p => p.serproStatus === 'pending_serpro' || p.serproStatus === 'not_found').length;
    const parciais = all.filter(p => p.serproStatus === 'partial').length;
    const revogadas = all.filter(p => p.serproStatus === 'revoked_detected' || p.status === 'revoked').length;
    const ativacaoRate = total > 0 ? Math.round((ativas / total) * 100) : 0;

    // Tempo medio de ativacao: created -> serpro_active (via audit)
    const audits = await prisma.procurationAudit.findMany({
      where: { event: 'serpro_active' },
      select: { procurationId: true, createdAt: true },
    });
    const auditMap = new Map(audits.map(a => [a.procurationId, a.createdAt]));
    const tempos: number[] = [];
    for (const p of all) {
      const ativadoEm = auditMap.get(p.id);
      if (ativadoEm) {
        const horas = (new Date(ativadoEm).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
        if (horas >= 0 && horas < 30 * 24) tempos.push(horas);
      }
    }
    const tempoMedioOutorgaHoras = tempos.length > 0
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
      : null;

    // Vencendo em ate 30 dias
    const vencendo30d = all.filter(p =>
      p.serproStatus === 'active' &&
      p.dataValidade &&
      new Date(p.dataValidade).getTime() - now < 30 * dia
    ).length;

    // Distribuicao por modo de outorga
    const porModo = {
      auto_serpro: all.filter(p => p.grantMode === 'auto_serpro').length,
      manual_invite: all.filter(p => p.grantMode === 'manual_invite').length,
      indefinido: all.filter(p => !p.grantMode).length,
    };

    // Convites: taxa de abertura e ack
    const invites = await prisma.procurationInvite.findMany({
      select: { status: true, createdAt: true, openedAt: true, acknowledgedAt: true, completedAt: true },
    });
    const inviteStats = {
      total: invites.length,
      pending: invites.filter(i => i.status === 'pending').length,
      opened: invites.filter(i => !!i.openedAt).length,
      acknowledged: invites.filter(i => !!i.acknowledgedAt).length,
      completed: invites.filter(i => !!i.completedAt).length,
      openRate: invites.length > 0 ? Math.round((invites.filter(i => !!i.openedAt).length / invites.length) * 100) : 0,
      ackRate: invites.length > 0 ? Math.round((invites.filter(i => !!i.acknowledgedAt).length / invites.length) * 100) : 0,
      completionRate: invites.length > 0 ? Math.round((invites.filter(i => !!i.completedAt).length / invites.length) * 100) : 0,
    };

    // Notificacoes 24h
    const notifs = await prisma.notification.findMany({
      where: { createdAt: { gte: new Date(now - dia) } },
      select: { channel: true, status: true },
    });
    const notificacoes24h = {
      total: notifs.length,
      sent: notifs.filter(n => n.status === 'sent').length,
      failed: notifs.filter(n => n.status === 'failed').length,
      email: notifs.filter(n => n.channel === 'email').length,
      whatsapp: notifs.filter(n => n.channel === 'whatsapp').length,
    };

    // Engajamento Caixa Postal — quantos snapshots viram mensagens novas hoje
    const snapsHoje = await prisma.conformidadeSnapshot.findMany({
      where: { collectedAt: { gte: new Date(now - dia) } },
      select: { caixaPostalUnread: true, score: true },
    });
    const caixaEngagement = {
      coletadosHoje: snapsHoje.length,
      comMensagemNova: snapsHoje.filter(s => s.caixaPostalUnread > 0).length,
      totalMensagensNovas: snapsHoje.reduce((acc, s) => acc + (s.caixaPostalUnread || 0), 0),
      scoreMedio: snapsHoje.length > 0 ? Math.round(snapsHoje.reduce((acc, s) => acc + (s.score || 0), 0) / snapsHoje.length) : 0,
    };

    // Funil temporal de criacao (ultimos 90 dias agrupado por semana)
    const funilSemanas: Record<string, { criadas: number; ativadas: number }> = {};
    for (const p of all) {
      const created = new Date(p.createdAt);
      if (now - created.getTime() > 90 * dia) continue;
      const weekKey = `${created.getUTCFullYear()}-W${String(Math.ceil((created.getTime() / dia + 4) / 7) % 52).padStart(2, '0')}`;
      funilSemanas[weekKey] = funilSemanas[weekKey] || { criadas: 0, ativadas: 0 };
      funilSemanas[weekKey].criadas++;
      if (auditMap.has(p.id)) funilSemanas[weekKey].ativadas++;
    }

    res.json({
      success: true,
      data: {
        carteira: { total, ativas, pendentes, parciais, revogadas, ativacaoRate, vencendo30d },
        tempoMedioOutorga: { horas: tempoMedioOutorgaHoras, amostras: tempos.length },
        porModo,
        convites: inviteStats,
        notificacoes24h,
        caixaPostal: caixaEngagement,
        funilSemanas,
      },
    });
  } catch (err: any) {
    logger.error('Erro metrics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Dashboard de Conformidade — agregado mais recente por cliente
// ============================================================
router.get('/conformidade', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { procuradorEntityId } = req.query;

    // Se filtro por procurador, restringe clientIds
    let clientIdFilter: string[] | undefined;
    if (procuradorEntityId) {
      const procs = await prisma.procuration.findMany({
        where: { procuradorEntityId: procuradorEntityId as string },
        select: { clientId: true },
      });
      clientIdFilter = [...new Set(procs.map(p => p.clientId))];
      if (clientIdFilter.length === 0) {
        return res.json({ success: true, data: [], stats: { total: 0, caixaPendente: 0, situacaoComPendencia: 0, scoreMedio: 0 }, top5: [] });
      }
    }

    const snapshots = await prisma.conformidadeSnapshot.findMany({
      where: clientIdFilter ? { clientId: { in: clientIdFilter } } : undefined,
      orderBy: { collectedAt: 'desc' },
      take: 1000,
    });
    const latestByClient = new Map<string, typeof snapshots[number]>();
    for (const s of snapshots) {
      if (!latestByClient.has(s.clientId)) latestByClient.set(s.clientId, s);
    }
    const list = Array.from(latestByClient.values());

    // Enriquece com nome do cliente
    const clientIds = list.map(s => s.clientId).filter(id => !id.startsWith('analysis_'));
    const users = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, company: true, cnpj: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = list.map(s => ({
      ...s,
      client: userMap[s.clientId] || { id: s.clientId, name: null, company: null, cnpj: s.cnpj },
    }));

    // Stats agregadas
    const stats = {
      total: enriched.length,
      caixaPendente: enriched.filter(s => s.caixaPostalUnread > 0).length,
      situacaoComPendencia: enriched.filter(s => s.situacaoStatus === 'pendencias').length,
      scoreMedio: enriched.length > 0
        ? Math.round(enriched.reduce((acc, s) => acc + (s.score || 0), 0) / enriched.length)
        : 0,
    };

    // Top 5 em risco (menor score)
    const top5 = [...enriched]
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 5)
      .map(s => ({
        clientId: s.clientId,
        nome: (s as any).client?.company || (s as any).client?.name || s.cnpj,
        cnpj: s.cnpj,
        score: s.score || 0,
        caixaPostalUnread: s.caixaPostalUnread,
        situacaoStatus: s.situacaoStatus,
        situacaoPendencias: s.situacaoPendencias,
      }));

    res.json({ success: true, data: enriched, stats, top5 });
  } catch (err: any) {
    logger.error('Erro conformidade:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar conformidade' });
  }
});

// GET /api/consultri/conformidade/:clientId/historico
router.get('/conformidade/:clientId/historico', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const snaps = await prisma.conformidadeSnapshot.findMany({
      where: { clientId: req.params.clientId },
      orderBy: { collectedAt: 'desc' },
      take: 90,
    });
    res.json({ success: true, data: snaps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao buscar historico' });
  }
});

// GET /api/consultri/ranking — ranking inadimplencia (menor score primeiro)
router.get('/ranking', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snaps = await prisma.conformidadeSnapshot.findMany({
      orderBy: { collectedAt: 'desc' },
      take: 1000,
    });
    const latestByClient = new Map<string, typeof snaps[number]>();
    for (const s of snaps) {
      if (!latestByClient.has(s.clientId)) latestByClient.set(s.clientId, s);
    }
    const ranked = Array.from(latestByClient.values())
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 50);

    res.json({ success: true, data: ranked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao montar ranking' });
  }
});

// ============================================================
// Notificacoes — Hub in-app + timeline
// ============================================================
router.get('/notifications', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { refType, refId, status, channel, unreadOnly, severity, limit } = req.query;
    const where: any = {};
    if (refType) where.refType = refType as string;
    if (refId)   where.refId   = refId as string;
    if (status)  where.status  = status as string;
    if (channel) where.channel = channel as string;
    if (severity) where.severity = severity as string;
    if (String(unreadOnly) === 'true') where.readAt = null;
    const data = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt((limit as string) || '100', 10),
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao buscar notificacoes' });
  }
});

// Badge: contadores rapidos pro bell icon
router.get('/notifications/badge', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const [totalUnread, criticalUnread, last] = await Promise.all([
      prisma.notification.count({ where: { readAt: null } }),
      prisma.notification.count({ where: { readAt: null, severity: 'critical' } }),
      prisma.notification.findFirst({
        where: { readAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, subject: true, body: true, severity: true, createdAt: true, link: true, channel: true, refType: true, refId: true },
      }),
    ]);
    res.json({
      success: true,
      data: { unread: totalUnread, criticalUnread, last },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Marcar uma como lida
router.post('/notifications/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const n = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json({ success: true, data: n });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Marcar todas como lidas
router.post('/notifications/read-all', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const r = await prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, marked: r.count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// SerproConnection — cadastrar/atualizar conexao CONSULTRI
// ============================================================
router.get('/serpro-connections', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const conns = await prisma.serproConnection.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, cnpj: true, companyName: true, status: true,
        environment: true, lastSyncAt: true, lastError: true,
        procuracaoOk: true, createdAt: true, updatedAt: true,
      },
    });
    res.json({ success: true, data: conns });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro ao listar conexoes' });
  }
});

router.post('/serpro-connections', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      cnpj, companyName, consumerKey, consumerSecret,
      certBase64, certPassword, environment,
    } = req.body || {};

    if (!cnpj || !consumerKey || !consumerSecret) {
      return res.status(400).json({ success: false, error: 'cnpj, consumerKey, consumerSecret obrigatorios' });
    }

    // Procura existente por CNPJ
    const existing = await prisma.serproConnection.findFirst({ where: { cnpj } });
    let conn;
    if (existing) {
      conn = await prisma.serproConnection.update({
        where: { id: existing.id },
        data: {
          companyName, consumerKey, consumerSecret,
          certBase64: certBase64 || existing.certBase64,
          certPassword: certPassword || existing.certPassword,
          environment: environment || existing.environment,
          status: 'active',
        },
      });
    } else {
      conn = await prisma.serproConnection.create({
        data: {
          cnpj, companyName: companyName || cnpj,
          consumerKey, consumerSecret,
          certBase64, certPassword,
          environment: environment || 'trial',
          status: 'active',
        },
      });
    }
    res.json({ success: true, data: { id: conn.id, cnpj: conn.cnpj, status: conn.status } });
  } catch (err: any) {
    logger.error('Erro ao salvar conn SERPRO:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar conexao: ' + err.message });
  }
});

export default router;
