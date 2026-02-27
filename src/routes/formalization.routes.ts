import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import {
  generateSefazDocument,
  generatePerdcompDocument,
  generateBipartiteContract,
  generateTripartiteContract,
  generateFormalizationKit,
  classifyAllOpportunities,
  type SefazDocumentParams,
  type PerdcompDocumentParams,
  type BipartiteContractParams,
  type TripartiteContractParams,
  type FormalizationKitParams,
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

    // Classificar oportunidades e filtrar apenas ICMS (competencia estadual)
    const classified = classifyAllOpportunities(opportunities);
    const estaduais = classified.filter(c => c.competencia === 'estadual');

    if (estaduais.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma oportunidade de ICMS encontrada. Tributos federais (PIS, COFINS, IRPJ, CSLL) devem ser formalizados via PER/DCOMP na Receita Federal, nao na SEFAZ.',
      });
    }

    const teses = estaduais.map(c => ({
      descricao: c.original.tese || c.original.titulo || c.original.description || 'Oportunidade ICMS',
      valor: c.original.valorEstimado || c.original.valor || c.original.estimated_value || 0,
      fundamentacao: c.original.fundamentacaoLegal || c.original.base_legal || c.original.fundamentacao || 'Legislacao estadual vigente',
      periodo: c.original.periodo || c.original.period || 'Conforme documentacao anexa',
    }));

    const valorEstadual = teses.reduce((sum, t) => sum + t.valor, 0);
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
      valorTotalCredito: valorEstadual,
      periodoInicio: '[Data inicio]',
      periodoFim: '[Data fim]',
      teses,
      protocoloPlataforma,
    };

    const document = generateSefazDocument(params);

    const federais = classified.filter(c => c.competencia === 'federal');
    const avisoFederais = federais.length > 0
      ? `ATENCAO: ${federais.length} oportunidade(s) federal(is) (${[...new Set(federais.map(f => f.grupoTributo))].join(', ')}) nao foram incluidas neste requerimento. Use "Gerar Kit Completo" ou "Gerar PER/DCOMP" para formaliza-las junto a Receita Federal.`
      : undefined;

    logger.info(`SEFAZ document generated for analysis ${analysisId}, UF: ${uf} — ${estaduais.length} ICMS, ${federais.length} federais excluidas`);

    return res.json({
      success: true,
      data: {
        document,
        protocoloPlataforma,
        uf,
        tipoPedido: tipoPedido || 'COMPENSACAO',
        valorEstadual,
        oportunidadesIncluidas: estaduais.length,
        oportunidadesFederaisExcluidas: federais.length,
        avisoFederais,
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

    // Parse e classificar oportunidades
    let opportunities: any[] = [];
    try {
      opportunities = JSON.parse(analysis.opportunities || '[]');
    } catch {}

    const classified = classifyAllOpportunities(opportunities);
    const federais = classified.filter(c => c.competencia === 'federal');

    if (federais.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma oportunidade federal encontrada. Creditos de ICMS devem ser formalizados via Requerimento SEFAZ, nao via PER/DCOMP.',
      });
    }

    // Gerar PER/DCOMPs separados por grupo de tributo
    const gruposFederais = new Map<string, typeof federais>();
    for (const f of federais) {
      const grupo = f.grupoTributo;
      if (!gruposFederais.has(grupo)) gruposFederais.set(grupo, []);
      gruposFederais.get(grupo)!.push(f);
    }

    const protocoloPlataforma = `TCE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const documents: Array<{ tributo: string; naturezaCredito: string; valorTotal: number; document: string }> = [];

    for (const [grupo, items] of gruposFederais) {
      const config = items[0];
      const creditos = items.map(c => ({
        tributo: `${c.grupoTributo} — ${c.original.tese || c.original.titulo || 'Credito identificado'}`,
        tipoCredito: c.naturezaCredito,
        periodo: c.original.periodo || periodoCredito || '[Periodo de apuracao]',
        valorOriginal: c.original.valorEstimado || c.original.valor || 0,
        valorAtualizado: (c.original.valorEstimado || c.original.valor || 0) * 1.08,
        baseLegal: c.fundamentacaoFederal + (c.original.fundamentacaoLegal ? ` | ${c.original.fundamentacaoLegal}` : ''),
        descricaoTese: c.original.tese || c.original.titulo || c.original.description || 'Oportunidade identificada',
      }));
      const valorGrupo = creditos.reduce((sum, c) => sum + c.valorOriginal, 0);

      const doc = generatePerdcompDocument({
        empresaNome: analysis.companyName,
        cnpj: analysis.cnpj || '[CNPJ]',
        protocoloPlataforma,
        advogadoNome: advogadoNome || '[Advogado]',
        advogadoOab: advogadoOab || '[OAB]',
        advogadoUf: advogadoUf || 'RJ',
        cidade: '[Cidade]',
        creditos,
        valorTotal: valorGrupo,
        tipoDocumento: 'Declaracao de Compensacao',
        tipoCreditoPerdcomp: config.naturezaCredito,
        periodoCredito: periodoCredito || items[0]?.original.periodo || '[Periodo]',
        codigoReceitaDebito: config.codigoReceita,
        periodoDebito: periodoDebito || '[Periodo do debito]',
      });

      documents.push({
        tributo: grupo,
        naturezaCredito: config.naturezaCredito,
        valorTotal: valorGrupo,
        document: doc,
      });
    }

    const estaduais = classified.filter(c => c.competencia === 'estadual');
    const avisoEstaduais = estaduais.length > 0
      ? `ATENCAO: ${estaduais.length} oportunidade(s) de ICMS nao foram incluidas. Use "Gerar Requerimento SEFAZ" para formaliza-las junto a SEFAZ-${analysis.cnpj ? '' : 'UF'}.`
      : undefined;

    logger.info(`PER/DCOMP documents generated for analysis ${analysisId}: ${documents.length} documento(s) por tributo`);

    return res.json({
      success: true,
      data: {
        documents,
        protocoloPlataforma,
        totalDocumentos: documents.length,
        oportunidadesFederais: federais.length,
        oportunidadesEstaduaisExcluidas: estaduais.length,
        avisoEstaduais,
      },
    });
  } catch (error: any) {
    logger.error('Error generating PER/DCOMP document:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar parecer PER/DCOMP' });
  }
});

/**
 * POST /api/formalization/generate-kit
 * Gera kit completo de formalizacao separado por competencia tributaria
 * Retorna: Requerimento SEFAZ (ICMS) + PER/DCOMPs separados por tributo federal
 */
router.post('/generate-kit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const {
      analysisId, uf,
      advogadoNome, advogadoOab, advogadoUf, advogadoEmail, advogadoEndereco,
      inscricaoEstadual, atividadeEmpresa, cnaePrincipal, tipoPedido,
    } = req.body;

    if (!analysisId || !uf) {
      return res.status(400).json({ success: false, error: 'analysisId e uf sao obrigatorios' });
    }

    const analysis = await prisma.viabilityAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analise nao encontrada' });
    }

    let opportunities: any[] = [];
    try {
      opportunities = JSON.parse(analysis.opportunities || '[]');
    } catch {}

    if (opportunities.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma oportunidade encontrada na analise' });
    }

    const kitParams: FormalizationKitParams = {
      opportunities,
      empresaNome: analysis.companyName,
      cnpj: analysis.cnpj || '[CNPJ]',
      uf,
      inscricaoEstadual: inscricaoEstadual || '[IE]',
      atividadeEmpresa,
      cnaePrincipal,
      advogadoNome,
      advogadoOab,
      advogadoUf: advogadoUf || uf,
      advogadoEmail,
      advogadoEndereco,
      tipoPedido: tipoPedido || 'COMPENSACAO',
    };

    const kit = generateFormalizationKit(kitParams);

    logger.info(`Formalization kit generated for analysis ${analysisId}: ${kit.resumo.qtdDocumentos} docs, estadual R$ ${kit.resumo.totalEstadual}, federal R$ ${kit.resumo.totalFederal}`);

    return res.json({
      success: true,
      data: kit,
    });
  } catch (error: any) {
    logger.error('Error generating formalization kit:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar kit de formalizacao' });
  }
});

/**
 * POST /api/formalization/generate-bipartite-contract
 * Gera contrato bipartite (venda direta, sem parceiro)
 * Aceita dados manuais OU clientId de usuario cadastrado
 */
router.post('/generate-bipartite-contract', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
    }

    const { manual, clientId, percentualPlataforma } = req.body;

    let clientData: {
      empresaNome: string; cnpj: string; endereco: string;
      cidade: string; uf: string; cep: string;
      representanteNome: string; representanteCargo: string; representanteCpf: string;
    };

    if (manual) {
      // Dados manuais do formulario
      const { empresaNome, cnpj, endereco, cidade, uf, cep, representanteNome, representanteCargo, representanteCpf } = req.body;
      if (!empresaNome) {
        return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
      }
      clientData = {
        empresaNome: empresaNome || '[Empresa]',
        cnpj: cnpj || '[CNPJ]',
        endereco: endereco || '[Endereco]',
        cidade: cidade || '[Cidade]',
        uf: uf || '[UF]',
        cep: cep || '[CEP]',
        representanteNome: representanteNome || '[Representante Legal]',
        representanteCargo: representanteCargo || '[Cargo]',
        representanteCpf: representanteCpf || '[CPF]',
      };
    } else {
      // Dados de usuario cadastrado
      if (!clientId) {
        return res.status(400).json({ success: false, error: 'clientId ou dados manuais sao obrigatorios' });
      }
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client) {
        return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
      }
      clientData = {
        empresaNome: client.company || client.name || '[Cliente]',
        cnpj: client.cnpj || '[CNPJ]',
        endereco: client.endereco || '[Endereco]',
        cidade: client.cidade || '[Cidade]',
        uf: client.estado || '[UF]',
        cep: client.cep || '[CEP]',
        representanteNome: client.legalRepName || client.name || '[Representante]',
        representanteCargo: client.legalRepCargo || '[Cargo]',
        representanteCpf: client.legalRepCpf || '[CPF]',
      };
    }

    const {
      percentualCliente, percentualParceiro, taxaAdesao, valorEstimado,
      advogadoNome, advogadoOab, escrowAgencia, escrowConta,
      contractType, ieCliente,
      parceiroNome, parceiroCnpjCpf, parceiroTipoPessoa, parceiroOab,
      parceiroEndereco, parceiroCidade, parceiroUf,
      parceiroBanco, parceiroAgencia, parceiroConta, parceiroTitular, parceiroDocBanco,
    } = req.body;

    const isTripartite = contractType === 'tripartite';
    const pctCliente = percentualCliente || 80;
    const pctParceiro = isTripartite ? (percentualParceiro || 8) : 0;
    const pctPlataforma = 100 - pctCliente - pctParceiro;

    if (pctCliente + pctPlataforma + pctParceiro !== 100) {
      return res.status(400).json({ success: false, error: 'Percentuais devem somar 100%' });
    }

    const baseParams: BipartiteContractParams = {
      empresaClienteNome: clientData.empresaNome,
      cnpjCliente: clientData.cnpj,
      ieCliente: ieCliente || '[IE]',
      enderecoCliente: clientData.endereco,
      cepCliente: clientData.cep || '[CEP]',
      cidadeCliente: clientData.cidade,
      ufCliente: clientData.uf,
      representanteCliente: clientData.representanteNome,
      cargoRepresentanteCliente: clientData.representanteCargo,
      cpfRepresentanteCliente: clientData.representanteCpf,
      percentualCliente: pctCliente,
      percentualPlataforma: pctPlataforma,
      taxaAdesao: taxaAdesao || 2000,
      valorEstimado: valorEstimado || 0,
      advogadoNome: advogadoNome || '[ADVOGADO]',
      advogadoOab: advogadoOab || '[OAB]',
      escrowAgencia: escrowAgencia || '[AGENCIA]',
      escrowConta: escrowConta || '[CONTA]',
      dataContrato: new Date().toLocaleDateString('pt-BR'),
    };

    let contractText: string;
    if (isTripartite) {
      contractText = generateTripartiteContract({
        ...baseParams,
        percentualParceiro: pctParceiro,
        parceiroNome: parceiroNome || '[PARCEIRO]',
        parceiroCnpjCpf: parceiroCnpjCpf || '[DOC]',
        parceiroTipoPessoa: parceiroTipoPessoa || 'juridica',
        parceiroOab: parceiroOab || '',
        parceiroEndereco: parceiroEndereco || '[Endereco]',
        parceiroCidade: parceiroCidade || '[Cidade]',
        parceiroUf: parceiroUf || '[UF]',
        parceiroBanco: parceiroBanco || '[BANCO]',
        parceiroAgencia: parceiroAgencia || '[AGENCIA]',
        parceiroConta: parceiroConta || '[CONTA]',
        parceiroTitular: parceiroTitular || '[TITULAR]',
        parceiroDocBanco: parceiroDocBanco || '[DOC]',
      });
    } else {
      contractText = generateBipartiteContract(baseParams);
    }

    logger.info(`Bipartite contract generated (manual: ${!!manual})`);

    return res.json({
      success: true,
      data: {
        contractText,
        clientName: clientData.empresaNome,
        cnpj: clientData.cnpj,
      },
    });
  } catch (error: any) {
    logger.error('Error generating bipartite contract:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar contrato bipartite' });
  }
});

export default router;
