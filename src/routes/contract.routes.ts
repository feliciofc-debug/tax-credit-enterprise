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
      // Parceiro
      partnerName: partner?.name || '',
      partnerCompany: partner?.company || '',
      partnerOab: partner?.oabNumber ? `OAB/${partner.oabState} ${partner.oabNumber}` : '',
      partnerCnpj: partner?.cnpj || '',
      partnerEndereco: partner?.endereco || '',
      partnerCidade: partner?.cidade || '',
      partnerEstado: partner?.estado || '',
      partnerBank: partner?.bankName || '',
      partnerBankAgency: partner?.bankAgency || '',
      partnerBankAccount: partner?.bankAccount || '',
      partnerBankPix: partner?.bankPixKey || '',
      // Cliente
      clientName: client.name || client.email,
      clientCompany: client.company || '',
      clientCnpj: client.cnpj || '',
      clientEndereco: client.endereco || '',
      clientCidade: client.cidade || '',
      clientEstado: client.estado || '',
      clientLegalRep: client.legalRepName || client.name || '',
      clientLegalRepCpf: client.legalRepCpf || '',
      clientLegalRepCargo: client.legalRepCargo || '',
      clientBank: client.bankName || '',
      clientBankAgency: client.bankAgency || '',
      clientBankAccount: client.bankAccount || '',
      clientBankPix: client.bankPixKey || '',
      clientBankHolder: client.bankAccountHolder || '',
      clientBankCpfCnpj: client.bankCpfCnpj || '',
      // Valores
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
        setupFee: contract.setupFee,
        status: contract.status,
        partnerSigned: !!contract.partnerSignedAt,
        clientSigned: !!contract.clientSignedAt,
        partnerName: contract.partner?.company || contract.partner?.name || '',
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
  partnerName: string; partnerCompany: string; partnerOab: string; partnerCnpj: string;
  partnerEndereco: string; partnerCidade: string; partnerEstado: string;
  partnerBank: string; partnerBankAgency: string; partnerBankAccount: string; partnerBankPix: string;
  clientName: string; clientCompany: string; clientCnpj: string;
  clientEndereco: string; clientCidade: string; clientEstado: string;
  clientLegalRep: string; clientLegalRepCpf: string; clientLegalRepCargo: string;
  clientBank: string; clientBankAgency: string; clientBankAccount: string; clientBankPix: string;
  clientBankHolder: string; clientBankCpfCnpj: string;
  setupFee: number; partnerSplit: number; platformSplit: number;
}): string {
  return `
CONTRATO DE PRESTACAO DE SERVICOS DE RECUPERACAO DE CREDITOS TRIBUTARIOS
Contrato N.: ${data.contractNumber}
Data: ${new Date().toLocaleDateString('pt-BR')}

=====================================
PARTES CONTRATANTES
=====================================

1. PLATAFORMA (Gestora da Operacao):
ATOM BRASIL DIGITAL LTDA
CNPJ: [CNPJ ATOM BRASIL DIGITAL]
Endereco: [Endereco ATOM BRASIL DIGITAL]
Doravante denominada "PLATAFORMA"

2. ESCRITORIO PARCEIRO (Supervisao Juridica):
${data.partnerCompany || data.partnerName}
${data.partnerCnpj ? `CNPJ: ${data.partnerCnpj}` : ''}
Responsavel: ${data.partnerName}
${data.partnerOab ? `Inscricao: ${data.partnerOab}` : ''}
${data.partnerEndereco ? `Endereco: ${data.partnerEndereco}, ${data.partnerCidade}/${data.partnerEstado}` : ''}
Doravante denominado "PARCEIRO"

3. CONTRATANTE (Cliente Demandante):
${data.clientCompany || data.clientName}
${data.clientCnpj ? `CNPJ: ${data.clientCnpj}` : '[CNPJ A DEFINIR]'}
${data.clientEndereco ? `Endereco: ${data.clientEndereco}, ${data.clientCidade}/${data.clientEstado}` : ''}
Representante Legal: ${data.clientLegalRep}
${data.clientLegalRepCpf ? `CPF: ${data.clientLegalRepCpf}` : ''}
${data.clientLegalRepCargo ? `Cargo: ${data.clientLegalRepCargo}` : ''}
Doravante denominado "CONTRATANTE"

=====================================
DADOS BANCARIOS DAS PARTES
=====================================

PLATAFORMA - ATOM BRASIL DIGITAL:
Banco: [BANCO ATOM BRASIL]
Agencia: [AGENCIA]
Conta: [CONTA]
PIX: [CHAVE PIX ATOM]

PARCEIRO:
${data.partnerBank ? `Banco: ${data.partnerBank}` : 'Banco: [A INFORMAR]'}
${data.partnerBankAgency ? `Agencia: ${data.partnerBankAgency}` : ''}
${data.partnerBankAccount ? `Conta: ${data.partnerBankAccount}` : 'Conta: [A INFORMAR]'}
${data.partnerBankPix ? `PIX: ${data.partnerBankPix}` : ''}

CONTRATANTE:
${data.clientBank ? `Banco: ${data.clientBank}` : 'Banco: [A INFORMAR]'}
${data.clientBankAgency ? `Agencia: ${data.clientBankAgency}` : ''}
${data.clientBankAccount ? `Conta: ${data.clientBankAccount}` : 'Conta: [A INFORMAR]'}
${data.clientBankPix ? `PIX: ${data.clientBankPix}` : ''}
${data.clientBankHolder ? `Titular: ${data.clientBankHolder}` : ''}
${data.clientBankCpfCnpj ? `CPF/CNPJ Titular: ${data.clientBankCpfCnpj}` : ''}

=====================================
CLAUSULAS CONTRATUAIS
=====================================

CLAUSULA 1 - DO OBJETO
O presente contrato tem por objeto a prestacao de servicos de analise, identificacao e formalizacao de creditos tributarios do CONTRATANTE, utilizando a plataforma TaxCredit Enterprise com inteligencia artificial, sob gestao da PLATAFORMA e supervisao tecnica e juridica do PARCEIRO.

CLAUSULA 2 - DA TAXA INICIAL (PAGA PELO CONTRATANTE)
O CONTRATANTE pagara, a titulo de taxa de adesao, o valor unico de R$ 2.000,00 (dois mil reais), distribuidos da seguinte forma:
a) R$ 800,00 (oitocentos reais) destinados ao PARCEIRO;
b) R$ 1.200,00 (mil e duzentos reais) destinados a PLATAFORMA.
Paragrafo unico: Apos a confirmacao do pagamento, serao liberados:
I - Consulta completa com inteligencia artificial para identificacao de creditos tributarios;
II - Formalizacao integral do processo tributario (peticoes, memorias de calculo, pareceres tecnicos).

CLAUSULA 3 - DA REMUNERACAO SOBRE CREDITOS RECUPERADOS
Sobre os valores efetivamente recuperados pelo CONTRATANTE:
a) ${data.partnerSplit}% (${data.partnerSplit} por cento) para o PARCEIRO;
b) ${data.platformSplit}% (${data.platformSplit} por cento) para a PLATAFORMA.
Paragrafo unico: Nao ha limite maximo de ganho sobre creditos recuperados.

CLAUSULA 4 - DOS PAGAMENTOS E TRANSFERENCIAS
4.1. Todos os pagamentos e transferencias decorrentes deste contrato serao realizados exclusivamente para as contas bancarias descritas na secao "DADOS BANCARIOS DAS PARTES".
4.2. E de INTEIRA RESPONSABILIDADE do CONTRATANTE verificar as empresas contratadas, seus respectivos percentuais e os dados bancarios informados.
4.3. Em caso de erro em transferencias ou depositos para contas dos beneficiarios deste contrato, decorrente de informacoes incorretas fornecidas pelo CONTRATANTE, a responsabilidade e 100% (cem por cento) do CONTRATANTE.
4.4. A PLATAFORMA e o PARCEIRO nao se responsabilizam por transferencias realizadas para contas incorretas informadas pelo CONTRATANTE.

CLAUSULA 5 - DAS OBRIGACOES DO CONTRATANTE
a) Fornecer todos os documentos necessarios (DREs, Balancos, Balancetes, notas fiscais);
b) Fornecer dados corretos e atualizados do representante legal e dados bancarios;
c) Verificar as informacoes constantes neste contrato antes da assinatura;
d) Efetuar o pagamento da taxa de adesao no prazo estipulado;
e) Manter seus dados cadastrais e bancarios atualizados na plataforma.

CLAUSULA 6 - DAS OBRIGACOES DO PARCEIRO
a) Revisar e validar a documentacao gerada pela plataforma;
b) Acompanhar os processos junto aos orgaos competentes;
c) Manter sigilo sobre as informacoes do CONTRATANTE;
d) Prestar assessoria juridica durante todo o processo.

CLAUSULA 7 - DAS OBRIGACOES DA PLATAFORMA
a) Realizar a analise dos documentos com inteligencia artificial;
b) Gerar pareceres tecnicos, peticoes e memorias de calculo;
c) Manter a plataforma em funcionamento e com seguranca;
d) Processar os pagamentos e splits conforme acordado neste contrato.

CLAUSULA 8 - DA RESPONSABILIDADE
8.1. O CONTRATANTE declara ter verificado e conferido todos os dados constantes neste contrato, incluindo dados bancarios, percentuais e informacoes das partes contratadas.
8.2. Qualquer divergencia nos dados informados e de exclusiva responsabilidade da parte que os forneceu.
8.3. A PLATAFORMA atua como intermediadora tecnologica e nao se responsabiliza por eventuais divergencias entre as partes.

CLAUSULA 9 - DA VIGENCIA
Este contrato tem vigencia de 12 (doze) meses a partir da assinatura, renovavel automaticamente por igual periodo.

CLAUSULA 10 - DO FORO
Fica eleito o foro da Comarca de Sao Paulo/SP para dirimir quaisquer controversias oriundas deste contrato.

=====================================
ASSINATURAS
=====================================

PLATAFORMA - ATOM BRASIL DIGITAL:
Data: ___/___/______  Assinatura: _________________________

PARCEIRO - ${data.partnerCompany || data.partnerName}:
Data: ___/___/______  Assinatura: _________________________

CONTRATANTE - ${data.clientCompany || data.clientName}:
Data: ___/___/______  Assinatura: _________________________
Rep. Legal: ${data.clientLegalRep}
  `.trim();
}

export default router;
