import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/invite/create
 * Parceiro gera convite para cliente
 */
router.post('/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = (req as any).user.partnerId;
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros' });
    }

    const { clientEmail, clientName, companyName, cnpj, viabilityAnalysisId } = req.body;

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
    }

    // Gerar codigo unico: TC-XXXXXX
    const inviteCode = 'TC-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Validade de 30 dias
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invite = await prisma.clientInvite.create({
      data: {
        partnerId,
        inviteCode,
        clientEmail,
        clientName,
        companyName,
        cnpj,
        viabilityAnalysisId,
        expiresAt,
        status: 'active',
      },
    });

    logger.info(`Invite created: ${invite.inviteCode} by partner ${partnerId}`);

    return res.status(201).json({
      success: true,
      data: {
        inviteCode: invite.inviteCode,
        companyName: invite.companyName,
        expiresAt: invite.expiresAt,
        // Link que o parceiro envia pro cliente
        inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/cadastro?code=${invite.inviteCode}`,
      },
    });
  } catch (error: any) {
    logger.error('Error creating invite:', error);
    return res.status(500).json({ success: false, error: 'Erro ao criar convite' });
  }
});

/**
 * GET /api/invite/list
 * Lista convites do parceiro
 */
router.get('/list', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = (req as any).user.partnerId;
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito' });
    }

    const invites = await prisma.clientInvite.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: invites });
  } catch (error: any) {
    logger.error('Error listing invites:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar convites' });
  }
});

/**
 * GET /api/invite/validate/:code
 * Valida um codigo de convite (publico - usado pelo cliente no cadastro)
 */
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const invite = await prisma.clientInvite.findUnique({
      where: { inviteCode: code },
      include: {
        partner: {
          select: { name: true, company: true, oabNumber: true, oabState: true },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Codigo invalido' });
    }

    if (invite.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Convite ja utilizado ou expirado' });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ success: false, error: 'Convite expirado' });
    }

    return res.json({
      success: true,
      data: {
        companyName: invite.companyName,
        cnpj: invite.cnpj,
        partnerName: invite.partner.name,
        partnerCompany: invite.partner.company,
        partnerOab: invite.partner.oabNumber ? `OAB/${invite.partner.oabState} ${invite.partner.oabNumber}` : null,
      },
    });
  } catch (error: any) {
    logger.error('Error validating invite:', error);
    return res.status(500).json({ success: false, error: 'Erro ao validar convite' });
  }
});

/**
 * DELETE /api/invite/:id
 * Revogar convite
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = (req as any).user.partnerId;
    const { id } = req.params;

    const invite = await prisma.clientInvite.findFirst({ where: { id, partnerId } });
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Convite nao encontrado' });
    }

    await prisma.clientInvite.update({
      where: { id },
      data: { status: 'revoked' },
    });

    return res.json({ success: true, message: 'Convite revogado' });
  } catch (error: any) {
    logger.error('Error revoking invite:', error);
    return res.status(500).json({ success: false, error: 'Erro ao revogar convite' });
  }
});

export default router;
