import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/partner/register
 * Cadastro de novo parceiro (advogado tributarista)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, oabNumber, oabState, company, cnpj, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, senha e nome sao obrigatorios' });
    }

    // Verificar se ja existe
    const existing = await prisma.partner.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email ja cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const partner = await prisma.partner.create({
      data: {
        email,
        password: hashedPassword,
        name,
        oabNumber,
        oabState,
        company,
        cnpj,
        phone,
        status: 'active', // auto-aprovado por enquanto
        approvedAt: new Date(),
      },
    });

    const token = jwt.sign(
      { partnerId: partner.id, email: partner.email, role: 'partner' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    logger.info(`New partner registered: ${partner.id} - ${partner.name}`);

    return res.status(201).json({
      success: true,
      data: {
        partnerId: partner.id,
        name: partner.name,
        email: partner.email,
        token,
      },
    });
  } catch (error: any) {
    logger.error('Error registering partner:', error);
    return res.status(500).json({ success: false, error: 'Erro ao cadastrar parceiro' });
  }
});

/**
 * POST /api/partner/login
 * Login do parceiro
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const partner = await prisma.partner.findUnique({ where: { email } });
    if (!partner) {
      return res.status(401).json({ success: false, error: 'Credenciais invalidas' });
    }

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
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      data: {
        partnerId: partner.id,
        name: partner.name,
        email: partner.email,
        company: partner.company,
        token,
      },
    });
  } catch (error: any) {
    logger.error('Error logging in partner:', error);
    return res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

/**
 * GET /api/partner/dashboard
 * Dashboard stats do parceiro
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = (req as any).user.partnerId;
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros' });
    }

    const [
      totalViabilities,
      completedViabilities,
      highScoreViabilities,
      totalInvites,
      usedInvites,
      activeContracts,
      totalRecovered,
      recentViabilities,
    ] = await Promise.all([
      prisma.viabilityAnalysis.count({ where: { partnerId } }),
      prisma.viabilityAnalysis.count({ where: { partnerId, status: 'completed' } }),
      prisma.viabilityAnalysis.count({ where: { partnerId, viabilityScore: { gte: 70 } } }),
      prisma.clientInvite.count({ where: { partnerId } }),
      prisma.clientInvite.count({ where: { partnerId, status: 'used' } }),
      prisma.contract.count({ where: { partnerId, status: 'active' } }),
      prisma.contract.aggregate({ where: { partnerId }, _sum: { partnerEarnings: true } }),
      prisma.viabilityAnalysis.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        overview: {
          totalViabilities,
          completedViabilities,
          highScoreViabilities,
          conversionRate: completedViabilities > 0
            ? Math.round((highScoreViabilities / completedViabilities) * 100)
            : 0,
          totalInvites,
          usedInvites,
          activeContracts,
          totalEarnings: totalRecovered._sum.partnerEarnings || 0,
        },
        recentViabilities,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner dashboard:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar dados' });
  }
});

/**
 * GET /api/partner/profile
 * Perfil do parceiro
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = (req as any).user.partnerId;
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito' });
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true, email: true, name: true, oabNumber: true, oabState: true,
        company: true, cnpj: true, phone: true, commissionPercent: true,
        status: true, createdAt: true,
      },
    });

    return res.json({ success: true, data: partner });
  } catch (error: any) {
    logger.error('Error fetching partner profile:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar perfil' });
  }
});

export default router;
