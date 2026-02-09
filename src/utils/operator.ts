import { prisma } from './prisma';
import { logger } from './logger';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Retorna o partnerId do operador.
 * - Se for parceiro: retorna o partnerId do token
 * - Se for admin: encontra ou cria um "parceiro plataforma" vinculado ao admin
 * 
 * Isso permite que o admin opere diretamente na area de producao
 * (viabilidade, contratos, convites) sem precisar de um parceiro externo.
 * 
 * Usa upsert para evitar race conditions em requests simultaneos.
 */
export async function getOperatorPartnerId(user: any): Promise<string | null> {
  // Se ja tem partnerId (eh parceiro), retorna direto
  if (user.partnerId) {
    return user.partnerId;
  }

  // Se eh admin, encontra ou cria parceiro da plataforma (atomico com upsert)
  if (user.role === 'admin' && user.userId) {
    const platformEmail = `platform-${user.userId}@taxcredit.internal`;
    
    // Buscar dados do admin para nome
    const adminUser = await prisma.user.findUnique({ where: { id: user.userId } });

    // Gerar senha aleatoria forte (nunca usada para login, apenas para satisfazer o schema)
    const internalPassword = process.env.PLATFORM_PARTNER_SECRET || crypto.randomBytes(32).toString('hex');
    
    const partner = await prisma.partner.upsert({
      where: { email: platformEmail },
      update: {}, // Se ja existe, nao altera nada
      create: {
        email: platformEmail,
        password: await bcrypt.hash(internalPassword, 10),
        name: adminUser?.name || 'Plataforma TaxCredit',
        company: 'TaxCredit Enterprise',
        status: 'active',
        approvedAt: new Date(),
        commissionPercent: 100, // Admin fica com 100% (eh a plataforma)
      },
    });

    logger.info(`Platform partner resolved for admin ${user.userId}: ${partner.id}`);
    return partner.id;
  }

  return null;
}
