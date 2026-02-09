import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/admin/register
 * Criar conta de admin (requer ADMIN_AUTH_PASSWORD)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, adminPassword } = req.body;

    if (!email || !password || !name || !adminPassword) {
      return res.status(400).json({ success: false, error: 'Email, senha, nome e senha de admin sao obrigatorios' });
    }

    // Verificar senha master
    const adminSecret = process.env.ADMIN_AUTH_PASSWORD || 'taxcredit@admin2026';
    if (adminPassword !== adminSecret) {
      return res.status(403).json({ success: false, error: 'Senha de administrador invalida' });
    }

    // Verificar se email ja existe
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email ja cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'admin',
        onboardingComplete: true,
      },
    });

    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    logger.info(`Admin registered: ${email}`);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      },
    });
  } catch (error: any) {
    logger.error('Error registering admin:', error);
    return res.status(500).json({ success: false, error: 'Erro ao registrar admin' });
  }
});

/**
 * POST /api/admin/login
 * Login de admin
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Credenciais invalidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Credenciais invalidas' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'admin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (error: any) {
    logger.error('Error logging in admin:', error);
    return res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

/**
 * GET /api/admin/dashboard
 * Dashboard do admin - visao geral de tudo
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const [
      totalUsers,
      totalPartners,
      activePartners,
      totalContracts,
      activeContracts,
      totalInvites,
      usedInvites,
      totalViabilities,
      contracts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.partner.count(),
      prisma.partner.count({ where: { status: 'active' } }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'active' } }),
      prisma.clientInvite.count(),
      prisma.clientInvite.count({ where: { status: 'used' } }),
      prisma.viabilityAnalysis.count(),
      prisma.contract.aggregate({ _sum: { totalRecovered: true, partnerEarnings: true, platformEarnings: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        users: { total: totalUsers },
        partners: { total: totalPartners, active: activePartners },
        contracts: {
          total: totalContracts,
          active: activeContracts,
          totalRecovered: contracts._sum.totalRecovered || 0,
          partnerEarnings: contracts._sum.partnerEarnings || 0,
          platformEarnings: contracts._sum.platformEarnings || 0,
        },
        invites: { total: totalInvites, used: usedInvites },
        viabilities: { total: totalViabilities },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching admin dashboard:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar dados' });
  }
});

export default router;
