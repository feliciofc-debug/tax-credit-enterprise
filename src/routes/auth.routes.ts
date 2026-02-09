import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Login unificado - detecta automaticamente o tipo de usuario (admin, parceiro, cliente)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha sao obrigatorios' });
    }

    // 1. Verificar na tabela User (admin e clientes)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Credenciais invalidas' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' }
      );

      logger.info(`User login: ${email} (role: ${user.role})`);

      return res.json({
        success: true,
        data: {
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        },
      });
    }

    // 2. Verificar na tabela Partner
    const partner = await prisma.partner.findUnique({ where: { email } });
    if (partner) {
      const validPassword = await bcrypt.compare(password, partner.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Credenciais invalidas' });
      }

      if (partner.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Conta aguardando aprovacao' });
      }

      const token = jwt.sign(
        { partnerId: partner.id, email: partner.email, role: 'partner' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' }
      );

      logger.info(`Partner login: ${email}`);

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: partner.id,
            email: partner.email,
            name: partner.name,
            role: 'partner',
            company: partner.company,
          },
        },
      });
    }

    // 3. Nenhum usuario encontrado
    return res.status(401).json({ success: false, error: 'Credenciais invalidas' });

  } catch (error: any) {
    logger.error('Error in unified login:', error);
    return res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

export default router;
