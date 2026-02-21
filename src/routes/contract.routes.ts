import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { sendPaymentConfirmationEmail } from '../services/email.service';
import { getOperatorPartnerId } from '../utils/operator';
import {
  generateBipartiteContract,
  generateTripartiteContract,
  type BipartiteContractParams,
} from '../services/formalization.service';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/contract/create
 * Cria contrato bipartite ou tripartite
 * 
 * contractType: 'bipartite' (TaxCredit + Cliente) ou 'tripartite' (TaxCredit + Cliente + Parceiro)
 * Percentuais devem somar 100%. Cliente sempre fica com a maior parte.
 */
router.post('/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      clientId, contractType = 'tripartite',
      clientSplitPercent, partnerSplitPercent, platformSplitPercent,
      setupFee, adminPassword,
      ieCliente, lawyerName, lawyerOab,
      escrowAgencia, escrowConta, estimatedCredits,
      // Dados do parceiro para tripartite
      partnerId: requestPartnerId,
      parceiroNome, parceiroCnpjCpf, parceiroTipoPessoa, parceiroOab,
      parceiroEndereco, parceiroCidade, parceiroUf,
      parceiroBanco, parceiroAgencia, parceiroConta, parceiroTitular, parceiroDocBanco,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId e obrigatorio' });
    }

    const isTripartite = contractType === 'tripartite';

    // Determine percentages
    const pctCliente = clientSplitPercent || 80;
    const pctParceiro = isTripartite ? (partnerSplitPercent || 8) : 0;
    const pctPlataforma = platformSplitPercent || (100 - pctCliente - pctParceiro);

    if (pctCliente + pctPlataforma + pctParceiro !== 100) {
      return res.status(400).json({ success: false, error: 'Percentuais devem somar 100%' });
    }
    if (pctCliente < 50 || pctCliente > 90) {
      return res.status(400).json({ success: false, error: 'Percentual do cliente deve ser entre 50% e 90%' });
    }

    // Determine partnerId
    let partnerId: string | null = null;
    if (isTripartite) {
      partnerId = requestPartnerId || await getOperatorPartnerId(user);
      if (!partnerId) {
        return res.status(400).json({ success: false, error: 'partnerId obrigatorio para contrato tripartite' });
      }
    }

    // Non-default percentages require admin password
    const defaultPctChanged = isTripartite
      ? (pctCliente !== 80 || pctParceiro !== 8 || pctPlataforma !== 12)
      : (pctCliente !== 80 || pctPlataforma !== 20);

    if (defaultPctChanged) {
      const adminSecret = process.env.ADMIN_AUTH_PASSWORD || 'taxcredit@admin2026';
      if (!adminPassword || adminPassword !== adminSecret) {
        return res.status(403).json({
          success: false,
          error: 'Alterar percentuais padrao requer autorizacao do administrador',
          requiresAdminAuth: true,
        });
      }
      logger.info(`Admin authorized custom split: client=${pctCliente}% platform=${pctPlataforma}% partner=${pctParceiro}%`);
    }

    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
    }

    const contractNumber = `TC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const taxaAdesao = setupFee || 2000;

    // Build base contract params
    const baseParams: BipartiteContractParams = {
      empresaClienteNome: client.company || client.name || '',
      cnpjCliente: client.cnpj || '',
      ieCliente: ieCliente || '',
      enderecoCliente: client.endereco || '',
      cepCliente: '',
      cidadeCliente: client.cidade || '',
      ufCliente: client.estado || '',
      representanteCliente: client.legalRepName || client.name || '',
      cargoRepresentanteCliente: client.legalRepCargo || '',
      cpfRepresentanteCliente: client.legalRepCpf || '',
      percentualCliente: pctCliente,
      percentualPlataforma: pctPlataforma,
      taxaAdesao,
      valorEstimado: estimatedCredits || 0,
      advogadoNome: lawyerName || '',
      advogadoOab: lawyerOab || '',
      escrowAgencia: escrowAgencia || '',
      escrowConta: escrowConta || '',
      dataContrato: new Date().toLocaleDateString('pt-BR'),
    };

    let contractText: string;
    let partner: any = null;

    if (isTripartite && partnerId) {
      partner = await prisma.partner.findUnique({ where: { id: partnerId } });
      contractText = generateTripartiteContract({
        ...baseParams,
        percentualParceiro: pctParceiro,
        parceiroNome: parceiroNome || partner?.company || partner?.name || '',
        parceiroCnpjCpf: parceiroCnpjCpf || partner?.cnpj || '',
        parceiroTipoPessoa: parceiroTipoPessoa || 'juridica',
        parceiroOab: parceiroOab || (partner?.oabNumber ? `${partner.oabState || ''} ${partner.oabNumber}` : ''),
        parceiroEndereco: parceiroEndereco || partner?.endereco || '',
        parceiroCidade: parceiroCidade || partner?.cidade || '',
        parceiroUf: parceiroUf || partner?.estado || '',
        parceiroBanco: parceiroBanco || partner?.bankName || '',
        parceiroAgencia: parceiroAgencia || partner?.bankAgency || '',
        parceiroConta: parceiroConta || partner?.bankAccount || '',
        parceiroTitular: parceiroTitular || partner?.company || partner?.name || '',
        parceiroDocBanco: parceiroDocBanco || partner?.cnpj || '',
      });
    } else {
      contractText = generateBipartiteContract(baseParams);
    }

    const contract = await prisma.contract.create({
      data: {
        contractType: isTripartite ? 'tripartite' : 'bipartite',
        partnerId: partnerId || undefined,
        clientId,
        setupFee: taxaAdesao,
        setupFeePartner: 0,
        setupFeePlatform: taxaAdesao,
        clientSplitPercent: pctCliente,
        platformSplitPercent: pctPlataforma,
        partnerSplitPercent: pctParceiro,
        contractNumber,
        contractText,
        lawyerName: lawyerName || undefined,
        lawyerOab: lawyerOab || undefined,
        escrowAgencia: escrowAgencia || undefined,
        escrowConta: escrowConta || undefined,
        estimatedCredits: estimatedCredits || undefined,
        status: 'draft',
        consultaLiberada: false,
        formalizacaoLiberada: false,
      },
    });

    logger.info(`Contract created: ${contractNumber} (${contractType})`);

    return res.status(201).json({
      success: true,
      data: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        setupFee: contract.setupFee,
        status: contract.status,
        clientSplitPercent: contract.clientSplitPercent,
        partnerSplitPercent: contract.partnerSplitPercent,
        platformSplitPercent: contract.platformSplitPercent,
      },
    });
  } catch (error: any) {
    logger.error('Error creating contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao criar contrato' });
  }
});

/**
 * POST /api/contract/:id/sign
 * Assinar contrato (parceiro ou cliente)
 */
router.post('/:id/sign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    const updateData: any = {};

    const isBipartite = (contract as any).contractType === 'bipartite';

    const operatorPartnerId = user.partnerId || (user.role === 'admin' ? await getOperatorPartnerId(user) : null);
    
    if (user.role === 'admin') {
      // Admin assina como TaxCredit (representante da plataforma)
      updateData.partnerSignedAt = new Date();
      updateData.partnerSignatureIp = String(ip);
    } else if (operatorPartnerId && operatorPartnerId === contract.partnerId) {
      updateData.partnerSignedAt = new Date();
      updateData.partnerSignatureIp = String(ip);
    } else if (user.userId && user.userId === contract.clientId) {
      updateData.clientSignedAt = new Date();
      updateData.clientSignatureIp = String(ip);
    } else {
      return res.status(403).json({ success: false, error: 'Voce nao e parte deste contrato' });
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: updateData,
    });

    // Bipartite: ativo quando admin (TaxCredit) + cliente assinaram
    // Tripartite: ativo quando parceiro + cliente assinaram
    const fullySignedBipartite = isBipartite && updated.partnerSignedAt && updated.clientSignedAt;
    const fullySignedTripartite = !isBipartite && updated.partnerSignedAt && updated.clientSignedAt;

    if (fullySignedBipartite || fullySignedTripartite) {
      await prisma.contract.update({
        where: { id },
        data: { status: 'active' },
      });
    } else {
      await prisma.contract.update({
        where: { id },
        data: { status: 'pending_signatures' },
      });
    }

    logger.info(`Contract ${contract.contractNumber} signed by ${user.partnerId ? 'partner' : 'client'}`);

    return res.json({ success: true, message: 'Contrato assinado com sucesso' });
  } catch (error: any) {
    logger.error('Error signing contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao assinar contrato' });
  }
});

/**
 * POST /api/contract/:id/claim-payment
 * Cliente informa que realizou o pagamento PIX
 * Atualiza status para 'payment_claimed' para o admin confirmar
 */
router.post('/:id/claim-payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    // Verificar se e o cliente deste contrato ou admin
    if (user.userId !== contract.clientId && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito' });
    }

    if (contract.setupFeePaid) {
      return res.status(400).json({ success: false, error: 'Taxa ja foi confirmada' });
    }

    await prisma.contract.update({
      where: { id },
      data: { status: 'payment_claimed' },
    });

    logger.info(`Client claimed payment for contract ${contract.contractNumber}`);

    return res.json({
      success: true,
      message: 'Pagamento informado! O administrador vai confirmar em breve.',
    });
  } catch (error: any) {
    logger.error('Error claiming payment:', error);
    return res.status(500).json({ success: false, error: 'Erro ao informar pagamento' });
  }
});

/**
 * POST /api/contract/:id/confirm-payment
 * Admin confirma pagamento da taxa com senha master
 * Libera consulta + formalizacao
 */
router.post('/:id/confirm-payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { adminPassword } = req.body;

    // Somente admin pode confirmar pagamento
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Somente administradores podem confirmar pagamentos' });
    }

    // Validar senha master
    const adminSecret = process.env.ADMIN_AUTH_PASSWORD || 'taxcredit@admin2026';
    if (!adminPassword || adminPassword !== adminSecret) {
      return res.status(403).json({ success: false, error: 'Senha master invalida' });
    }

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    if (contract.setupFeePaid) {
      return res.status(400).json({ success: false, error: 'Taxa ja foi paga' });
    }

    await prisma.contract.update({
      where: { id },
      data: {
        setupFeePaid: true,
        setupFeePaidAt: new Date(),
        consultaLiberada: true,
        formalizacaoLiberada: true,
        status: contract.partnerSignedAt && contract.clientSignedAt ? 'active' : 'pending_signatures',
      },
    });

    logger.info(`Payment CONFIRMED by admin for contract ${contract.contractNumber}. Consultation and formalization unlocked.`);
    logger.info(`Fee split: R$ ${contract.setupFeePartner} partner / R$ ${contract.setupFeePlatform} platform`);

    // Enviar email de confirmacao ao cliente
    const client = await prisma.user.findUnique({ where: { id: contract.clientId } });
    if (client?.email) {
      await sendPaymentConfirmationEmail(client.email, client.name || 'Cliente');
    }

    return res.json({
      success: true,
      message: 'Pagamento confirmado. Consulta completa e formalizacao liberadas.',
      data: {
        setupFee: contract.setupFee,
        partnerReceives: contract.setupFeePartner,
        platformReceives: contract.setupFeePlatform,
        consultaLiberada: true,
        formalizacaoLiberada: true,
      },
    });
  } catch (error: any) {
    logger.error('Error confirming payment:', error);
    return res.status(500).json({ success: false, error: 'Erro ao confirmar pagamento' });
  }
});

/**
 * GET /api/contract/payment-info
 * Retorna dados PIX da plataforma para o cliente pagar
 */
router.get('/payment-info', authenticateToken, async (_req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      data: {
        bankName: process.env.PLATFORM_PIX_BANK || 'C6 Bank',
        pixKey: process.env.PLATFORM_PIX_KEY || '[Chave PIX a configurar]',
        pixKeyType: process.env.PLATFORM_PIX_KEY_TYPE || 'CNPJ',
        accountHolder: process.env.PLATFORM_ACCOUNT_HOLDER || 'ATOM BRASIL DIGITAL LTDA',
        setupFee: 2000,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar dados de pagamento' });
  }
});

/**
 * GET /api/contract/my-pending
 * Retorna contrato pendente de pagamento do cliente logado
 */
router.get('/my-pending', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user.userId) {
      return res.json({ success: true, data: null });
    }

    const contract = await prisma.contract.findFirst({
      where: {
        clientId: user.userId,
        setupFeePaid: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { name: true, company: true } },
      },
    });

    if (!contract) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        contractType: (contract as any).contractType || 'tripartite',
        setupFee: contract.setupFee,
        status: contract.status,
        partnerSigned: !!contract.partnerSignedAt,
        clientSigned: !!contract.clientSignedAt,
        partnerName: contract.partner?.company || contract.partner?.name || null,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching pending contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar contrato' });
  }
});

/**
 * GET /api/contract/list
 * Lista contratos (parceiro ou cliente)
 */
router.get('/list', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const where: any = {};

    if (user.role === 'admin') {
      // Admin ve todos os contratos
    } else if (user.partnerId) {
      where.partnerId = user.partnerId;
    } else if (user.userId) {
      where.clientId = user.userId;
    } else {
      return res.status(403).json({ success: false, error: 'Acesso restrito' });
    }

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { name: true, company: true } },
        client: { select: { name: true, company: true, email: true } },
      },
    });

    return res.json({
      success: true,
      data: contracts.map(c => ({
        id: c.id,
        contractNumber: c.contractNumber,
        contractType: (c as any).contractType || 'tripartite',
        partnerName: c.partner?.name || null,
        partnerCompany: c.partner?.company || null,
        clientName: c.client.name || c.client.email,
        clientCompany: c.client.company,
        setupFee: c.setupFee,
        setupFeePaid: c.setupFeePaid,
        clientSplitPercent: (c as any).clientSplitPercent || 0,
        partnerSplitPercent: c.partnerSplitPercent,
        platformSplitPercent: c.platformSplitPercent,
        status: c.status,
        partnerSigned: !!c.partnerSignedAt,
        clientSigned: !!c.clientSignedAt,
        totalRecovered: c.totalRecovered,
        partnerEarnings: c.partnerEarnings,
        estimatedCredits: (c as any).estimatedCredits || 0,
        checklist: (c as any).checklist || null,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('Error listing contracts:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar contratos' });
  }
});

/**
 * GET /api/contract/my-clients
 * Lista clientes vinculados ao parceiro (para selecionar ao criar contrato)
 */
router.get('/my-clients', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros e administradores' });
    }

    const clients = await prisma.user.findMany({
      where: { invitedByPartnerId: partnerId },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        cnpj: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const existingContracts = await prisma.contract.findMany({
      where: {
        partnerId,
        status: { notIn: ['cancelled'] },
      },
      select: { clientId: true },
    });

    const clientsWithContracts = new Set(existingContracts.map(c => c.clientId));

    return res.json({
      success: true,
      data: clients.map(c => ({
        ...c,
        hasContract: clientsWithContracts.has(c.id),
      })),
    });
  } catch (error: any) {
    logger.error('Error listing partner clients:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar clientes' });
  }
});

/**
 * PATCH /api/contract/:id/status
 * Admin atualiza status do contrato manualmente
 */
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Somente administradores' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'draft', 'generated', 'sent_for_signature', 'signed',
      'sent_to_bank', 'bank_registered', 'active', 'completed', 'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status invalido. Validos: ${validStatuses.join(', ')}` });
    }

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    await prisma.contract.update({ where: { id }, data: { status } });

    logger.info(`Contract ${contract.contractNumber} status changed to ${status} by admin`);
    return res.json({ success: true, message: `Status atualizado para ${status}` });
  } catch (error: any) {
    logger.error('Error updating contract status:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar status' });
  }
});

/**
 * PATCH /api/contract/:id/checklist
 * Admin atualiza checklist de acompanhamento do contrato
 * Auto-activates contract when bank_registered + fee_received are both checked
 */
router.patch('/:id/checklist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Somente administradores' });
    }

    const { id } = req.params;
    const { checklist } = req.body;

    if (!checklist || typeof checklist !== 'object') {
      return res.status(400).json({ success: false, error: 'Checklist invalido' });
    }

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    const updateData: any = { checklist };

    // Auto-activation: bank registered + fee received => active + unlock analysis
    if (checklist.bank_registered && checklist.fee_received) {
      updateData.status = 'active';
      updateData.consultaLiberada = true;
      updateData.formalizacaoLiberada = true;
      updateData.setupFeePaid = true;
      updateData.setupFeePaidAt = contract.setupFeePaidAt || new Date();
      logger.info(`Contract ${contract.contractNumber} AUTO-ACTIVATED: bank registered + fee received`);
    }

    await prisma.contract.update({ where: { id }, data: updateData });

    return res.json({ success: true, message: 'Checklist atualizado', autoActivated: !!(checklist.bank_registered && checklist.fee_received) });
  } catch (error: any) {
    logger.error('Error updating checklist:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar checklist' });
  }
});

/**
 * GET /api/contract/my-status
 * Cliente verifica se tem contrato ativo + banco confirmado
 */
router.get('/my-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.userId || user.id;

    const contract = await prisma.contract.findFirst({
      where: {
        clientId: userId,
        status: { in: ['active', 'bank_registered', 'completed'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!contract) {
      return res.json({
        success: true,
        data: { hasActiveContract: false, bankConfirmed: false, contractStatus: 'none' },
      });
    }

    const checklist = (contract.checklist as any) || {};
    const bankConfirmed = !!(checklist.bank_registered || contract.status === 'bank_registered' || contract.status === 'active' || contract.status === 'completed');

    return res.json({
      success: true,
      data: {
        hasActiveContract: true,
        bankConfirmed,
        contractStatus: contract.status,
        contractId: contract.id,
        consultaLiberada: contract.consultaLiberada,
        formalizacaoLiberada: contract.formalizacaoLiberada,
      },
    });
  } catch (error: any) {
    logger.error('Error checking contract status:', error);
    return res.status(500).json({ success: false, error: 'Erro ao verificar status' });
  }
});

/**
 * GET /api/contract/:id
 * Detalhe do contrato com texto completo
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        partner: { select: { name: true, company: true, oabNumber: true, oabState: true } },
        client: {
          select: {
            name: true, company: true, cnpj: true, email: true,
            endereco: true, cidade: true, estado: true,
            legalRepName: true, legalRepCpf: true, legalRepCargo: true,
          },
        },
      },
    });

    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    return res.json({ success: true, data: contract });
  } catch (error: any) {
    logger.error('Error fetching contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao buscar contrato' });
  }
});

export default router;
