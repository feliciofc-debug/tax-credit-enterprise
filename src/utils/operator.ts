import { prisma } from './prisma';
import { logger } from './logger';
import bcrypt from 'bcryptjs';

/**
 * Retorna o partnerId do operador.
 * - Se for parceiro: retorna o partnerId do token
 * - Se for admin: encontra ou cria um "parceiro plataforma" vinculado ao admin
 * 
 * Isso permite que o admin opere diretamente na area de producao
 * (viabilidade, contratos, convites) sem precisar de um parceiro externo.
 */
export async function getOperatorPartnerId(user: any): Promise<string | null> {
  // Se ja tem partnerId (eh parceiro), retorna direto
  if (user.partnerId) {
    return user.partnerId;
  }

  // Se eh admin, encontra ou cria parceiro da plataforma
  if (user.role === 'admin' && user.userId) {
    const platformEmail = `platform-${user.userId}@taxcredit.internal`;
    
    let partner = await prisma.partner.findUnique({
      where: { email: platformEmail },
    });

    if (!partner) {
      // Buscar dados do admin
      const adminUser = await prisma.user.findUnique({ where: { id: user.userId } });
      
      partner = await prisma.partner.create({
        data: {
          email: platformEmail,
          password: await bcrypt.hash('platform-internal', 10),
          name: adminUser?.name || 'Plataforma TaxCredit',
          company: 'TaxCredit Enterprise',
          status: 'active',
          approvedAt: new Date(),
          commissionPercent: 100, // Admin fica com 100% (eh a plataforma)
        },
      });

      logger.info(`Platform partner created for admin ${user.userId}: ${partner.id}`);
    }

    return partner.id;
  }

  return null;
}
