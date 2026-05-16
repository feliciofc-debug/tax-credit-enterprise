import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// ============================================================
// Notification Service
// ------------------------------------------------------------
// Centraliza envios outbound (email, whatsapp, in-app, webhook).
//
// Persiste TUDO em `Notification` (queued -> sent | failed | skipped),
// permitindo auditoria, reenvio e timeline.
//
// Adapters reais (SMTP, Twilio, gateway WhatsApp) sao plugaveis
// via env. Se nao houver credenciais, o sistema faz "log-only"
// e marca como `sent` para nao bloquear o fluxo.
// ============================================================

export type NotificationChannel = 'email' | 'whatsapp' | 'inapp' | 'webhook';

export interface NotificationInput {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  template?: string;
  refType?: string;
  refId?: string;
  severity?: 'info' | 'warning' | 'critical';
  link?: string;
}

// Heuristica: deduz severity + link a partir do template, se nao informados
function enrichBySeverity(input: NotificationInput): NotificationInput {
  const t = input.template || '';
  let severity = input.severity;
  let link = input.link;

  if (!severity) {
    if (t.includes('revoked') || t.includes('failed') || t.includes('critical')) severity = 'critical';
    else if (t.includes('expiry') || t.includes('caixa_postal') || t.includes('partial') || t.includes('warning')) severity = 'warning';
    else severity = 'info';
  }
  if (!link && input.refType === 'procuration' && input.refId) {
    link = `/consultri/cliente/${input.refId}/procuracao`;
  }
  if (!link && input.refType === 'invite' && input.refId) {
    link = `/consultri/carteira`;
  }
  return { ...input, severity, link };
}

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed' | 'skipped';
  channel: NotificationChannel;
  error?: string;
}

class NotificationService {
  /**
   * Enfileira e envia imediatamente uma notificacao.
   * Em caso de falha do adapter, persiste status=failed (NAO joga throw).
   */
  async send(rawInput: NotificationInput): Promise<NotificationResult> {
    const input = enrichBySeverity(rawInput);
    const created = await prisma.notification.create({
      data: {
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject || null,
        body: input.body,
        template: input.template || null,
        refType: input.refType || null,
        refId: input.refId || null,
        severity: input.severity || null,
        link: input.link || null,
        status: 'queued',
      },
    });

    try {
      let dispatched: { sent: boolean; error?: string };
      switch (input.channel) {
        case 'email':    dispatched = await this.sendEmail(input);    break;
        case 'whatsapp': dispatched = await this.sendWhatsApp(input); break;
        case 'inapp':    dispatched = await this.sendInApp(input);    break;
        case 'webhook':  dispatched = await this.sendWebhook(input);  break;
        default:         dispatched = { sent: false, error: 'channel desconhecido' };
      }

      const status = dispatched.sent ? 'sent' : 'failed';
      await prisma.notification.update({
        where: { id: created.id },
        data: {
          status,
          attempts: { increment: 1 },
          sentAt: dispatched.sent ? new Date() : null,
          lastError: dispatched.error || null,
        },
      });

      return {
        id: created.id,
        status,
        channel: input.channel,
        error: dispatched.error,
      };
    } catch (err: any) {
      logger.error(`[Notification] Falha geral channel=${input.channel}: ${err.message}`);
      await prisma.notification.update({
        where: { id: created.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: err.message,
        },
      });
      return { id: created.id, status: 'failed', channel: input.channel, error: err.message };
    }
  }

  // ============================================================
  // Adapters (log-only se nao houver credencial)
  // ============================================================

  private async sendEmail(input: NotificationInput): Promise<{ sent: boolean; error?: string }> {
    const smtpUrl = process.env.SMTP_URL;
    const from    = process.env.SMTP_FROM || 'no-reply@taxcredit.com.br';

    if (!smtpUrl) {
      logger.info(`[EMAIL log-only -> ${input.recipient}] ${input.subject || '(sem assunto)'}\n${input.body.substring(0, 200)}...`);
      return { sent: true };
    }
    // Adapter real (nodemailer) plugavel — instalar quando configurar.
    // Por ora, sem dependencia para nao expandir o vendor.
    try {
      // require dinamico para nao exigir o pacote em build
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let nm: any;
      try { nm = require('nodemailer'); } catch { nm = null; }
      if (!nm) {
        logger.warn('[EMAIL] nodemailer nao instalado; pulando envio real');
        return { sent: true };
      }
      const transporter = nm.createTransport(smtpUrl);
      await transporter.sendMail({
        from,
        to: input.recipient,
        subject: input.subject || '(sem assunto)',
        text: input.body,
      });
      return { sent: true };
    } catch (e: any) {
      return { sent: false, error: e.message };
    }
  }

  private async sendWhatsApp(input: NotificationInput): Promise<{ sent: boolean; error?: string }> {
    const token  = process.env.WHATSAPP_TOKEN;
    const phone  = process.env.WHATSAPP_PHONE_ID;
    const recipient = input.recipient.replace(/\D/g, '');

    if (!token || !phone) {
      logger.info(`[WHATSAPP log-only -> ${recipient}] ${input.body.substring(0, 200)}`);
      return { sent: true };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phone}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: input.body.substring(0, 4096) },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { sent: false, error: `HTTP ${res.status}: ${t.substring(0, 300)}` };
      }
      return { sent: true };
    } catch (e: any) {
      return { sent: false, error: e.message };
    }
  }

  private async sendInApp(input: NotificationInput): Promise<{ sent: boolean; error?: string }> {
    // Stub: deixar na DB como sent (UI pode polar por recipient=userId)
    logger.info(`[INAPP -> ${input.recipient}] ${input.subject || ''}`);
    return { sent: true };
  }

  private async sendWebhook(input: NotificationInput): Promise<{ sent: boolean; error?: string }> {
    try {
      const res = await fetch(input.recipient, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: input.subject,
          body: input.body,
          template: input.template,
          refType: input.refType,
          refId: input.refId,
        }),
      });
      if (!res.ok) return { sent: false, error: `HTTP ${res.status}` };
      return { sent: true };
    } catch (e: any) {
      return { sent: false, error: e.message };
    }
  }

  // ============================================================
  // Helpers de alto nivel (templates)
  // ============================================================

  async notifyExpiry(args: {
    procurationId: string;
    diasRestantes: number;
    clienteNome: string;
    clienteCnpj: string;
    dataValidade: Date;
    email?: string | null;
    phone?: string | null;
  }): Promise<NotificationResult[]> {
    const { diasRestantes, clienteNome, clienteCnpj, dataValidade, email, phone, procurationId } = args;
    const validade = dataValidade.toLocaleDateString('pt-BR');

    const subject = `[CONSULTRI] Procuracao vence em ${diasRestantes} dias - ${clienteNome}`;
    const body =
`A procuracao eletronica do cliente ${clienteNome} (CNPJ ${clienteCnpj})
vence em ${diasRestantes} dias (${validade}).

Renove agora na plataforma para evitar interrupcao da coleta automatica
de Caixa Postal, DCTFWeb e Situacao Fiscal.

https://app.taxcredit.com.br/consultri/cliente/${args.procurationId}/procuracao
`;

    const results: NotificationResult[] = [];
    if (email) {
      results.push(await this.send({
        channel: 'email', recipient: email, subject, body,
        template: `procuration_expiry_${diasRestantes}d`,
        refType: 'procuration', refId: procurationId,
      }));
    }
    if (phone) {
      results.push(await this.send({
        channel: 'whatsapp', recipient: phone,
        body: `[CONSULTRI] Procuracao de ${clienteNome} vence em ${diasRestantes} dias (${validade}). Renove em https://app.taxcredit.com.br`,
        template: `procuration_expiry_${diasRestantes}d`,
        refType: 'procuration', refId: procurationId,
      }));
    }
    return results;
  }

  async notifyActivation(args: {
    procurationId: string;
    clienteNome: string;
    email?: string | null;
    phone?: string | null;
  }): Promise<NotificationResult[]> {
    const subject = `[CONSULTRI] Procuracao ATIVA - ${args.clienteNome}`;
    const body =
`Boa noticia! A procuracao eletronica de ${args.clienteNome} foi detectada como
ATIVA via SERPRO/Integra Contador.

A partir de agora a plataforma inicia automaticamente a coleta de:
- Caixa Postal e-CAC
- Situacao Fiscal
- DCTFWeb
- PER/DCOMP

Acompanhe em https://app.taxcredit.com.br/consultri/carteira
`;
    const results: NotificationResult[] = [];
    if (args.email) {
      results.push(await this.send({
        channel: 'email', recipient: args.email, subject, body,
        template: 'procuration_activated',
        refType: 'procuration', refId: args.procurationId,
      }));
    }
    if (args.phone) {
      results.push(await this.send({
        channel: 'whatsapp', recipient: args.phone,
        body: `[CONSULTRI] Procuracao de ${args.clienteNome} ATIVADA. Coleta automatica iniciada.`,
        template: 'procuration_activated',
        refType: 'procuration', refId: args.procurationId,
      }));
    }
    return results;
  }

  async notifyInvite(args: {
    inviteId: string;
    token: string;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    recipientName: string;
    clienteNome: string;
    procuradorNome: string;
    baseUrl?: string;
  }): Promise<NotificationResult[]> {
    const base = args.baseUrl || process.env.APP_URL || 'https://app.taxcredit.com.br';
    const link = `${base}/outorga/${args.token}`;
    const subject = `Acao necessaria: Procuracao eletronica para ${args.procuradorNome}`;
    const body =
`Ola ${args.recipientName},

Para que ${args.procuradorNome} possa operar tributariamente em nome de
${args.clienteNome}, e necessario conceder uma procuracao eletronica
no Centro Virtual de Atendimento (e-CAC) da Receita Federal.

Preparamos um passo a passo guiado, com checklist visual e validacao
automatica. Tempo medio: 5-10 minutos.

Acesse: ${link}

Esta procuracao pode ser revogada por voce a qualquer momento no
proprio e-CAC. Tem duvida? Responda este e-mail.
`;
    const results: NotificationResult[] = [];
    if (args.recipientEmail) {
      results.push(await this.send({
        channel: 'email', recipient: args.recipientEmail, subject, body,
        template: 'procuration_invite',
        refType: 'invite', refId: args.inviteId,
      }));
    }
    if (args.recipientPhone) {
      results.push(await this.send({
        channel: 'whatsapp', recipient: args.recipientPhone,
        body: `Ola ${args.recipientName}, preparamos a procuracao eletronica de ${args.clienteNome} para ${args.procuradorNome}. Acesse o passo a passo guiado: ${link}`,
        template: 'procuration_invite',
        refType: 'invite', refId: args.inviteId,
      }));
    }
    return results;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
