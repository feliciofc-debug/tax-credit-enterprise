import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// ============================================================
// Rotas PUBLICAS (sem authenticateToken) para o link magico
// que o cliente final usa para outorgar a procuracao eletronica.
//
// Seguranca:
//   - Token unico de 48 hex chars (192 bits)
//   - Expiracao (default 14 dias)
//   - Rate limit via middleware antiScraping global
//   - Nao expoe dados sensiveis: so razao social, cnpj parcial e
//     o nome do procurador
// ============================================================

const router = Router();

async function loadInviteByToken(token: string) {
  const inv = await prisma.procurationInvite.findUnique({ where: { token } });
  if (!inv) return null;
  if (inv.status === 'revoked') return null;
  if (inv.expiresAt < new Date()) {
    await prisma.procurationInvite.update({ where: { id: inv.id }, data: { status: 'expired' } });
    return null;
  }
  return inv;
}

function maskCnpj(cnpj?: string | null) {
  if (!cnpj) return '';
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.***/**${d.slice(12)}`;
}

// GET /api/public/outorga/:token — dados para montar landing
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const inv = await loadInviteByToken(req.params.token);
    if (!inv) return res.status(404).json({ success: false, error: 'Convite invalido ou expirado' });

    const proc = await prisma.procuration.findUnique({ where: { id: inv.procurationId } });
    if (!proc) return res.status(404).json({ success: false, error: 'Procuracao nao encontrada' });

    let clienteNome = '';
    let clienteCnpj = '';
    if (proc.clientId.startsWith('analysis_')) {
      const a = await prisma.viabilityAnalysis.findUnique({ where: { id: proc.clientId.replace('analysis_', '') } });
      clienteNome = a?.companyName || 'Cliente';
      clienteCnpj = a?.cnpj || '';
    } else {
      const u = await prisma.user.findUnique({ where: { id: proc.clientId } });
      clienteNome = u?.company || u?.name || 'Cliente';
      clienteCnpj = u?.cnpj || '';
    }

    res.json({
      success: true,
      data: {
        invite: {
          id: inv.id,
          status: inv.status,
          recipientName: inv.recipientName,
          expiresAt: inv.expiresAt,
        },
        procuracao: {
          id: proc.id,
          presetKey: proc.presetKey,
          procuradorCnpj: proc.procuradorCnpj,
          procuradorNome: proc.procuradorNome,
          poderes: proc.poderes,
          dataValidade: proc.dataValidade,
          documentText: proc.documentText,
          serproStatus: proc.serproStatus,
        },
        outorgante: {
          nome: clienteNome,
          cnpj: maskCnpj(clienteCnpj),
        },
      },
    });
  } catch (err: any) {
    logger.error('Erro outorga public GET:', err);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// POST /api/public/outorga/:token/open — telemetria (cliente abriu)
router.post('/:token/open', async (req: Request, res: Response) => {
  try {
    const inv = await loadInviteByToken(req.params.token);
    if (!inv) return res.status(404).json({ success: false });
    if (inv.status === 'pending') {
      await prisma.procurationInvite.update({
        where: { id: inv.id },
        data: { status: 'opened', openedAt: new Date() },
      });
      await prisma.procurationAudit.create({
        data: {
          procurationId: inv.procurationId,
          event: 'invite_opened',
          message: 'Cliente abriu o link magico',
          actorType: 'client_self',
          payload: { ip: req.ip },
        },
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Erro outorga open:', err);
    res.status(500).json({ success: false });
  }
});

// POST /api/public/outorga/:token/ack — cliente diz "fiz, podem verificar"
router.post('/:token/ack', async (req: Request, res: Response) => {
  try {
    const inv = await loadInviteByToken(req.params.token);
    if (!inv) return res.status(404).json({ success: false, error: 'Convite invalido' });
    await prisma.procurationInvite.update({
      where: { id: inv.id },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
    await prisma.procurationAudit.create({
      data: {
        procurationId: inv.procurationId,
        event: 'invite_acknowledged',
        message: 'Cliente confirmou conclusao da outorga via CAV',
        actorType: 'client_self',
        payload: { ip: req.ip, ua: req.get('user-agent') },
      },
    });
    res.json({
      success: true,
      message: 'Recebido! Nossa equipe vai verificar via SERPRO em ate 15 minutos.',
    });
  } catch (err: any) {
    logger.error('Erro outorga ack:', err);
    res.status(500).json({ success: false });
  }
});

export default router;
