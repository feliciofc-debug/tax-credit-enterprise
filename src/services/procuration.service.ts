import { logger } from '../utils/logger';

const ATOM = {
  razaoSocial: 'ATOM BRASIL DIGITAL LTDA',
  cnpj: '22.003.550/0001-05',
  endereco: 'Rua Arthur Possolo 50/SL102, Recreio dos Bandeirantes, Rio de Janeiro/RJ',
  representante: 'Felicio Frauches Carega',
  cpf: '005.309.447-66',
  cargo: 'Socio-Administrador',
} as const;

// ============================================================
// PRESETS DE PROCURACAO ELETRONICA (e-CAC PJ → Procurador PJ)
// ============================================================
//
// Cada preset descreve um Procurador (escritorio contabil/tributario)
// que recebe outorga via e-CAC pelo cliente final.
//
// O preset CONSULTRI segue o documento oficial
// "Passo a Passo - Procuracao Eletronica para MOT - CONSULTRI - JUN2025"
// e contem a lista canonica dos 45 poderes a serem marcados no CAV.
// ============================================================

export type ProcuracaoPresetKey = 'consultri' | 'atom';

export interface ProcuracaoPreset {
  key: ProcuracaoPresetKey;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  prazoMeses: number;
  versaoDoc: string;
  poderes: string[];
}

/**
 * Preset CONSULTRI — CONSULTORIA E ANALISES TRIBUTARIAS - CONSULTRIBR
 * Fonte: "Passo a Passo - Procuracao Eletronica para MOT - CONSULTRI - JUN2025.pdf"
 */
export const CONSULTRI_PRESET: ProcuracaoPreset = {
  key: 'consultri',
  razaoSocial: 'CONSULTORIA E ANALISES TRIBUTARIAS - CONSULTRIBR',
  nomeFantasia: 'CONSULTRI',
  cnpj: '27.591.029/0001-41',
  prazoMeses: 12,
  versaoDoc: 'JUN2025',
  poderes: [
    'E-social - Download',
    'E-social - Download Domestico',
    'E-social - Grupo Acesso WEB',
    'E-social - Grupo Desligamento',
    'E-social - Grupo Especial',
    'E-social - Grupo Preliminar',
    'E-social - Grupo Rotinas',
    'E-social - Grupo SST',
    'Acessar o sistema DCTFWeb',
    'Acessar o Programa Especial de Regularizacao Tributaria - PERT',
    'Acessar o Programa Especial de Regularizacao Tributaria - PERT - Debito Previdenciario',
    'Acessar PER/DCOMP WEB',
    'Aplicacoes PGFN - Parcelamento Simplificado',
    'Caixa Postal - Mensagens',
    'CHATRFB - Todos os servicos disponiveis no canal de atendimento',
    'Copia de Declaracao',
    'Declaracoes - DCTF (Acesso ao conteudo da declaracao, extrato e 2a via do recibo)',
    'Declaracoes - DIPJ/PJ Simplificada (Acesso ao conteudo da declaracao, extrato e 2a via do recibo)',
    'Declaracoes - DIRF (Acesso ao conteudo da declaracao, extrato e 2a via do recibo)',
    'Download da Escrituracao Contabil Digital (SPED-ECD) utilizando o Receitanet Bx',
    'Download da Escrituracao Fiscal Digital (SPED-EFD) utilizando o Receitanet Bx',
    'Download de EFD-PIS/Cofins atraves do ReceitaNetBX',
    'Download dos arquivos SPED Dados Agregados e Termos da ECD utilizando o ReceitanetBx',
    'Fontes Pagadoras',
    'Intimacao DCTF',
    'Pagamento e Parcelamento Lei n 12.996/2014',
    'Pagamentos - Comprovante de Arrecadacao',
    'Parcelamento - Solicitar e Acompanhar',
    'Parcelamento de Debitos',
    'Parcelamento Especial - Opcoes da Lei 11.941/2009',
    'Parcelamento Simplificado Previdenciario',
    'Parcelamento Simplificado Previdenciario DAU',
    'Processos Digitais',
    'Programa de Regularizacao Tributaria - Debitos Previdenciarios',
    'Programa de Regularizacao Tributaria - Demais Debitos',
    'PER/DCOMP - Consulta Analise Preliminar/Autorregularizacao',
    'PER/DCOMP - Consulta Despacho Decisorio',
    'PER/DCOMP - Consulta Intimacao',
    'PER/DCOMP - Consulta Processamento',
    'PGF - Consulta Debitos inscritos a partir de 01/11/2012',
    'PGFN - Consulta Debitos inscritos a partir de 01/11/2012',
    'Reabertura Pagamento e Parcelamento Lei n 11.941/09',
    'Situacao Fiscal do Contribuinte',
    'SPED ECD - Central de Balancos',
    'SPED-ECF (Escrituracao Contabil Fiscal)',
    'SPED-ECF-Download - Download via ReceitanetBX da Escrituracao Contabil Fiscal',
  ],
};

/**
 * Preset ATOM/TaxCredit Enterprise (procurador interno).
 * Espelha o CONSULTRI nos poderes mas com CNPJ proprio.
 */
export const ATOM_PRESET: ProcuracaoPreset = {
  key: 'atom',
  razaoSocial: ATOM.razaoSocial,
  nomeFantasia: 'TaxCredit Enterprise',
  cnpj: ATOM.cnpj,
  prazoMeses: 24,
  versaoDoc: 'v1',
  poderes: CONSULTRI_PRESET.poderes, // mesmo escopo operacional
};

const PRESETS: Record<ProcuracaoPresetKey, ProcuracaoPreset> = {
  consultri: CONSULTRI_PRESET,
  atom: ATOM_PRESET,
};

export function getProcuracaoPreset(key: string): ProcuracaoPreset | null {
  return PRESETS[key as ProcuracaoPresetKey] || null;
}

export function listProcuracaoPresets(): ProcuracaoPreset[] {
  return Object.values(PRESETS);
}

/**
 * Calcula o "diff" entre os poderes outorgados (retorno SERPRO OBTERPROCURACAO41)
 * e os poderes requeridos pelo preset.
 *
 * SERPRO retorna estrutura `{ procuracoes: [{ servico, ... }] }` ou similar; aqui
 * normalizamos pelo nome textual contendo substrings caracteristicas.
 */
export function diffPoderes(
  presetKey: string,
  serproResposta: any,
): { granted: string[]; missing: string[]; extras: string[] } {
  const preset = getProcuracaoPreset(presetKey);
  if (!preset) return { granted: [], missing: [], extras: [] };

  // SERPRO pode devolver "servicos" / "poderes" / "atos" — varremos em profundidade
  const grantedRaw: string[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node === 'object') {
      for (const v of Object.values(node)) visit(v);
      if (typeof (node as any).servico === 'string') grantedRaw.push((node as any).servico);
      if (typeof (node as any).descricao === 'string') grantedRaw.push((node as any).descricao);
      if (typeof (node as any).nome === 'string') grantedRaw.push((node as any).nome);
    }
  };
  visit(serproResposta);
  const grantedSet = new Set(grantedRaw.map(normalize));

  const granted: string[] = [];
  const missing: string[] = [];
  for (const poder of preset.poderes) {
    const norm = normalize(poder);
    const found = Array.from(grantedSet).some(g => g.includes(norm) || norm.includes(g));
    if (found) granted.push(poder);
    else missing.push(poder);
  }

  const extras: string[] = [];
  for (const g of grantedRaw) {
    const norm = normalize(g);
    const inPreset = preset.poderes.some(p => normalize(p).includes(norm) || norm.includes(normalize(p)));
    if (!inPreset) extras.push(g);
  }

  return { granted, missing, extras };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ProcurationParams {
  type: 'particular' | 'ecac_guide' | 'sefaz' | 'ecac_preset';
  lawyerScenario: 'atom_lawyer' | 'partner_lawyer' | 'client_lawyer';
  clienteNome: string;
  clienteCnpj: string;
  clienteEndereco: string;
  representanteNome: string;
  representanteCpf: string;
  representanteRg?: string;
  representanteCargo?: string;
  advogadoNome?: string;
  advogadoOab?: string;
  advogadoCpf?: string;
  advogadoEndereco?: string;
  uf?: string;
  prazoAnos?: number;
  poderes?: string[];
  cidade?: string;
  data?: string;
  presetKey?: ProcuracaoPresetKey; // novo: gera guia baseado em preset
}

const DEFAULT_PODERES = [
  'Acessar o Centro Virtual de Atendimento ao Contribuinte (e-CAC) e o Portal de Servicos da Receita Federal, em nome do OUTORGANTE',
  'Consultar a situacao fiscal, debitos, creditos, processos administrativos e pendencias',
  'Transmitir Pedido de Restituicao, Ressarcimento ou Reembolso e Declaracao de Compensacao (PER/DCOMP)',
  'Retificar declaracoes e escrituracoes fiscais (SPED EFD ICMS/IPI, EFD Contribuicoes, ECF, ECD, DCTF, DCTF-Web)',
  'Protocolar processos administrativos, pedidos de habilitacao de creditos, pedidos de ressarcimento e restituicao',
  'Realizar compensacoes tributarias administrativas',
  'Impugnar autos de infracao e apresentar manifestacoes de inconformidade e recursos administrativos',
  'Solicitar parcelamentos e transacoes tributarias',
  'Acompanhar e peticionar em processos administrativos perante o CARF e Delegacias de Julgamento',
  'Representar o OUTORGANTE perante a SEFAZ para fins de pedido de ressarcimento e transferencia de creditos de ICMS',
  'Praticar todos os atos necessarios ao fiel cumprimento deste mandato, inclusive substabelecer com ou sem reserva de poderes',
];

export function generateProcurationDocument(params: ProcurationParams): string {
  const { type } = params;
  switch (type) {
    case 'particular':
      return generateParticular(params);
    case 'ecac_guide':
      return generateEcacGuide(params);
    case 'ecac_preset':
      return generateEcacPresetGuide(params);
    case 'sefaz':
      return generateSefaz(params);
    default:
      logger.warn(`Tipo de procuracao desconhecido: ${type}`);
      return generateParticular(params);
  }
}

/**
 * Guia passo a passo para o cliente outorgar procuracao eletronica PJ -> PJ
 * no e-CAC, com base em um PRESET (ex.: CONSULTRI). Reflete o documento
 * oficial JUN2025 do parceiro, com checklist exato dos poderes a marcar.
 */
function generateEcacPresetGuide(p: ProcurationParams): string {
  const preset = getProcuracaoPreset(p.presetKey || 'consultri');
  if (!preset) {
    logger.warn(`Preset desconhecido: ${p.presetKey}`);
    return generateEcacGuide(p);
  }
  const poderesChecklist = preset.poderes.map(pod => `   [ ] ${pod}`).join('\n');

  return `=============================================================================
GUIA - PROCURACAO ELETRONICA e-CAC -> ${preset.nomeFantasia}
=============================================================================
Documento de referencia: ${preset.nomeFantasia} ${preset.versaoDoc}
Procurador: ${preset.razaoSocial}
CNPJ Procurador: ${preset.cnpj}
Vigencia sugerida: ${preset.prazoMeses} meses
=============================================================================

Prezado(a) representante legal de ${p.clienteNome},

Para que ${preset.nomeFantasia} possa acessar em seu nome os sistemas da
Receita Federal e operar a recuperacao tributaria, intimacoes e
declaracoes, e necessario conceder uma procuracao eletronica no CAV/e-CAC.

=============================================================================
PRE-REQUISITOS
=============================================================================
  - Certificado Digital (e-CNPJ A1 ou A3) da empresa ${p.clienteCnpj} instalado
  - Java atualizado (o assinador SERPRO baixa um arquivo .jnlp)
  - Navegador moderno (Chrome ou Edge recomendado)

=============================================================================
PASSO A PASSO (resumo dos 8 passos oficiais)
=============================================================================

1) Acesse https://cav.receita.fazenda.gov.br/autenticacao/login
   - Clique em "Entrar com gov.br" e depois em "Seu certificado digital"
   - Selecione o certificado da empresa e digite o PIN

2) Dentro do e-CAC, acesse:
   "Senhas e Procuracoes" -> "Cadastro, Consulta e Procuracao e-CAC"
   -> "Cadastrando Procuracao"

3) No formulario:
   - Outorgante: ja preenchido com sua empresa (${p.clienteCnpj})
   - Dados do Procurador -> selecione "Pessoa Juridica"
   - CNPJ do Procurador: ${preset.cnpj}
   - O nome sera preenchido automaticamente:
       ${preset.razaoSocial}

4) Em "Dados da Procuracao":
   - Data-fim da vigencia: ${preset.prazoMeses} meses a partir de hoje

5) Marque OBRIGATORIAMENTE os seguintes poderes (checklist):

${poderesChecklist}

6) Clique em "Cadastrar Procuracao".
   - O sistema fara o download do assinador SERPRO (.jnlp)
   - Execute o arquivo via Java e clique em "Assinar"
   - Digite novamente o PIN do certificado

7) Pronto! A procuracao esta cadastrada e ativa imediatamente.

8) Avise ${preset.nomeFantasia} (ou utilize o botao "Verificar agora" na
   plataforma TaxCredit) para que a ativacao seja confirmada via SERPRO
   Integra Contador. Em seguida, ja podemos consumir Caixa Postal,
   DCTFWeb, Situacao Fiscal, PER/DCOMP e os SPED automaticamente.

=============================================================================
IMPORTANTE
=============================================================================
  - Em caso de duvida na execucao do assinador (.jnlp), atualize o Java
    (https://www.java.com/pt-BR/download/) e tente novamente.
  - A procuracao pode ser revogada a qualquer momento por voce no proprio
    e-CAC, na aba "Procuracoes ativas".
  - A plataforma TaxCredit verificara a vigencia automaticamente e
    notificara 60, 30 e 7 dias antes do vencimento para renovacao.

${preset.nomeFantasia} - via TaxCredit Enterprise
=============================================================================
`;
}

function generateParticular(p: ProcurationParams): string {
  const prazo = p.prazoAnos || 2;
  const poderes = p.poderes && p.poderes.length > 0 ? p.poderes : DEFAULT_PODERES;
  const dataStr = p.data || new Date().toLocaleDateString('pt-BR');
  const cidade = p.cidade || 'Rio de Janeiro';
  const hasAdv = p.advogadoNome && p.advogadoOab;

  let poderesText = poderes.map((poder, i) => `${String.fromCharCode(97 + i)}) ${poder};`).join('\n\n');

  let outorgados = `1) ${ATOM.razaoSocial}
   CNPJ: ${ATOM.cnpj}
   Endereco: ${ATOM.endereco}
   Representante: ${ATOM.representante}, CPF ${ATOM.cpf}`;

  if (hasAdv) {
    outorgados += `

2) ${p.advogadoNome}
   OAB: ${p.advogadoOab}${p.advogadoCpf ? `\n   CPF: ${p.advogadoCpf}` : ''}${p.advogadoEndereco ? `\n   Endereco: ${p.advogadoEndereco}` : ''}`;
  }

  return `=============================================================================
PROCURACAO PARTICULAR — REPRESENTACAO ADMINISTRATIVA
=============================================================================

OUTORGANTE:
${p.clienteNome}
CNPJ: ${p.clienteCnpj}
Endereco: ${p.clienteEndereco}
Representante Legal: ${p.representanteNome}, portador do CPF n° ${p.representanteCpf}${p.representanteRg ? ` e RG n° ${p.representanteRg}` : ''}${p.representanteCargo ? `, ${p.representanteCargo}` : ''}

OUTORGADO(S):

${outorgados}

=============================================================================
PODERES
=============================================================================

O(a) OUTORGANTE confere ao(s) OUTORGADO(S), em conjunto ou separadamente, os mais amplos poderes para representa-lo(a) perante a Secretaria Especial da Receita Federal do Brasil (RFB), Secretarias de Fazenda Estaduais (SEFAZ), Procuradoria-Geral da Fazenda Nacional (PGFN), Conselho Administrativo de Recursos Fiscais (CARF), e quaisquer outros orgaos federais, estaduais e municipais, especificamente para:

${poderesText}

=============================================================================
PRAZO DE VALIDADE
=============================================================================

Esta procuracao e valida pelo prazo de ${prazo} (${prazo === 1 ? 'um' : 'dois'}) ano${prazo > 1 ? 's' : ''} a contar desta data, podendo ser revogada a qualquer tempo mediante comunicacao por escrito.

${cidade}, ${dataStr}


_______________________________________________
${p.representanteNome}
${p.representanteCargo || 'Representante Legal'}
${p.clienteNome}
CNPJ: ${p.clienteCnpj}

(Firma reconhecida em cartorio)
`;
}

function generateEcacGuide(p: ProcurationParams): string {
  const hasAdv = p.advogadoNome && p.advogadoCpf;

  let procuradores = `1) ${ATOM.representante} — CPF: ${ATOM.cpf}`;
  if (hasAdv) {
    procuradores += `\n2) ${p.advogadoNome} — CPF: ${p.advogadoCpf}`;
  }

  return `=============================================================================
GUIA — COMO CONCEDER PROCURACAO ELETRONICA NO e-CAC
=============================================================================

Prezado(a) representante legal de ${p.clienteNome},

Para que possamos dar andamento a recuperacao dos creditos tributarios da empresa, e necessario conceder uma Autorizacao de Acesso (procuracao eletronica) no sistema da Receita Federal.

=============================================================================
DADOS DO(S) PROCURADOR(ES)
=============================================================================

${procuradores}

=============================================================================
SERVICOS A AUTORIZAR
=============================================================================

[X] Todos os servicos disponiveis (recomendado)

OU, no minimo:
[X] Copia de declaracoes/Declaracao de Compensacao
[X] Certidoes fiscais e situacao fiscal
[X] PER/DCOMP (Pedido de Restituicao e Compensacao)
[X] Processos Digitais
[X] Parcelamentos

PRAZO SUGERIDO: ${p.prazoAnos || 2} anos

=============================================================================
PASSO A PASSO
=============================================================================

1. Acesse: https://cav.receita.fazenda.gov.br

2. Faca login com:
   - Certificado Digital (e-CNPJ) da empresa, OU
   - Conta Gov.br nivel Prata ou Ouro do responsavel legal

3. Clique em "Minhas Autorizacoes de Acesso"

4. Na aba "Concedidas", clique em "Conceder nova autorizacao"

5. Informe o CPF do procurador: ${ATOM.cpf}
${hasAdv ? `\n6. Repita o processo para o CPF: ${p.advogadoCpf}\n` : ''}
6. Selecione os servicos autorizados (marcar todos)

7. Defina o prazo: ${p.prazoAnos || 2} anos

8. Confirme e finalize

=============================================================================
IMPORTANTE
=============================================================================

Apos conceder a autorizacao, o procurador precisara ACEITAR no sistema dele (aba "Recebidas"). So apos o aceite a procuracao passa a valer.

Se tiver dificuldade, entre em contato que orientamos por telefone ou videoconferencia.

${ATOM.razaoSocial} — TaxCredit Enterprise
WhatsApp: (21) 96752-0706
`;
}

function generateSefaz(p: ProcurationParams): string {
  const prazo = p.prazoAnos || 2;
  const uf = p.uf || 'RJ';
  const poderes = p.poderes && p.poderes.length > 0 ? p.poderes : DEFAULT_PODERES;
  const dataStr = p.data || new Date().toLocaleDateString('pt-BR');
  const cidade = p.cidade || 'Rio de Janeiro';
  const hasAdv = p.advogadoNome && p.advogadoOab;

  let outorgados = `1) ${ATOM.razaoSocial}
   CNPJ: ${ATOM.cnpj}
   Endereco: ${ATOM.endereco}
   Representante: ${ATOM.representante}, CPF ${ATOM.cpf}`;

  if (hasAdv) {
    outorgados += `

2) ${p.advogadoNome}
   OAB: ${p.advogadoOab}${p.advogadoCpf ? `\n   CPF: ${p.advogadoCpf}` : ''}${p.advogadoEndereco ? `\n   Endereco: ${p.advogadoEndereco}` : ''}`;
  }

  const poderesFiltered = poderes.filter(p =>
    p.toLowerCase().includes('sefaz') ||
    p.toLowerCase().includes('icms') ||
    p.toLowerCase().includes('todos os atos') ||
    p.toLowerCase().includes('ressarcimento') ||
    p.toLowerCase().includes('transferencia') ||
    p.toLowerCase().includes('protocolar') ||
    p.toLowerCase().includes('impugnar') ||
    p.toLowerCase().includes('compensac')
  );
  const poderesFinais = poderesFiltered.length >= 3 ? poderesFiltered : poderes;
  const poderesText = poderesFinais.map((poder, i) => `${String.fromCharCode(97 + i)}) ${poder};`).join('\n\n');

  return `=============================================================================
PROCURACAO PARTICULAR — REPRESENTACAO PERANTE SEFAZ/${uf}
=============================================================================

OUTORGANTE:
${p.clienteNome}
CNPJ: ${p.clienteCnpj}
Endereco: ${p.clienteEndereco}
Representante Legal: ${p.representanteNome}, portador do CPF n° ${p.representanteCpf}${p.representanteRg ? ` e RG n° ${p.representanteRg}` : ''}${p.representanteCargo ? `, ${p.representanteCargo}` : ''}

OUTORGADO(S):

${outorgados}

=============================================================================
PODERES ESPECIFICOS PARA SEFAZ/${uf}
=============================================================================

O(a) OUTORGANTE confere ao(s) OUTORGADO(S), em conjunto ou separadamente, poderes especificos para representa-lo(a) perante a Secretaria de Estado de Fazenda de ${uf} (SEFAZ/${uf}), para:

${poderesText}

=============================================================================
PRAZO DE VALIDADE
=============================================================================

Esta procuracao e valida pelo prazo de ${prazo} (${prazo === 1 ? 'um' : 'dois'}) ano${prazo > 1 ? 's' : ''} a contar desta data, podendo ser revogada a qualquer tempo mediante comunicacao por escrito.

${cidade}, ${dataStr}


_______________________________________________
${p.representanteNome}
${p.representanteCargo || 'Representante Legal'}
${p.clienteNome}
CNPJ: ${p.clienteCnpj}

(Firma reconhecida em cartorio)
`;
}
