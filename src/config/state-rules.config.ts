/**
 * StateRulesEngine — Configuracao canonica das 27 UFs brasileiras
 * ============================================================
 *
 * Centraliza TODAS as regras estaduais (SEFAZ) que antes estavam
 * espalhadas em hardcode (compliance.service, demonstrativo.service,
 * formalization.service, checklists.ts, prompts da IA).
 *
 * Cada nova UF = 1 entrada nesse arquivo. Sem refactor de logica.
 *
 * Cobertura atual:
 *   - covered (8): SP, RJ, MG, RS, PR, SC, BA, MT  ~78% PIB
 *   - planned (5): PE, CE, MA, ES, GO              priorizados Nordeste/Sudeste
 *   - pending (14): DF, MS, AL, SE, RN, PB, PI, AM, PA, RO, RR, AP, AC, TO
 *
 * Tiers de integracao:
 *   - A: API/Webservice oficial (SP e-CredAc, PR SISCRED)
 *   - B: Portal autenticado + scraping/RPA (maioria)
 *   - C: Manual + upload (UFs menos digitalizadas, Norte/NE profundo)
 */

export type StateTier = 'A' | 'B' | 'C';
export type StateStatus = 'covered' | 'planned' | 'pending';
export type Regiao = 'N' | 'NE' | 'CO' | 'SE' | 'S';

export interface StateRule {
  uf: string;
  nome: string;
  regiao: Regiao;
  status: StateStatus;
  tier: StateTier;
  pibPct: number; // % aproximado do PIB nacional

  sefaz: {
    nomeOrgao: string;            // ex: 'SEFAZ-SP' (curto)
    nomeOficial?: string;         // ex: 'SECRETARIA DA FAZENDA E PLANEJAMENTO DO ESTADO DE SAO PAULO'
    autoridade: string;           // 'Sr. Auditor Fiscal...' (formal informal)
    autoridadeOficial?: string;   // 'ILMO. SR. DELEGADO REGIONAL TRIBUTARIO' (peticoes)
    cadastroEstadual?: string;    // 'CADESP' | 'CAD-ICMS/BA' etc.
    enderecoOrgao?: string;
    siteUrl?: string;
    sistemaCreditoAcumulado?: string;
    portalProcessos?: string;
    canalCertificadoCredito?: string;
  };

  baseLegal: {
    leiComplementar?: string;
    ricms?: string;
    artigosPrincipais?: string[];
    resolucoesRelevantes?: string[];
  };

  hipoteses?: string[];

  utilizacao?: {
    compensacaoProprio: boolean;
    transferenciaMesmoTitular: boolean;
    transferenciaTerceiros: boolean;
    pagamentoFornecedores: boolean;
    pagamentoAtivoImobilizado: boolean;
    ressarcimentoMoeda: boolean;
    limites?: Record<string, string>;
  };

  procuracao?: {
    requerInstrumentoProprio: boolean;
    nomeInstrumento?: string;
    aceitaProcuracaoGenerica: boolean;
    poderesNecessarios?: string[];
    prazoMaximoMeses?: number;
  };

  prazos?: {
    decadencia: string;
    prescricao?: string;
  };

  observacoes?: string;
}

// ============================================================
// COVERED (8) — regras completas, em producao
// ============================================================

const SP: StateRule = {
  uf: 'SP',
  nome: 'Sao Paulo',
  regiao: 'SE',
  status: 'covered',
  tier: 'A',
  pibPct: 31.2,
  sefaz: {
    nomeOrgao: 'SEFAZ-SP',
    nomeOficial: 'SECRETARIA DA FAZENDA E PLANEJAMENTO DO ESTADO DE SAO PAULO',
    autoridade: 'Sr. Chefe da Equipe de Atendimento Especifico — DEAT/SP',
    autoridadeOficial: 'ILMO. SR. DELEGADO REGIONAL TRIBUTARIO',
    cadastroEstadual: 'CADESP',
    siteUrl: 'https://portal.fazenda.sp.gov.br',
    sistemaCreditoAcumulado: 'e-CredAc',
    portalProcessos: 'e-CredAc / SIPET',
    canalCertificadoCredito: 'sistema e-CredAc (portal SEFAZ-SP)',
  },
  baseLegal: {
    leiComplementar: 'LC 87/1996 (Lei Kandir)',
    ricms: 'RICMS/SP — Decreto 45.490/2000',
    artigosPrincipais: ['Art. 71-81 (Credito Acumulado)'],
    resolucoesRelevantes: ['Portaria CAT 26/2010', 'Portaria CAT 207/2009'],
  },
  hipoteses: [
    'Exportacao com manutencao de credito (LC 87 Art. 32)',
    'Aquisicao de insumos com aliquota superior a saida',
    'Operacoes de saida com diferimento ou substituicao tributaria',
  ],
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: true,
    pagamentoAtivoImobilizado: true,
    ressarcimentoMoeda: false,
    limites: { transferenciaTerceiros: '30%' },
  },
  procuracao: {
    requerInstrumentoProprio: true,
    nomeInstrumento: 'Procurador e-CredAc',
    aceitaProcuracaoGenerica: false,
    poderesNecessarios: ['acesso e-CredAc', 'transmitir pedidos', 'assinar peticoes'],
    prazoMaximoMeses: 12,
  },
  prazos: { decadencia: '5 anos', prescricao: '5 anos' },
};

const RJ: StateRule = {
  uf: 'RJ',
  nome: 'Rio de Janeiro',
  regiao: 'SE',
  status: 'covered',
  tier: 'B',
  pibPct: 10.6,
  sefaz: {
    nomeOrgao: 'SEFAZ-RJ',
    nomeOficial: 'SECRETARIA DE ESTADO DE FAZENDA DO RIO DE JANEIRO',
    autoridade: 'Sr. Auditor Fiscal — Coordenadoria de Tributacao/RJ',
    autoridadeOficial: 'EXMO. SR. SECRETARIO DE ESTADO DE FAZENDA',
    cadastroEstadual: 'CADERJ',
    siteUrl: 'https://www.fazenda.rj.gov.br',
    portalProcessos: 'SEI-RJ',
    sistemaCreditoAcumulado: 'Calculadora SEFAZ-RJ (Livro III RICMS/RJ)',
  },
  baseLegal: {
    leiComplementar: 'LC 87/1996',
    ricms: 'RICMS/RJ — Decreto 27.427/2000 (Livro III, redacao Dec 46.668/2019)',
    resolucoesRelevantes: ['Res. SEFAZ 191/2017', 'Res. SEFAZ 202/2018'],
  },
  hipoteses: [
    'Exportacao com manutencao de credito',
    'Operacoes com diferimento',
    'Aquisicoes com tributacao acima da saida',
  ],
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: false,
    pagamentoFornecedores: false,
    pagamentoAtivoImobilizado: false,
    ressarcimentoMoeda: true,
    limites: { saldoDevedorReceptor: 'credito <= saldo devedor' },
  },
  procuracao: {
    requerInstrumentoProprio: false,
    nomeInstrumento: 'Procuracao SEI-RJ',
    aceitaProcuracaoGenerica: true,
    prazoMaximoMeses: 24,
  },
  prazos: { decadencia: '5 anos' },
};

const MG: StateRule = {
  uf: 'MG',
  nome: 'Minas Gerais',
  regiao: 'SE',
  status: 'covered',
  tier: 'B',
  pibPct: 8.7,
  sefaz: {
    nomeOrgao: 'SEFAZ-MG',
    nomeOficial: 'SECRETARIA DE ESTADO DE FAZENDA DE MINAS GERAIS',
    autoridade: 'Sr. Auditor Fiscal — Superintendencia de Tributacao/MG',
    autoridadeOficial: 'ILMO. SR. DELEGADO FISCAL',
    cadastroEstadual: 'Cadastro de Contribuintes ICMS/MG',
    siteUrl: 'https://www.fazenda.mg.gov.br',
    portalProcessos: 'SIARE / DCA-ICMS',
    sistemaCreditoAcumulado: 'DCA-ICMS (Demonstrativo de Credito Acumulado)',
  },
  baseLegal: {
    ricms: 'RICMS/MG — Decreto 43.080/2002 (Anexos III e VIII)',
    leiComplementar: 'LC 87/1996',
  },
  hipoteses: ['Exportacao', 'Diferimento', 'Substituicao tributaria'],
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: true,
    pagamentoAtivoImobilizado: true,
    ressarcimentoMoeda: false,
    limites: { saldoDevedorTerceiros: '30%', materiaPrimaFornecedor: '20%', ativoFornecedor: '20%' },
  },
  procuracao: {
    requerInstrumentoProprio: false,
    aceitaProcuracaoGenerica: true,
  },
  prazos: { decadencia: '5 anos' },
};

const RS: StateRule = {
  uf: 'RS',
  nome: 'Rio Grande do Sul',
  regiao: 'S',
  status: 'covered',
  tier: 'B',
  pibPct: 6.4,
  sefaz: {
    nomeOrgao: 'SEFAZ-RS',
    nomeOficial: 'SECRETARIA DA FAZENDA DO ESTADO DO RIO GRANDE DO SUL',
    autoridade: 'Sr. Auditor Fiscal — Receita Estadual/RS',
    autoridadeOficial: 'ILMO. SR. DELEGADO DA RECEITA ESTADUAL',
    cadastroEstadual: 'Cadastro de Contribuintes ICMS/RS',
    siteUrl: 'https://receita.fazenda.rs.gov.br',
    portalProcessos: 'PROTOCOLO Eletronico SEFAZ-RS',
  },
  baseLegal: {
    ricms: 'RICMS/RS — Decreto 37.699/1997 (Livro I, Arts. 58 e 59)',
    leiComplementar: 'LC 87/1996',
  },
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: true,
    pagamentoAtivoImobilizado: true,
    ressarcimentoMoeda: false,
  },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
  prazos: { decadencia: '5 anos' },
};

const PR: StateRule = {
  uf: 'PR',
  nome: 'Parana',
  regiao: 'S',
  status: 'covered',
  tier: 'A',
  pibPct: 6.3,
  sefaz: {
    nomeOrgao: 'SEFAZ-PR',
    nomeOficial: 'SECRETARIA DA FAZENDA DO ESTADO DO PARANA',
    autoridade: 'Sr. Auditor Fiscal — Coordenacao da Receita do Estado/PR',
    autoridadeOficial: 'ILMO. SR. INSPETOR GERAL DE FISCALIZACAO',
    cadastroEstadual: 'CAD/ICMS-PR',
    siteUrl: 'https://www.fazenda.pr.gov.br',
    sistemaCreditoAcumulado: 'SISCRED',
    portalProcessos: 'Receita/PR (e-Protocolo)',
  },
  baseLegal: {
    ricms: 'RICMS/PR — Decreto 7.871/2017 (Arts. 47-61)',
  },
  hipoteses: ['Exportacao', 'Diferimento', 'Substituicao tributaria', 'Reducao base de calculo'],
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: true,
    pagamentoAtivoImobilizado: true,
    ressarcimentoMoeda: false,
    limites: { transferenciaTerceiros: 'sem limite para creditos de exportacao' },
  },
  procuracao: {
    requerInstrumentoProprio: true,
    nomeInstrumento: 'Operador SISCRED',
    aceitaProcuracaoGenerica: false,
    poderesNecessarios: ['acesso SISCRED', 'transmitir transferencias', 'assinar peticoes'],
    prazoMaximoMeses: 12,
  },
  prazos: { decadencia: '5 anos' },
};

const SC: StateRule = {
  uf: 'SC',
  nome: 'Santa Catarina',
  regiao: 'S',
  status: 'covered',
  tier: 'B',
  pibPct: 4.5,
  sefaz: {
    nomeOrgao: 'SEFAZ-SC',
    nomeOficial: 'SECRETARIA DE ESTADO DA FAZENDA DE SANTA CATARINA',
    autoridade: 'Sr. Auditor Fiscal — Diretoria de Administracao Tributaria/SC',
    autoridadeOficial: 'ILMO. SR. DIRETOR DE ADMINISTRACAO TRIBUTARIA',
    cadastroEstadual: 'CCICMS/SC',
    siteUrl: 'https://www.sef.sc.gov.br',
    portalProcessos: 'SAT (Sistema de Administracao Tributaria)',
  },
  baseLegal: {
    ricms: 'RICMS/SC-01 — Decreto 2.870/2001 (Arts. 40, 45, 48, 49, 52)',
  },
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: true,
    pagamentoAtivoImobilizado: true,
    ressarcimentoMoeda: false,
    limites: { transferenciaTerceiros: 'condicionado a investimentos em expansao/novos negocios em SC' },
  },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
  prazos: { decadencia: '5 anos' },
  observacoes: 'Programas TTD (Tratamento Tributario Diferenciado) permitem regras especiais.',
};

const BA: StateRule = {
  uf: 'BA',
  nome: 'Bahia',
  regiao: 'NE',
  status: 'covered',
  tier: 'B',
  pibPct: 3.9,
  sefaz: {
    nomeOrgao: 'SEFAZ-BA',
    nomeOficial: 'SECRETARIA DA FAZENDA DO ESTADO DA BAHIA',
    autoridade: 'Sr. Auditor Fiscal — Diretoria de Tributacao/BA',
    autoridadeOficial: 'ILMO. SR. INSPETOR FAZENDARIO',
    cadastroEstadual: 'CAD-ICMS/BA',
    siteUrl: 'https://www.sefaz.ba.gov.br',
    portalProcessos: 'PAC-e / RUC-e',
    canalCertificadoCredito: 'certificado_credito_metro@sefaz.ba.gov.br (DAT METRO e COPEC)',
  },
  baseLegal: {
    ricms: 'RICMS/BA — Decreto 13.780/2012 (Art. 317)',
    resolucoesRelevantes: ['Tabela 5.5 EFD: BA01, BA05, BA09, BA10'],
  },
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: false,
    pagamentoFornecedores: false,
    pagamentoAtivoImobilizado: false,
    ressarcimentoMoeda: false,
  },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
  prazos: { decadencia: '5 anos' },
};

const MT: StateRule = {
  uf: 'MT',
  nome: 'Mato Grosso',
  regiao: 'CO',
  status: 'covered',
  tier: 'B',
  pibPct: 2.3,
  sefaz: {
    nomeOrgao: 'SEFAZ-MT',
    nomeOficial: 'SECRETARIA DE ESTADO DE FAZENDA DE MATO GROSSO',
    autoridade: 'Sr. Auditor Fiscal — Superintendencia de Atendimento ao Contribuinte/MT',
    autoridadeOficial: 'ILMO. SR. SUPERINTENDENTE DE NORMAS DA RECEITA PUBLICA',
    cadastroEstadual: 'CCE/MT',
    siteUrl: 'https://www.sefaz.mt.gov.br',
    portalProcessos: 'e-Process / DT-e',
  },
  baseLegal: {
    ricms: 'RICMS/MT — Decreto 2.212/2014',
  },
  utilizacao: {
    compensacaoProprio: true,
    transferenciaMesmoTitular: true,
    transferenciaTerceiros: true,
    pagamentoFornecedores: false,
    pagamentoAtivoImobilizado: false,
    ressarcimentoMoeda: false,
  },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
  prazos: { decadencia: '5 anos' },
};

// ============================================================
// PLANNED (5) — proximos a entrar (Onda Sefaz 1)
// Estrutura minima preenchida para nao quebrar tipagem;
// detalhamento completo na proxima sessao.
// ============================================================

const PE: StateRule = {
  uf: 'PE', nome: 'Pernambuco', regiao: 'NE', status: 'planned', tier: 'B', pibPct: 2.8,
  sefaz: {
    nomeOrgao: 'SEFAZ-PE',
    autoridade: 'Sr. Auditor Fiscal — Diretoria Geral de Operacoes/PE',
    siteUrl: 'https://www.sefaz.pe.gov.br',
    portalProcessos: 'e-Fisco / ARE Virtual',
  },
  baseLegal: { ricms: 'RICMS/PE — Decreto 44.650/2017' },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
};

const CE: StateRule = {
  uf: 'CE', nome: 'Ceara', regiao: 'NE', status: 'planned', tier: 'B', pibPct: 2.1,
  sefaz: {
    nomeOrgao: 'SEFAZ-CE',
    autoridade: 'Sr. Auditor Fiscal — Coordenadoria de Tributacao/CE',
    siteUrl: 'https://www.sefaz.ce.gov.br',
    portalProcessos: 'SITRAM',
  },
  baseLegal: { ricms: 'RICMS/CE — Decreto 33.327/2019' },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
};

const MA: StateRule = {
  uf: 'MA', nome: 'Maranhao', regiao: 'NE', status: 'planned', tier: 'B', pibPct: 1.4,
  sefaz: {
    nomeOrgao: 'SEFAZ-MA',
    autoridade: 'Sr. Auditor Fiscal — Receita Estadual/MA',
    siteUrl: 'https://portal.sefaz.ma.gov.br',
  },
  baseLegal: { ricms: 'RICMS/MA — Decreto 19.714/2003' },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
};

const ES: StateRule = {
  uf: 'ES', nome: 'Espirito Santo', regiao: 'SE', status: 'planned', tier: 'B', pibPct: 2.0,
  sefaz: {
    nomeOrgao: 'SEFAZ-ES',
    nomeOficial: 'SECRETARIA DE ESTADO DA FAZENDA DO ESPIRITO SANTO',
    autoridade: 'Sr. Auditor Fiscal — Subsecretaria da Receita/ES',
    autoridadeOficial: 'ILMO. SR. SUBSECRETARIO DE ESTADO DA RECEITA',
    cadastroEstadual: 'Cadastro de Contribuintes ICMS/ES',
    siteUrl: 'https://internet.sefaz.es.gov.br',
    portalProcessos: 'e-Docs',
  },
  baseLegal: { ricms: 'RICMS/ES — Decreto 1.090-R/2002' },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
};

const GO: StateRule = {
  uf: 'GO', nome: 'Goias', regiao: 'CO', status: 'planned', tier: 'B', pibPct: 2.7,
  sefaz: {
    nomeOrgao: 'SEFAZ-GO',
    autoridade: 'Sr. Auditor Fiscal — Superintendencia de Politica Tributaria/GO',
    siteUrl: 'https://www.economia.go.gov.br',
  },
  baseLegal: { ricms: 'RICMS/GO — Decreto 4.852/1997' },
  procuracao: { requerInstrumentoProprio: false, aceitaProcuracaoGenerica: true },
};

// ============================================================
// PENDING (14) — entrada futura, registrados apenas para
// aparecerem no mapa de cobertura.
// ============================================================

function pending(uf: string, nome: string, regiao: Regiao, pibPct: number, tier: StateTier = 'C'): StateRule {
  return {
    uf, nome, regiao, status: 'pending', tier, pibPct,
    sefaz: {
      nomeOrgao: `SEFAZ-${uf}`,
      autoridade: `Sr. Auditor Fiscal — SEFAZ/${uf}`,
    },
    baseLegal: { leiComplementar: 'LC 87/1996' },
  };
}

const DF = pending('DF', 'Distrito Federal',     'CO',  3.6, 'B');
const MS = pending('MS', 'Mato Grosso do Sul',   'CO',  1.5, 'B');
const AL = pending('AL', 'Alagoas',              'NE',  0.8);
const SE = pending('SE', 'Sergipe',              'NE',  0.6);
const RN = pending('RN', 'Rio Grande do Norte',  'NE',  1.0);
const PB = pending('PB', 'Paraiba',              'NE',  1.0);
const PI = pending('PI', 'Piaui',                'NE',  0.7);
const AM = pending('AM', 'Amazonas',             'N',   1.6, 'B');
const PA = pending('PA', 'Para',                 'N',   2.2, 'B');
const RO = pending('RO', 'Rondonia',             'N',   0.7);
const RR = pending('RR', 'Roraima',              'N',   0.2);
const AP = pending('AP', 'Amapa',                'N',   0.2);
const AC = pending('AC', 'Acre',                 'N',   0.2);
const TO = pending('TO', 'Tocantins',            'N',   0.6);

// ============================================================
// EXPORT
// ============================================================

export const STATE_RULES: Record<string, StateRule> = {
  // covered
  SP, RJ, MG, RS, PR, SC, BA, MT,
  // planned
  PE, CE, MA, ES, GO,
  // pending
  DF, MS, AL, SE, RN, PB, PI, AM, PA, RO, RR, AP, AC, TO,
};

export const ALL_UFS: string[] = Object.keys(STATE_RULES);
