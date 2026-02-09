import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { sendPaymentConfirmationEmail } from '../services/email.service';
import { getOperatorPartnerId } from '../utils/operator';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/contract/create
 * Cria contrato entre parceiro e cliente
 * 
 * Regra de negocio:
 * - partnerSplitPercent >= 20% -> Liberado, sem limite
 * - partnerSplitPercent < 20%  -> Requer adminPassword para autorizar
 */
router.post('/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const partnerId = await getOperatorPartnerId((req as any).user);
    if (!partnerId) {
      return res.status(403).json({ success: false, error: 'Acesso restrito a parceiros e administradores' });
    }

    const { clientId, setupFee, partnerSplitPercent, platformSplitPercent, adminPassword } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId e obrigatorio' });
    }

    const partnerSplit = partnerSplitPercent || 40;

    // REGRA: Qualquer percentual diferente de 40% requer senha do administrador
    if (partnerSplit !== 40) {
      if (!adminPassword) {
        return res.status(403).json({
          success: false,
          error: 'Alterar o percentual padrao (40%) requer autorizacao do administrador',
          requiresAdminAuth: true,
        });
      }

      // Validar senha do admin
      const adminSecret = process.env.ADMIN_AUTH_PASSWORD || 'taxcredit@admin2026';
      if (adminPassword !== adminSecret) {
        return res.status(403).json({
          success: false,
          error: 'Senha de autorizacao invalida',
          requiresAdminAuth: true,
        });
      }

      logger.info(`Admin authorized custom commission contract: ${partnerSplit}% for partner ${partnerId}`);
    }

    // Verificar se o cliente existe
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
    }

    // Gerar numero do contrato
    const contractNumber = `TC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Gerar texto do contrato
    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });

    const contractText = generateContractText({
      contractNumber,
      partnerName: partner?.name || '',
      partnerCompany: partner?.company || '',
      partnerOab: partner?.oabNumber ? `OAB/${partner.oabState} ${partner.oabNumber}` : '',
      clientName: client.name || client.email,
      clientCompany: client.company || '',
      clientCnpj: client.cnpj || '',
      setupFee: setupFee || 2000,
      partnerSplit: partnerSplit,
      platformSplit: 100 - partnerSplit,
    });

    const contract = await prisma.contract.create({
      data: {
        partnerId,
        clientId,
        setupFee: setupFee || 2000,
        setupFeePartner: 800,
        setupFeePlatform: 1200,
        partnerSplitPercent: partnerSplit,
        platformSplitPercent: 100 - partnerSplit,
        contractNumber,
        contractText,
        status: 'pending_payment',
        consultaLiberada: false,
        formalizacaoLiberada: false,
      },
    });

    logger.info(`Contract created: ${contractNumber}`);

    return res.status(201).json({
      success: true,
      data: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        setupFee: contract.setupFee,
        status: contract.status,
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

    // Admin pode assinar como parceiro da plataforma
    const operatorPartnerId = user.partnerId || (user.role === 'admin' ? await getOperatorPartnerId(user) : null);
    
    if (operatorPartnerId && operatorPartnerId === contract.partnerId) {
      updateData.partnerSignedAt = new Date();
      updateData.partnerSignatureIp = String(ip);
    } else if (user.userId && user.userId === contract.clientId) {
      updateData.clientSignedAt = new Date();
      updateData.clientSignatureIp = String(ip);
    } else if (user.role === 'admin') {
      // Admin pode assinar qualquer contrato como representante da plataforma
      updateData.partnerSignedAt = new Date();
      updateData.partnerSignatureIp = String(ip);
    } else {
      return res.status(403).json({ success: false, error: 'Voce nao e parte deste contrato' });
    }

    // Verificar se ambos assinaram
    const updated = await prisma.contract.update({
      where: { id },
      data: updateData,
    });

    // Se ambos assinaram, ativar contrato
    if (updated.partnerSignedAt && updated.clientSignedAt) {
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
 * POST /api/contract/:id/confirm-payment
 * Confirma pagamento da taxa de R$ 2.000 e libera consulta + formalizacao
 */
router.post('/:id/confirm-payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
      },
    });

    logger.info(`Payment confirmed for contract ${contract.contractNumber}. Consultation and formalization unlocked.`);
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
        partnerName: c.partner.name,
        partnerCompany: c.partner.company,
        clientName: c.client.name || c.client.email,
        clientCompany: c.client.company,
        setupFee: c.setupFee,
        setupFeePaid: c.setupFeePaid,
        partnerSplitPercent: c.partnerSplitPercent,
        platformSplitPercent: c.platformSplitPercent,
        status: c.status,
        partnerSigned: !!c.partnerSignedAt,
        clientSigned: !!c.clientSignedAt,
        totalRecovered: c.totalRecovered,
        partnerEarnings: c.partnerEarnings,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('Error listing contracts:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar contratos' });
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
        client: { select: { name: true, company: true, cnpj: true, email: true } },
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

/**
 * Gera texto do contrato
 */
function generateContractText(data: {
  contractNumber: string;
  partnerName: string;
  partnerCompany: string;
  partnerOab: string;
  clientName: string;
  clientCompany: string;
  clientCnpj: string;
  setupFee: number;
  partnerSplit: number;
  platformSplit: number;
}): string {
  return `
CONTRATO DE PRESTACAO DE SERVICOS DE RECUPERACAO DE CREDITOS TRIBUTARIOS
Contrato N.: ${data.contractNumber}

PARTES:

CONTRATANTE: ${data.clientCompany || data.clientName}
CNPJ: ${data.clientCnpj || '[A definir]'}
Representante Legal: ${data.clientName}

ESCRITORIO PARCEIRO: ${data.partnerCompany || data.partnerName}
Responsavel: ${data.partnerName}
${data.partnerOab ? `Inscricao: ${data.partnerOab}` : ''}

PLATAFORMA: TaxCredit Enterprise
CNPJ: [CNPJ da TaxCredit]

CLAUSULA 1 - DO OBJETO
O presente contrato tem por objeto a prestacao de servicos de analise, identificacao e formalizacao de creditos tributarios da CONTRATANTE, utilizando a plataforma TaxCredit Enterprise com inteligencia artificial, sob supervisao tecnica e juridica do ESCRITORIO PARCEIRO.

CLAUSULA 2 - DA TAXA INICIAL (PAGA PELO CLIENTE)
A CONTRATANTE (cliente demandante da operacao) pagara, a titulo de taxa de adesao, o valor unico de R$ 2.000,00 (dois mil reais), distribuidos da seguinte forma:
- R$ 800,00 (oitocentos reais) destinados ao ESCRITORIO PARCEIRO (advogado signatario responsavel pela supervisao juridica);
- R$ 1.200,00 (mil e duzentos reais) destinados a PLATAFORMA TaxCredit (custos operacionais, tecnologia e IA).
Paragrafo unico: Apos a confirmacao do pagamento da taxa pelo CONTRATANTE, serao imediatamente liberados:
a) Consulta completa com inteligencia artificial para identificacao de creditos tributarios;
b) Formalizacao integral do processo tributario (peticoes, memorias de calculo, pareceres tecnicos).

CLAUSULA 3 - DA REMUNERACAO SOBRE CREDITOS RECUPERADOS
Sobre os valores efetivamente recuperados pela CONTRATANTE, sera aplicada a seguinte divisao:
- ${data.partnerSplit}% (${data.partnerSplit} por cento) para o ESCRITORIO PARCEIRO
- ${data.platformSplit}% (${data.platformSplit} por cento) para a PLATAFORMA TaxCredit
Nao ha limite maximo de ganho. Quanto maior o credito recuperado, maior o retorno para ambas as partes.

CLAUSULA 4 - DAS OBRIGACOES DA CONTRATANTE
a) Fornecer todos os documentos necessarios (DREs, Balancos, Balancetes, notas fiscais);
b) Disponibilizar documentos de identificacao do responsavel legal;
c) Manter atualizados os dados cadastrais;
d) Efetuar o pagamento da taxa de adesao no prazo estipulado.

CLAUSULA 5 - DAS OBRIGACOES DO ESCRITORIO PARCEIRO
a) Revisar e validar a documentacao gerada pela plataforma;
b) Acompanhar os processos junto aos orgaos competentes;
c) Manter sigilo sobre as informacoes da CONTRATANTE;
d) Prestar assessoria juridica durante todo o processo.

CLAUSULA 6 - DAS OBRIGACOES DA PLATAFORMA
a) Realizar a analise dos documentos com inteligencia artificial;
b) Gerar pareceres tecnicos, peticoes e memorias de calculo;
c) Manter a plataforma em funcionamento e com seguranca;
d) Processar os pagamentos e splits conforme acordado.

CLAUSULA 7 - DA VIGENCIA
Este contrato tem vigencia de 12 (doze) meses a partir da assinatura, renovavel automaticamente.

CLAUSULA 8 - DO FORO
Fica eleito o foro da Comarca de [Cidade/UF] para dirimir quaisquer controversias.

Data: ${new Date().toLocaleDateString('pt-BR')}
  `.trim();
}

export default router;
