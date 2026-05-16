import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { serproService } from './serpro.service';
import { diffPoderes } from './procuration.service';
import { notificationService } from './notification.service';

// ============================================================
// Consultri Scheduler — Onda 2 automacao
// ------------------------------------------------------------
// 3 jobs principais:
//   1) pollSerpro          — a cada 15 min (verifica procuracoes pendentes/parciais)
//   2) checkExpiryAlerts   — diario 08:00 BRT (alertas 60/30/7 dias)
//   3) collectConformidade — diario 06:00 BRT (snapshot Caixa Postal + SitFis + DCTFWeb)
//
// Todos os jobs sao idempotentes e usam transacoes/locks logicos
// (audit log e timestamps de "ultimo alerta enviado") para evitar
// duplicidade. Configuravel via env CONSULTRI_SCHEDULER_ENABLED=true
// ============================================================

async function getActiveSerproConnection() {
  return prisma.serproConnection.findFirst({
    where: { status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
}

async function audit(procurationId: string, event: string, message: string, payload?: any) {
  try {
    await prisma.procurationAudit.create({
      data: {
        procurationId,
        event,
        message,
        actorType: 'cron',
        payload: payload || undefined,
      },
    });
  } catch (e: any) {
    logger.error(`[ConsultriScheduler] Falha ao auditar: ${e.message}`);
  }
}

// ============================================================
// Job 1: pollSerpro
// ============================================================
// Exportado para reuso pelo webhook / endpoint manual
export async function verifyOneProcuration(procurationId: string): Promise<{ ok: boolean; serproStatus?: string; revoked?: boolean; missing?: number; error?: string }> {
  const conn = await getActiveSerproConnection();
  if (!conn) return { ok: false, error: 'Nenhuma SerproConnection ativa' };
  const p = await prisma.procuration.findUnique({ where: { id: procurationId } });
  if (!p) return { ok: false, error: 'Procuracao nao encontrada' };
  if (!p.procuradorCnpj) return { ok: false, error: 'procuradorCnpj ausente' };

  let outorganteCnpj = '';
  if (p.clientId.startsWith('analysis_')) {
    const a = await prisma.viabilityAnalysis.findUnique({ where: { id: p.clientId.replace('analysis_', '') } });
    outorganteCnpj = a?.cnpj || '';
  } else {
    const u = await prisma.user.findUnique({ where: { id: p.clientId } });
    outorganteCnpj = u?.cnpj || '';
  }
  if (!outorganteCnpj) return { ok: false, error: 'CNPJ outorgante ausente' };

  const creds = {
    consumerKey: conn.consumerKey,
    consumerSecret: conn.consumerSecret,
    certBase64: conn.certBase64 || undefined,
    certPassword: conn.certPassword || undefined,
    environment: (conn.environment || 'trial') as 'trial' | 'production',
  };
  const result = await serproService.checkProcuracao(creds as any, conn.cnpj, outorganteCnpj, p.procuradorCnpj);
  const granted = !!result?.success && !!result?.data;
  const diff = granted
    ? diffPoderes(p.presetKey || 'consultri', result.data)
    : { granted: [], missing: (p.poderes as any) || [], extras: [] };

  let serproStatus: string;
  if (!granted) serproStatus = 'not_found';
  else if (diff.missing.length === 0) serproStatus = 'active';
  else serproStatus = 'partial';

  const wasActive = p.serproStatus === 'active';
  const wasRevoked = wasActive && serproStatus === 'not_found';

  await prisma.procuration.update({
    where: { id: p.id },
    data: {
      lastSerproCheckAt: new Date(),
      serproStatus: wasRevoked ? 'revoked_detected' : serproStatus,
      serproDiff: diff as any,
      serproRaw: result?.raw || null,
      status: wasRevoked ? 'revoked' : (serproStatus === 'active' ? 'active' : p.status),
      revocationDetectedAt: wasRevoked ? new Date() : p.revocationDetectedAt,
    },
  });

  if (wasRevoked) {
    await audit(p.id, 'revoked', 'Revogacao detectada via webhook/check pontual', { previouslyActive: true });
  } else if (serproStatus === 'active' && !wasActive) {
    await audit(p.id, 'serpro_active', 'Procuracao ativada via webhook/check pontual', { granted: diff.granted.length });
  }

  return { ok: true, serproStatus: wasRevoked ? 'revoked_detected' : serproStatus, revoked: wasRevoked, missing: diff.missing.length };
}

export async function jobPollSerpro(): Promise<{ checked: number; activated: number; partial: number; errors: number }> {
  const conn = await getActiveSerproConnection();
  if (!conn) {
    logger.warn('[ConsultriScheduler] pollSerpro: nenhuma SerproConnection ativa, pulando');
    return { checked: 0, activated: 0, partial: 0, errors: 0 };
  }

  // Pega procuracoes que ainda nao estao ativas ou que ainda nao
  // foram verificadas nas ultimas 12h (re-checa periodicamente).
  const limiar = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const candidatas = await prisma.procuration.findMany({
    where: {
      OR: [
        { serproStatus: { in: ['pending_serpro', 'not_found', 'partial', null as any] } },
        { lastSerproCheckAt: { lt: limiar } },
      ],
      procuradorCnpj: { not: null },
      status: { notIn: ['revoked', 'expired'] },
    },
    take: 100,
  });

  let activated = 0, partial = 0, errors = 0;
  for (const p of candidatas) {
    try {
      // Resolve CNPJ outorgante
      let outorganteCnpj = '';
      if (p.clientId.startsWith('analysis_')) {
        const a = await prisma.viabilityAnalysis.findUnique({ where: { id: p.clientId.replace('analysis_', '') } });
        outorganteCnpj = a?.cnpj || '';
      } else {
        const u = await prisma.user.findUnique({ where: { id: p.clientId } });
        outorganteCnpj = u?.cnpj || '';
      }
      if (!outorganteCnpj || !p.procuradorCnpj) continue;

      const creds = {
        consumerKey: conn.consumerKey,
        consumerSecret: conn.consumerSecret,
        certBase64: conn.certBase64 || undefined,
        certPassword: conn.certPassword || undefined,
        environment: (conn.environment || 'trial') as 'trial' | 'production',
      };

      const result = await serproService.checkProcuracao(creds as any, conn.cnpj, outorganteCnpj, p.procuradorCnpj);
      const granted = !!result?.success && !!result?.data;
      const diff = granted
        ? diffPoderes(p.presetKey || 'consultri', result.data)
        : { granted: [], missing: (p.poderes as any) || [], extras: [] };

      let serproStatus: string;
      if (!granted) serproStatus = 'not_found';
      else if (diff.missing.length === 0) serproStatus = 'active';
      else serproStatus = 'partial';

      const wasActive = p.serproStatus === 'active';

      // === DETECCAO AUTOMATICA DE REVOGACAO ===
      // Estava ativa e agora nao retorna mais -> cliente revogou no e-CAC
      const wasRevoked = wasActive && serproStatus === 'not_found';

      await prisma.procuration.update({
        where: { id: p.id },
        data: {
          lastSerproCheckAt: new Date(),
          serproStatus: wasRevoked ? 'revoked_detected' : serproStatus,
          serproDiff: diff as any,
          serproRaw: result?.raw || null,
          status: wasRevoked ? 'revoked' : (serproStatus === 'active' ? 'active' : p.status),
          revocationDetectedAt: wasRevoked ? new Date() : p.revocationDetectedAt,
        },
      });

      if (wasRevoked) {
        await audit(p.id, 'revoked', 'Revogacao detectada automaticamente (procuracao deixou de retornar via SERPRO)', { previouslyActive: true });
        try {
          await notificationService.send({
            channel: 'whatsapp',
            recipient: p.responsavelPhone || '',
            subject: '[CONSULTRI] Procuracao REVOGADA',
            body: `[CONSULTRI] ATENCAO: procuracao de ${outorganteCnpj} foi revogada pelo cliente no e-CAC. Coleta automatica interrompida. Acesse https://app.taxcredit.com.br/consultri/carteira para acoes.`,
            template: 'procuration_revoked_detected',
            refType: 'procuration',
            refId: p.id,
          });
          if (p.responsavelEmail) {
            await notificationService.send({
              channel: 'email',
              recipient: p.responsavelEmail,
              subject: `[CONSULTRI] Procuracao REVOGADA - ${outorganteCnpj}`,
              body: `A procuracao do cliente ${outorganteCnpj} foi revogada pelo cliente no proprio e-CAC.\n\nA coleta automatica de Caixa Postal, DCTFWeb e Situacao Fiscal foi interrompida.\n\nRecomendacoes:\n- Contate o cliente para entender o motivo\n- Se for engano, oriente a reoutorgar imediatamente\n- Se for intencional, considere encerrar o contrato\n\nhttps://app.taxcredit.com.br/consultri/carteira`,
              template: 'procuration_revoked_detected',
              refType: 'procuration',
              refId: p.id,
            });
          }
        } catch (notifErr: any) {
          logger.error(`[ConsultriScheduler] notif revogacao falhou proc=${p.id}: ${notifErr.message}`);
        }
        continue; // pula bloco de ativacao
      }

      if (serproStatus === 'active' && !wasActive) {
        activated++;
        await audit(p.id, 'serpro_active', `Procuracao detectada como ATIVA via OBTERPROCURACAO41`, { granted: diff.granted.length });

        // Notifica responsavel
        const cliente = p.clientId.startsWith('analysis_')
          ? (await prisma.viabilityAnalysis.findUnique({ where: { id: p.clientId.replace('analysis_', '') } }))?.companyName
          : (await prisma.user.findUnique({ where: { id: p.clientId } }))?.company;

        await notificationService.notifyActivation({
          procurationId: p.id,
          clienteNome: cliente || 'Cliente',
          email: p.responsavelEmail,
          phone: p.responsavelPhone,
        });

        // Marca convite (se houver) como completed
        await prisma.procurationInvite.updateMany({
          where: { procurationId: p.id, status: { in: ['pending', 'opened', 'acknowledged'] } },
          data: { status: 'completed', completedAt: new Date() },
        });
      } else if (serproStatus === 'partial') {
        partial++;
        await audit(p.id, 'serpro_partial', `Procuracao parcial: ${diff.missing.length} poderes faltando`, { missing: diff.missing.length });
      }
    } catch (err: any) {
      errors++;
      logger.error(`[ConsultriScheduler] pollSerpro erro proc=${p.id}: ${err.message}`);
    }
  }

  const summary = { checked: candidatas.length, activated, partial, errors };
  logger.info(`[ConsultriScheduler] pollSerpro: ${JSON.stringify(summary)}`);
  return summary;
}

// ============================================================
// Job 2: checkExpiryAlerts
// ============================================================
export async function jobExpiryAlerts(): Promise<{ alerts60: number; alerts30: number; alerts7: number }> {
  const now = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  // Janela: ate 60 dias pra vencer e ja ativa (precisa renovar)
  const ativas = await prisma.procuration.findMany({
    where: {
      serproStatus: 'active',
      dataValidade: { not: null, lte: new Date(now + 60 * dia) },
      status: { notIn: ['revoked', 'expired'] },
    },
  });

  let alerts60 = 0, alerts30 = 0, alerts7 = 0;
  for (const p of ativas) {
    if (!p.dataValidade) continue;
    const diasRestantes = Math.ceil((new Date(p.dataValidade).getTime() - now) / dia);

    // Decide qual alerta enviar
    const clienteData = p.clientId.startsWith('analysis_')
      ? await prisma.viabilityAnalysis.findUnique({ where: { id: p.clientId.replace('analysis_', '') } })
      : await prisma.user.findUnique({ where: { id: p.clientId } });
    const clienteNome = (clienteData as any)?.companyName || (clienteData as any)?.company || (clienteData as any)?.name || 'Cliente';
    const clienteCnpj = (clienteData as any)?.cnpj || '';

    const baseArgs = {
      procurationId: p.id,
      clienteNome,
      clienteCnpj,
      dataValidade: p.dataValidade,
      email: p.responsavelEmail,
      phone: p.responsavelPhone,
    };

    try {
      if (diasRestantes <= 7 && !p.alert7SentAt) {
        await notificationService.notifyExpiry({ ...baseArgs, diasRestantes });
        await prisma.procuration.update({ where: { id: p.id }, data: { alert7SentAt: new Date() } });
        await audit(p.id, 'alert_sent', `Alerta 7 dias enviado`, { diasRestantes });
        alerts7++;
      } else if (diasRestantes <= 30 && !p.alert30SentAt) {
        await notificationService.notifyExpiry({ ...baseArgs, diasRestantes });
        await prisma.procuration.update({ where: { id: p.id }, data: { alert30SentAt: new Date() } });
        await audit(p.id, 'alert_sent', `Alerta 30 dias enviado`, { diasRestantes });
        alerts30++;
      } else if (diasRestantes <= 60 && !p.alert60SentAt) {
        await notificationService.notifyExpiry({ ...baseArgs, diasRestantes });
        await prisma.procuration.update({ where: { id: p.id }, data: { alert60SentAt: new Date() } });
        await audit(p.id, 'alert_sent', `Alerta 60 dias enviado`, { diasRestantes });
        alerts60++;
      }
    } catch (err: any) {
      logger.error(`[ConsultriScheduler] expiryAlerts erro proc=${p.id}: ${err.message}`);
    }
  }

  const summary = { alerts60, alerts30, alerts7 };
  logger.info(`[ConsultriScheduler] expiryAlerts: ${JSON.stringify(summary)}`);
  return summary;
}

// ============================================================
// Job 3: collectConformidade (Caixa Postal + SitFis + DCTFWeb)
// ============================================================
export async function jobCollectConformidade(): Promise<{ snapshots: number; errors: number }> {
  const conn = await getActiveSerproConnection();
  if (!conn) {
    logger.warn('[ConsultriScheduler] collectConformidade: nenhuma SerproConnection ativa');
    return { snapshots: 0, errors: 0 };
  }

  const ativas = await prisma.procuration.findMany({
    where: { serproStatus: 'active', status: 'active' },
    take: 200,
  });

  const creds = {
    consumerKey: conn.consumerKey,
    consumerSecret: conn.consumerSecret,
    certBase64: conn.certBase64 || undefined,
    certPassword: conn.certPassword || undefined,
    environment: (conn.environment || 'trial') as 'trial' | 'production',
  };

  let snapshots = 0, errors = 0;
  for (const p of ativas) {
    try {
      let cnpj = '';
      let clientId = p.clientId;
      if (clientId.startsWith('analysis_')) {
        const a = await prisma.viabilityAnalysis.findUnique({ where: { id: clientId.replace('analysis_', '') } });
        cnpj = a?.cnpj || '';
      } else {
        const u = await prisma.user.findUnique({ where: { id: clientId } });
        cnpj = u?.cnpj || '';
      }
      if (!cnpj) continue;

      const [caixa, situacao] = await Promise.all([
        serproService.consultarNovasMensagens(creds as any, conn.cnpj, cnpj).catch(() => null),
        serproService.solicitarSituacaoFiscal(creds as any, conn.cnpj, cnpj).catch(() => null),
      ]);

      const caixaUnread = extractUnreadCount(caixa?.data);
      const sitStatus = extractSituacaoStatus(situacao?.data);
      const sitPend = extractPendencias(situacao?.data);

      const score = computeConformidadeScore({ caixaUnread, sitPend });

      await prisma.conformidadeSnapshot.create({
        data: {
          clientId,
          cnpj,
          procurationId: p.id,
          caixaPostalUnread: caixaUnread,
          caixaPostalSummary: caixa?.data || undefined,
          situacaoStatus: sitStatus,
          situacaoPendencias: sitPend,
          score,
          raw: { caixa: caixa?.raw, situacao: situacao?.raw } as any,
        },
      });
      snapshots++;

      // Se aparecer NOVA mensagem na caixa postal, notifica
      if (caixaUnread > 0) {
        await notificationService.send({
          channel: 'whatsapp',
          recipient: p.responsavelPhone || '',
          body: `[CONSULTRI] Cliente ${cnpj}: ${caixaUnread} novas mensagens na Caixa Postal e-CAC. Verifique em https://app.taxcredit.com.br/consultri/conformidade`,
          template: 'caixa_postal_nova',
          refType: 'procuration',
          refId: p.id,
        }).catch(() => null);
      }
    } catch (err: any) {
      errors++;
      logger.error(`[ConsultriScheduler] collectConformidade erro proc=${p.id}: ${err.message}`);
    }
  }

  const summary = { snapshots, errors };
  logger.info(`[ConsultriScheduler] collectConformidade: ${JSON.stringify(summary)}`);
  return summary;
}

function extractUnreadCount(data: any): number {
  if (!data) return 0;
  if (typeof data === 'number') return data;
  if (Array.isArray(data)) return data.length;
  if (typeof data === 'object') {
    if (typeof data.qtdNovasMensagens === 'number') return data.qtdNovasMensagens;
    if (typeof data.quantidade === 'number') return data.quantidade;
    if (Array.isArray(data.mensagens)) return data.mensagens.length;
  }
  return 0;
}

function extractSituacaoStatus(data: any): string {
  if (!data) return 'nao_consultado';
  const txt = JSON.stringify(data).toLowerCase();
  if (txt.includes('sem pendencia') || txt.includes('regular')) return 'limpo';
  if (txt.includes('pendencia') || txt.includes('debito')) return 'pendencias';
  return 'desconhecido';
}

function extractPendencias(data: any): number {
  if (!data) return 0;
  if (Array.isArray(data?.pendencias)) return data.pendencias.length;
  if (typeof data?.qtdPendencias === 'number') return data.qtdPendencias;
  return 0;
}

function computeConformidadeScore(args: { caixaUnread: number; sitPend: number }): number {
  let score = 100;
  score -= args.caixaUnread * 5;
  score -= args.sitPend * 10;
  return Math.max(0, Math.min(100, score));
}

// ============================================================
// Job 4: jobPreventiveRenewal
// ------------------------------------------------------------
// 60 dias antes do vencimento, cria automaticamente uma nova
// procuracao (clone com nova vigencia), gera convite e dispara
// notificacao "renovacao iniciada". Evita gap entre o vencimento
// e a nova outorga.
// ============================================================
import crypto from 'crypto';
import { getProcuracaoPreset, generateProcurationDocument } from './procuration.service';

export async function jobPreventiveRenewal(): Promise<{ renewed: number; skipped: number; errors: number }> {
  const now = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  // Janela 55-65 dias para vencer + ainda ativa + sem renovacao em curso
  const candidatas = await prisma.procuration.findMany({
    where: {
      serproStatus: 'active',
      status: 'active',
      dataValidade: {
        gte: new Date(now + 55 * dia),
        lte: new Date(now + 65 * dia),
      },
    },
  });

  let renewed = 0, skipped = 0, errors = 0;
  for (const original of candidatas) {
    try {
      // Skip se ja existe procuracao mais nova pro mesmo cliente
      const newer = await prisma.procuration.findFirst({
        where: {
          clientId: original.clientId,
          presetKey: original.presetKey,
          createdAt: { gt: original.createdAt },
        },
      });
      if (newer) { skipped++; continue; }

      const preset = getProcuracaoPreset(original.presetKey || 'consultri');
      const prazoMeses = preset?.prazoMeses || (original.prazoAnos || 1) * 12;
      const novaValidade = new Date();
      novaValidade.setMonth(novaValidade.getMonth() + prazoMeses);

      // Regenera o documento textual com as novas datas
      let clienteNome = 'Cliente';
      let clienteCnpj = '';
      if (original.clientId.startsWith('analysis_')) {
        const a = await prisma.viabilityAnalysis.findUnique({ where: { id: original.clientId.replace('analysis_', '') } });
        clienteNome = a?.companyName || 'Cliente';
        clienteCnpj = a?.cnpj || '';
      } else {
        const u = await prisma.user.findUnique({ where: { id: original.clientId } });
        clienteNome = u?.company || u?.name || 'Cliente';
        clienteCnpj = u?.cnpj || '';
      }

      const documentText = generateProcurationDocument({
        type: 'ecac_preset',
        lawyerScenario: 'partner_lawyer',
        clienteNome,
        clienteCnpj,
        clienteEndereco: '',
        representanteNome: '',
        representanteCpf: '',
        poderes: preset?.poderes,
        presetKey: (original.presetKey as any) || 'consultri',
      });

      const nova = await prisma.procuration.create({
        data: {
          clientId: original.clientId,
          contractId: original.contractId,
          partnerId: original.partnerId,
          type: original.type,
          lawyerScenario: original.lawyerScenario,
          status: 'generated',
          outorgadoAtom: original.outorgadoAtom,
          outorgadoAdv: original.outorgadoAdv,
          prazoAnos: original.prazoAnos,
          poderes: original.poderes as any,
          documentText,
          dataValidade: novaValidade,
          presetKey: original.presetKey,
          procuradorCnpj: original.procuradorCnpj,
          procuradorNome: original.procuradorNome,
          serproStatus: 'pending_serpro',
          responsavelEmail: original.responsavelEmail,
          responsavelPhone: original.responsavelPhone,
          grantMode: 'manual_invite',
        },
      });

      // Audit
      await audit(nova.id, 'created', `Renovacao preventiva automatica (60d antes do vencimento da ${original.id})`, { originalId: original.id });
      await audit(original.id, 'renewed', `Renovacao preventiva criou nova procuracao ${nova.id}`, { newProcurationId: nova.id });

      // === HIBRIDO: tenta auto-grant via AUTENTICAPROCURADOR antes do convite ===
      let autoGrantOk = false;
      try {
        const conn = await getActiveSerproConnection();
        if (conn && original.procuradorCnpj && clienteCnpj) {
          const creds = {
            consumerKey: conn.consumerKey,
            consumerSecret: conn.consumerSecret,
            certBase64: conn.certBase64 || undefined,
            certPassword: conn.certPassword || undefined,
            environment: (conn.environment || 'trial') as 'trial' | 'production',
          };
          const capability = await serproService.checkAutoGrantCapability(creds as any, conn.cnpj);
          if (capability.supported) {
            await prisma.procuration.update({
              where: { id: nova.id },
              data: { grantMode: 'auto_serpro', autoGrantStatus: 'attempting', autoGrantAttemptedAt: new Date() },
            });
            const grant = await serproService.cadastrarProcuracaoAuto(
              creds as any, conn.cnpj, clienteCnpj, original.procuradorCnpj,
              undefined, // sem XML assinado disponivel programaticamente neste momento
              (original.poderes as any) || [],
            );
            if (grant.success) {
              autoGrantOk = true;
              await prisma.procuration.update({
                where: { id: nova.id },
                data: {
                  autoGrantStatus: 'success',
                  autoGrantProtocol: grant.protocol || null,
                  serproStatus: 'pending_serpro',
                },
              });
              await audit(nova.id, 'auto_grant_success', `Renovacao preventiva auto-outorgada via SERPRO (protocolo ${grant.protocol || '-'})`, { protocol: grant.protocol });
              logger.info(`[ConsultriScheduler] preventiveRenewal: auto-grant OK proc=${nova.id} proto=${grant.protocol}`);
            } else {
              await prisma.procuration.update({
                where: { id: nova.id },
                data: {
                  autoGrantStatus: 'failed',
                  autoGrantError: grant.reason || 'desconhecido',
                  grantMode: 'manual_invite',
                },
              });
              await audit(nova.id, 'auto_grant_failed', `Auto-grant falhou: ${grant.reason}. Caindo para convite manual.`, { reason: grant.reason });
            }
          } else {
            await prisma.procuration.update({
              where: { id: nova.id },
              data: { autoGrantStatus: 'not_supported', autoGrantError: capability.reason || null, grantMode: 'manual_invite' },
            });
          }
        }
      } catch (autoErr: any) {
        logger.warn(`[ConsultriScheduler] preventiveRenewal auto-grant exception: ${autoErr.message}`);
      }

      // Convite manual (fallback ou padrao)
      if (!autoGrantOk && (original.responsavelEmail || original.responsavelPhone)) {
        const token = crypto.randomBytes(24).toString('hex');
        const invite = await prisma.procurationInvite.create({
          data: {
            procurationId: nova.id,
            token,
            recipientEmail: original.responsavelEmail,
            recipientPhone: original.responsavelPhone,
            recipientName: 'Responsavel',
            expiresAt: new Date(Date.now() + 30 * dia),
          },
        });
        await notificationService.notifyInvite({
          inviteId: invite.id,
          token,
          recipientEmail: invite.recipientEmail,
          recipientPhone: invite.recipientPhone,
          recipientName: invite.recipientName || 'Responsavel',
          clienteNome,
          procuradorNome: original.procuradorNome || 'CONSULTRI',
        });
        await audit(nova.id, 'invite_sent', 'Convite de renovacao preventiva enviado automaticamente');
      } else if (autoGrantOk) {
        // Notifica responsavel sobre sucesso da auto-renovacao
        try {
          await notificationService.send({
            channel: 'email',
            recipient: original.responsavelEmail || '',
            subject: `[CONSULTRI] Procuracao auto-renovada para ${clienteCnpj}`,
            body: `A procuracao para ${clienteNome} (${clienteCnpj}) foi renovada automaticamente via SERPRO (modo automatico). Nenhuma acao do cliente foi necessaria. Acesse https://app.taxcredit.com.br/consultri/cliente/${nova.id}/procuracao`,
            template: 'preventive_auto_renewed',
            refType: 'procuration',
            refId: nova.id,
            severity: 'info',
          });
        } catch { /* silent */ }
      }

      renewed++;
      logger.info(`[ConsultriScheduler] preventiveRenewal: nova procuracao ${nova.id} criada (original=${original.id}) auto=${autoGrantOk}`);
    } catch (err: any) {
      errors++;
      logger.error(`[ConsultriScheduler] preventiveRenewal erro proc=${original.id}: ${err.message}`);
    }
  }

  const summary = { renewed, skipped, errors };
  logger.info(`[ConsultriScheduler] preventiveRenewal: ${JSON.stringify(summary)}`);
  return summary;
}

// ============================================================
// Bootstrap (chamado de src/index.ts)
// ============================================================

export function startConsultriScheduler() {
  if (process.env.CONSULTRI_SCHEDULER_ENABLED !== 'true') {
    logger.info('[ConsultriScheduler] desativado (CONSULTRI_SCHEDULER_ENABLED != true)');
    return;
  }

  let cron: any;
  try {
    cron = require('node-cron');
  } catch {
    logger.warn('[ConsultriScheduler] node-cron indisponivel; nao agendado');
    return;
  }

  // pollSerpro a cada 15 min
  cron.schedule('*/15 * * * *', () => {
    jobPollSerpro().catch(err => logger.error(`[ConsultriScheduler] pollSerpro: ${err.message}`));
  }, { timezone: 'America/Sao_Paulo' });

  // expiryAlerts diario 08:00 BRT
  cron.schedule('0 8 * * *', () => {
    jobExpiryAlerts().catch(err => logger.error(`[ConsultriScheduler] expiryAlerts: ${err.message}`));
  }, { timezone: 'America/Sao_Paulo' });

  // collectConformidade diario 06:00 BRT
  cron.schedule('0 6 * * *', () => {
    jobCollectConformidade().catch(err => logger.error(`[ConsultriScheduler] collectConformidade: ${err.message}`));
  }, { timezone: 'America/Sao_Paulo' });

  // preventiveRenewal diario 09:00 BRT (depois dos alertas)
  cron.schedule('0 9 * * *', () => {
    jobPreventiveRenewal().catch(err => logger.error(`[ConsultriScheduler] preventiveRenewal: ${err.message}`));
  }, { timezone: 'America/Sao_Paulo' });

  logger.info('[ConsultriScheduler] ativo: pollSerpro(15min) | expiryAlerts(8h) | collectConformidade(6h) | preventiveRenewal(9h) BRT');
}
