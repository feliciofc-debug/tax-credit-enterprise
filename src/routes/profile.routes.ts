import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/profile
 * Retorna dados do perfil do usuario logado (cliente ou admin)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.partnerId) {
      // Parceiro
      const partner = await prisma.partner.findUnique({ where: { id: user.partnerId } });
      if (!partner) return res.status(404).json({ success: false, error: 'Parceiro nao encontrado' });
      
      const { password, ...data } = partner;
      return res.json({ success: true, data, type: 'partner' });
    }
    
    if (user.userId) {
      // Usuario (admin ou cliente)
      const u = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!u) return res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
      
      const { password, ...data } = u;
      return res.json({ success: true, data, type: u.role });
    }

    return res.status(403).json({ success: false, error: 'Acesso restrito' });
  } catch (error: any) {
    logger.error('Error fetching profile:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar perfil' });
  }
});

/**
 * PUT /api/profile
 * Atualiza dados do perfil (dados bancarios, endereco, representante legal)
 */
router.put('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updates = req.body;

    // Campos permitidos para atualizacao - Cliente/Admin
    const allowedUserFields = [
      'name', 'company', 'cnpj', 'regime',
      'endereco', 'cidade', 'estado', 'cep',
      'legalRepName', 'legalRepCpf', 'legalRepRg', 'legalRepCargo', 'legalRepEmail', 'legalRepPhone',
      'bankName', 'bankAgency', 'bankAccount', 'bankAccountType', 'bankPixKey', 'bankAccountHolder', 'bankCpfCnpj',
    ];

    // Campos permitidos para parceiro
    const allowedPartnerFields = [
      'name', 'company', 'cnpj', 'phone', 'oabNumber', 'oabState',
      'endereco', 'cidade', 'estado', 'cep',
      'bankName', 'bankAgency', 'bankAccount', 'bankAccountType', 'bankPixKey', 'bankAccountHolder', 'bankCpfCnpj',
    ];

    if (user.partnerId) {
      const filtered: any = {};
      for (const key of allowedPartnerFields) {
        if (updates[key] !== undefined) filtered[key] = updates[key];
      }

      const partner = await prisma.partner.update({
        where: { id: user.partnerId },
        data: filtered,
      });

      const { password, ...data } = partner;
      logger.info(`Partner profile updated: ${user.partnerId}`);
      return res.json({ success: true, data });
    }

    if (user.userId) {
      const filtered: any = {};
      for (const key of allowedUserFields) {
        if (updates[key] !== undefined) filtered[key] = updates[key];
      }

      // Verificar se dados essenciais foram preenchidos para marcar onboarding completo
      const currentUser = await prisma.user.findUnique({ where: { id: user.userId } });
      const merged = { ...currentUser, ...filtered };
      if (merged.company && merged.cnpj && merged.legalRepName && merged.legalRepCpf && merged.bankName && merged.bankAccount) {
        filtered.onboardingComplete = true;
      }

      const updated = await prisma.user.update({
        where: { id: user.userId },
        data: filtered,
      });

      const { password, ...data } = updated;
      logger.info(`User profile updated: ${user.userId}`);
      return res.json({ success: true, data });
    }

    return res.status(403).json({ success: false, error: 'Acesso restrito' });
  } catch (error: any) {
    logger.error('Error updating profile:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar perfil' });
  }
});

export default router;
