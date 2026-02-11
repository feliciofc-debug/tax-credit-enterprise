import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import {
  generateSefazDocument,
  generatePerdcompDocument,
  generateBipartiteContract,
  type SefazDocumentParams,
  type PerdcompDocumentParams,
} from '../services/formalization.service';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/formalization/generate-sefaz
 * Gera Requerimento Administrativo para SEFAZ estadual
 */
router.post('/generate-sefaz', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const {
      analysisId,
      uf,
      advogadoNome,
      advogadoOab,
      advogadoUf,
      advogadoEmail,
      advogadoEndereco,
      tipoPedido,
      inscricaoEstadual,
      atividadeEmpresa,
      cnaePrincipal,
    } = req.body;

    if (!analysisId || !uf) {
      return res.status(400).json({ success: false, error: 'analysisId e uf sao obrigatorios' });
    }

    // Buscar analise
    const analysis = await prisma.viabilityAnalysis.findUnique({
      where: { id: analysisId },
      include: { partner: { select: { name: true, company: true } } },
    });

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analise nao encontrada' });
    }

    // Parse oportunidades
    let opportunities: any[] = [];
    try {
      opportunities = JSON.parse(analysis.opportunities || '[]');
    } catch {}

    // Montar teses a partir das oportunidades
    const teses = opportunities.map((op: any) => ({
      descricao: op.tese || op.titulo || op.description || 'Oportunidade identificada',
      valor: op.valorEstimado || op.valor || op.estimated_value || 0,
      fundamentacao: op.fundamentacaoLegal || op.base_legal || op.fundamentacao || 'Legislacao vigente',
      periodo: op.periodo || op.period || 'Conforme documentacao anexa',
    }));

    const protocoloPlataforma = `TCE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const params: SefazDocumentParams = {
      empresaNome: analysis.companyName,
      cnpj: analysis.cnpj || '[CNPJ A INFORMAR]',
      inscricaoEstadual: inscricaoEstadual || '[IE A INFORMAR]',
      empresaEndereco: '[Endereco da empresa]',
      empresaCidade: '[Cidade]',
      empresaUf: uf,
      empresaCep: '[CEP]',
      atividadeEmpresa: atividadeEmpresa || '[Atividade]',
      cnaePrincipal: cnaePrincipal || '[CNAE]',
      advogadoNome: advogadoNome || '[Advogado]',
      advogadoOab: advogadoOab || '[OAB]',
      advogadoUf: advogadoUf || uf,
      advogadoEmail: advogadoEmail || '[email@advogado.com]',
      advogadoEndereco: advogadoEndereco || '[Endereco do escritorio]',
      representanteNome: '[Representante Legal]',
      representanteCargo: '[Cargo]',
      representanteCpf: '[CPF]',
      representanteRg: '[RG]',
      uf,
      tipoPedido: tipoPedido || 'COMPENSACAO',
      valorTotalCredito: analysis.estimatedCredit || 0,
      periodoInicio: '[Data inicio]',
      periodoFim: '[Data fim]',
      teses,
      protocoloPlataforma,
    };

    const document = generateSefazDocument(params);

    logger.info(`SEFAZ document generated for analysis ${analysisId}, UF: ${uf}`);

    return res.json({
      success: true,
      data: {
        document,
        protocoloPlataforma,
        uf,
        tipoPedido: tipoPedido || 'COMPENSACAO',
      },
    });
  } catch (error: any) {
    logger.error('Error generating SEFAZ document:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar documento SEFAZ' });
  }
});

/**
 * POST /api/formalization/generate-perdcomp
 * Gera Parecer Tecnico para PER/DCOMP
 */
router.post('/generate-perdcomp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const {
      analysisId,
      advogadoNome,
      advogadoOab,
      advogadoUf,
      tipoCredito,
      periodoCredito,
      codigoReceitaDebito,
      periodoDebito,
    } = req.body;

    if (!analysisId) {
      return res.status(400).json({ success: false, error: 'analysisId e obrigatorio' });
    }

    const analysis = await prisma.viabilityAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analise nao encontrada' });
    }

    // Parse oportunidades federais
    let opportunities: any[] = [];
    try {
      opportunities = JSON.parse(analysis.opportunities || '[]');
    } catch {}

    // Filtrar oportunidades federais (PIS, COFINS, IRPJ, CSLL, IPI)
    const federalKeywords = ['PIS', 'COFINS', 'IRPJ', 'CSLL', 'IPI', 'federal', 'receita'];
    const federalOpps = opportunities.filter((op: any) => {
      const text = JSON.stringify(op).toUpperCase();
      return federalKeywords.some(k => text.includes(k.toUpperCase()));
    });

    const creditos = (federalOpps.length > 0 ? federalOpps : opportunities).map((op: any) => ({
      tributo: op.tese || op.titulo || tipoCredito || 'Credito Tributario Federal',
      tipoCredito: tipoCredito || 'Saldo Negativo',
      periodo: op.periodo || periodoCredito || '[Periodo]',
      valorOriginal: op.valorEstimado || op.valor || 0,
      valorAtualizado: (op.valorEstimado || op.valor || 0) * 1.08, // Estimativa SELIC
      baseLegal: op.fundamentacaoLegal || op.base_legal || 'Legislacao vigente',
      descricaoTese: op.tese || op.titulo || op.description || 'Oportunidade identificada',
    }));

    const protocoloPlataforma = `TCE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const params: PerdcompDocumentParams = {
      empresaNome: analysis.companyName,
      cnpj: analysis.cnpj || '[CNPJ]',
      protocoloPlataforma,
      advogadoNome: advogadoNome || '[Advogado]',
      advogadoOab: advogadoOab || '[OAB]',
      advogadoUf: advogadoUf || 'SP',
      cidade: 'Sao Paulo',
      creditos,
      valorTotal: analysis.estimatedCredit || 0,
      tipoDocumento: 'Declaracao de Compensacao',
      tipoCreditoPerdcomp: tipoCredito || 'Saldo Negativo de IRPJ',
      periodoCredito: periodoCredito || '[Periodo]',
      codigoReceitaDebito: codigoReceitaDebito || '[Codigo]',
      periodoDebito: periodoDebito || '[Periodo]',
    };

    const document = generatePerdcompDocument(params);

    logger.info(`PER/DCOMP document generated for analysis ${analysisId}`);

    return res.json({
      success: true,
      data: {
        document,
        protocoloPlataforma,
      },
    });
  } catch (error: any) {
    logger.error('Error generating PER/DCOMP document:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar parecer PER/DCOMP' });
  }
});

/**
 * POST /api/formalization/generate-bipartite-contract
 * Gera contrato bipartite (venda direta, sem parceiro)
 */
router.post('/generate-bipartite-contract', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const { clientId, percentualPlataforma, analysisId } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId e obrigatorio' });
    }

    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
    }

    const contractText = generateBipartiteContract({
      cnpjPlataforma: process.env.PLATFORM_CNPJ || '[CNPJ ATOM BRASIL DIGITAL]',
      enderecoPlataforma: process.env.PLATFORM_ADDRESS || '[Endereco]',
      cidadePlataforma: process.env.PLATFORM_CITY || 'Sao Paulo',
      ufPlataforma: process.env.PLATFORM_STATE || 'SP',
      cepPlataforma: process.env.PLATFORM_CEP || '[CEP]',
      representantePlataforma: process.env.PLATFORM_REPRESENTATIVE || '[Representante]',
      cargoRepresentantePlataforma: 'Socio-Administrador',
      cpfRepresentantePlataforma: process.env.PLATFORM_REP_CPF || '[CPF]',
      empresaClienteNome: client.company || client.name || '[Cliente]',
      cnpjCliente: client.cnpj || '[CNPJ]',
      ieCliente: '[IE]',
      enderecoCliente: client.endereco || '[Endereco]',
      cidadeCliente: client.cidade || '[Cidade]',
      ufCliente: client.estado || '[UF]',
      cepCliente: client.cep || '[CEP]',
      representanteCliente: client.legalRepName || client.name || '[Representante]',
      cargoRepresentanteCliente: client.legalRepCargo || '[Cargo]',
      cpfRepresentanteCliente: client.legalRepCpf || '[CPF]',
      percentualPlataforma: percentualPlataforma || 60,
      chavePix: process.env.PLATFORM_PIX_KEY || 'felicio@atacadistadigital.com',
      dataContrato: new Date().toLocaleDateString('pt-BR'),
      cidadeContrato: 'Sao Paulo',
    });

    logger.info(`Bipartite contract generated for client ${clientId}`);

    return res.json({
      success: true,
      data: {
        contractText,
        clientName: client.company || client.name,
        cnpj: client.cnpj,
      },
    });
  } catch (error: any) {
    logger.error('Error generating bipartite contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar contrato bipartite' });
  }
});

export default router;
