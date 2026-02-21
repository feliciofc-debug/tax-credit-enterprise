import { logger } from '../utils/logger';

const ATOM = {
  razaoSocial: 'ATOM BRASIL DIGITAL LTDA',
  cnpj: '22.003.550/0001-05',
  endereco: 'Rua Arthur Possolo 50/SL102, Recreio dos Bandeirantes, Rio de Janeiro/RJ',
  representante: 'Felicio Frauches Carega',
  cpf: '005.309.447-66',
  cargo: 'Socio-Administrador',
} as const;

export interface ProcurationParams {
  type: 'particular' | 'ecac_guide' | 'sefaz';
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
    case 'sefaz':
      return generateSefaz(params);
    default:
      logger.warn(`Tipo de procuracao desconhecido: ${type}`);
      return generateParticular(params);
  }
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
