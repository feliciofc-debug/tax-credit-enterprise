import { logger } from '../utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'TaxCredit Enterprise <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://tax-credit-enterprise-92lv.vercel.app';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.warn(`Email not sent (no RESEND_API_KEY): ${subject} -> ${to}`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Email send failed: ${error}`);
      return false;
    }

    logger.info(`Email sent: ${subject} -> ${to}`);
    return true;
  } catch (error) {
    logger.error('Email send error:', error);
    return false;
  }
}

// ============================================
// TEMPLATES DE EMAIL
// ============================================

export async function sendWelcomeEmail(to: string, name: string, partnerName?: string): Promise<boolean> {
  const subject = 'Bem-vindo ao TaxCredit Enterprise!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f766e, #1e40af); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">TaxCredit Enterprise</h1>
        <p style="color: #d1fae5; margin: 8px 0 0;">Recuperacao de Creditos Tributarios com IA</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">Ola, ${name}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Seja bem-vindo(a) ao <strong>TaxCredit Enterprise</strong>! Sua conta foi criada com sucesso.
        </p>
        ${partnerName ? `<p style="color: #4b5563; line-height: 1.6;">Voce foi convidado(a) pelo escritorio <strong>${partnerName}</strong>.</p>` : ''}
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-weight: bold;">Proximos passos:</p>
          <ol style="color: #166534; margin: 8px 0 0; padding-left: 20px;">
            <li>Efetue o pagamento da taxa de adesao (R$ 2.000,00)</li>
            <li>Consulta completa com IA sera liberada</li>
            <li>Envie seus documentos (DREs, Balancos, Balancetes)</li>
            <li>Receba a analise automatica e formalize seus creditos</li>
          </ol>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${FRONTEND_URL}/login" style="display: inline-block; background: #0f766e; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Acessar Minha Conta
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Se voce nao criou esta conta, ignore este email.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
        TaxCredit Enterprise - Recuperacao de Creditos Tributarios com Inteligencia Artificial
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendInviteEmail(
  to: string,
  clientName: string,
  partnerName: string,
  companyName: string,
  inviteCode: string,
): Promise<boolean> {
  const inviteUrl = `${FRONTEND_URL}/cadastro?code=${inviteCode}`;
  const subject = `Convite: Recupere Creditos Tributarios - ${companyName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0f766e, #1e40af); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">TaxCredit Enterprise</h1>
        <p style="color: #d1fae5; margin: 8px 0 0;">Voce foi convidado!</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">Ola${clientName ? ', ' + clientName : ''}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          O escritorio <strong>${partnerName}</strong> identificou oportunidades de recuperacao de creditos tributarios para a empresa <strong>${companyName}</strong>.
        </p>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0; font-weight: bold;">O que voce ganha:</p>
          <ul style="color: #1e40af; margin: 8px 0 0; padding-left: 20px;">
            <li>Analise completa com Inteligencia Artificial</li>
            <li>Identificacao de creditos de IRPJ, CSLL, PIS, COFINS, ICMS e ISS</li>
            <li>Formalizacao integral do processo tributario</li>
            <li>Acompanhamento juridico pelo escritorio parceiro</li>
          </ul>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <p style="color: #6b7280; margin: 0 0 8px; font-size: 14px;">Seu codigo de convite:</p>
          <p style="color: #111827; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">${inviteCode}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: #0f766e; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Criar Minha Conta
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Este convite foi gerado pelo escritorio ${partnerName}. Se voce nao reconhece este convite, ignore este email.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
        TaxCredit Enterprise - Recuperacao de Creditos Tributarios com Inteligencia Artificial
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendPaymentConfirmationEmail(to: string, name: string): Promise<boolean> {
  const subject = 'Pagamento Confirmado - TaxCredit Enterprise';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669, #0f766e); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Pagamento Confirmado!</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">Ola, ${name}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Seu pagamento da taxa de adesao de <strong>R$ 2.000,00</strong> foi confirmado com sucesso!
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-weight: bold;">Agora voce tem acesso a:</p>
          <ul style="color: #166534; margin: 8px 0 0; padding-left: 20px;">
            <li>Consulta completa com Inteligencia Artificial</li>
            <li>Formalizacao integral do processo tributario</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background: #059669; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Acessar Dashboard
          </a>
        </div>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

export const emailService = {
  sendWelcomeEmail,
  sendInviteEmail,
  sendPaymentConfirmationEmail,
};
