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
 * Dashboard do admin - visao geral completa
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const [
      totalUsers,
      totalClients,
      totalPartners,
      activePartners,
      pendingPartners,
      totalContracts,
      activeContracts,
      paidContracts,
      totalInvites,
      usedInvites,
      activeInvites,
      totalViabilities,
      contractsAgg,
      recentViabilities,
      recentContracts,
      recentPartners,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'client' } }),
      prisma.partner.count(),
      prisma.partner.count({ where: { status: 'active' } }),
      prisma.partner.count({ where: { status: 'pending' } }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'active' } }),
      prisma.contract.count({ where: { setupFeePaid: true } }),
      prisma.clientInvite.count(),
      prisma.clientInvite.count({ where: { status: 'used' } }),
      prisma.clientInvite.count({ where: { status: 'active' } }),
      prisma.viabilityAnalysis.count(),
      prisma.contract.aggregate({ _sum: { totalRecovered: true, partnerEarnings: true, platformEarnings: true } }),
      prisma.viabilityAnalysis.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { partner: { select: { name: true, company: true } } },
      }),
      prisma.contract.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          partner: { select: { name: true, company: true } },
          client: { select: { name: true, company: true, email: true } },
        },
      }),
      prisma.partner.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          status: true,
          commissionPercent: true,
          createdAt: true,
          _count: { select: { contracts: true, viabilityAnalyses: true, invites: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        users: { total: totalUsers, clients: totalClients },
        partners: { total: totalPartners, active: activePartners, pending: pendingPartners },
        contracts: {
          total: totalContracts,
          active: activeContracts,
          paid: paidContracts,
          totalRecovered: contractsAgg._sum.totalRecovered || 0,
          partnerEarnings: contractsAgg._sum.partnerEarnings || 0,
          platformEarnings: contractsAgg._sum.platformEarnings || 0,
        },
        invites: { total: totalInvites, used: usedInvites, active: activeInvites },
        viabilities: { total: totalViabilities },
        recentViabilities,
        recentContracts,
        recentPartners,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching admin dashboard:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar dados' });
  }
});

/**
 * GET /api/admin/partners
 * Lista de parceiros com detalhes
 */
router.get('/partners', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const partners = await prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        phone: true,
        oabNumber: true,
        oabState: true,
        status: true,
        commissionPercent: true,
        createdAt: true,
        approvedAt: true,
        _count: { select: { contracts: true, viabilityAnalyses: true, invites: true } },
      },
    });

    return res.json({ success: true, data: partners });
  } catch (error: any) {
    logger.error('Error fetching partners:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar parceiros' });
  }
});

/**
 * PUT /api/admin/partners/:id/approve
 * Aprovar parceiro
 */
router.put('/partners/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const partner = await prisma.partner.update({
      where: { id: req.params.id },
      data: { status: 'active', approvedAt: new Date() },
    });

    logger.info(`Partner approved: ${partner.email} by admin ${user.userId}`);
    return res.json({ success: true, data: partner });
  } catch (error: any) {
    logger.error('Error approving partner:', error);
    return res.status(500).json({ success: false, error: 'Erro ao aprovar parceiro' });
  }
});

/**
 * PUT /api/admin/partners/:id/reject
 * Rejeitar parceiro
 */
router.put('/partners/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const partner = await prisma.partner.update({
      where: { id: req.params.id },
      data: { status: 'rejected' },
    });

    logger.info(`Partner rejected: ${partner.email} by admin ${user.userId}`);
    return res.json({ success: true, data: partner });
  } catch (error: any) {
    logger.error('Error rejecting partner:', error);
    return res.status(500).json({ success: false, error: 'Erro ao rejeitar parceiro' });
  }
});

/**
 * GET /api/admin/clients
 * Lista de clientes
 */
router.get('/clients', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const clients = await prisma.user.findMany({
      where: { role: 'client' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        cnpj: true,
        onboardingComplete: true,
        createdAt: true,
        _count: { select: { documents: true, contracts: true } },
      },
    });

    return res.json({ success: true, data: clients });
  } catch (error: any) {
    logger.error('Error fetching clients:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
  }
});

export default router;
