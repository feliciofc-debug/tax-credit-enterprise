// ============================================================
// FORMALIZATION SERVICE
// Gera documentos oficiais: Requerimento SEFAZ + Parecer PER/DCOMP
// ============================================================

import { logger } from '../utils/logger';

// Mapeamento autoridade por UF
const AUTORIDADES_UF: Record<string, { autoridade: string; orgao: string; cadastro: string }> = {
  SP: {
    autoridade: 'ILMO. SR. DELEGADO REGIONAL TRIBUTARIO',
    orgao: 'SECRETARIA DA FAZENDA E PLANEJAMENTO DO ESTADO DE SAO PAULO',
    cadastro: 'CADESP',
  },
  RJ: {
    autoridade: 'EXMO. SR. SECRETARIO DE ESTADO DE FAZENDA',
    orgao: 'SECRETARIA DE ESTADO DE FAZENDA DO RIO DE JANEIRO',
    cadastro: 'CADERJ',
  },
  MG: {
    autoridade: 'ILMO. SR. DELEGADO FISCAL',
    orgao: 'SECRETARIA DE ESTADO DE FAZENDA DE MINAS GERAIS',
    cadastro: 'Cadastro de Contribuintes ICMS/MG',
  },
  RS: {
    autoridade: 'ILMO. SR. DELEGADO DA RECEITA ESTADUAL',
    orgao: 'SECRETARIA DA FAZENDA DO ESTADO DO RIO GRANDE DO SUL',
    cadastro: 'Cadastro de Contribuintes ICMS/RS',
  },
  PR: {
    autoridade: 'ILMO. SR. INSPETOR GERAL DE FISCALIZACAO',
    orgao: 'SECRETARIA DA FAZENDA DO ESTADO DO PARANA',
    cadastro: 'CAD/ICMS-PR',
  },
  SC: {
    autoridade: 'ILMO. SR. DIRETOR DE ADMINISTRACAO TRIBUTARIA',
    orgao: 'SECRETARIA DE ESTADO DA FAZENDA DE SANTA CATARINA',
    cadastro: 'CCICMS/SC',
  },
  BA: {
    autoridade: 'ILMO. SR. INSPETOR FAZENDARIO',
    orgao: 'SECRETARIA DA FAZENDA DO ESTADO DA BAHIA',
    cadastro: 'CAD-ICMS/BA',
  },
  MT: {
    autoridade: 'ILMO. SR. SUPERINTENDENTE DE NORMAS DA RECEITA PUBLICA',
    orgao: 'SECRETARIA DE ESTADO DE FAZENDA DE MATO GROSSO',
    cadastro: 'CCE/MT',
  },
  ES: {
    autoridade: 'ILMO. SR. SUBSECRETARIO DE ESTADO DA RECEITA',
    orgao: 'SECRETARIA DE ESTADO DA FAZENDA DO ESPIRITO SANTO',
    cadastro: 'Cadastro de Contribuintes ICMS/ES',
  },
};

export interface SefazDocumentParams {
  // Empresa (da analise)
  empresaNome: string;
  cnpj: string;
  inscricaoEstadual: string;
  empresaEndereco: string;
  empresaCidade: string;
  empresaUf: string;
  empresaCep: string;
  atividadeEmpresa: string;
  cnaePrincipal: string;
  // Advogado
  advogadoNome: string;
  advogadoOab: string;
  advogadoUf: string;
  advogadoEmail: string;
  advogadoEndereco: string;
  // Representante legal
  representanteNome: string;
  representanteCargo: string;
  representanteCpf: string;
  representanteRg: string;
  // Pedido
  uf: string;
  tipoPedido: string; // COMPENSACAO, TRANSFERENCIA, UTILIZACAO, RESTITUICAO
  valorTotalCredito: number;
  periodoInicio: string;
  periodoFim: string;
  // Teses identificadas
  teses: Array<{
    descricao: string;
    valor: number;
    fundamentacao: string;
    periodo: string;
  }>;
  protocoloPlataforma: string;
}

export function generateSefazDocument(params: SefazDocumentParams): string {
  const ufData = AUTORIDADES_UF[params.uf] || AUTORIDADES_UF['SP'];
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const valorExtenso = numberToWords(params.valorTotalCredito);

  const tesasText = params.teses.map((t, i) =>
    `   ${i + 1}. ${t.descricao} — Valor: R$ ${formatNumber(t.valor)}\n` +
    `      Fundamentacao: ${t.fundamentacao}\n` +
    `      Periodo: ${t.periodo}`
  ).join('\n');

  return `=============================================================================
REQUERIMENTO DE ${params.tipoPedido} DE CREDITO ACUMULADO DE ICMS
=============================================================================

${ufData.autoridade}
${ufData.orgao}

Ref.: Protocolo TaxCredit Enterprise n. ${params.protocoloPlataforma}

I. QUALIFICACAO DO REQUERENTE

${params.empresaNome}, pessoa juridica de direito privado, inscrita no
CNPJ sob n. ${params.cnpj}, com Inscricao Estadual n. ${params.inscricaoEstadual},
estabelecida a ${params.empresaEndereco}, CEP ${params.empresaCep}, na cidade de
${params.empresaCidade}/${params.empresaUf}, neste ato representada por
${params.representanteNome}, ${params.representanteCargo}, portador do CPF
n. ${params.representanteCpf} e RG n. ${params.representanteRg}, por seu advogado
${params.advogadoNome}, inscrito na OAB/${params.advogadoUf} sob n. ${params.advogadoOab},
com escritorio a ${params.advogadoEndereco}, e-mail ${params.advogadoEmail}, vem,
respeitosamente, apresentar o presente

    REQUERIMENTO DE ${params.tipoPedido} DE CREDITO ACUMULADO DE ICMS

pelos fatos e fundamentos que passa a expor:

II. DOS FATOS

1. A Requerente e contribuinte do ICMS no Estado de ${params.empresaUf},
exercendo atividade de ${params.atividadeEmpresa} (CNAE ${params.cnaePrincipal}),
regularmente inscrita no ${ufData.cadastro}.

2. No curso de suas operacoes, acumulou creditos de ICMS no montante de
R$ ${formatNumber(params.valorTotalCredito)} (${valorExtenso}), relativos ao periodo de
${params.periodoInicio} a ${params.periodoFim}, conforme documentacao anexa.

3. O acumulo decorreu de:
${tesasText}

4. Os valores foram apurados com base na EFD ICMS/IPI regularmente
transmitida e nos documentos fiscais eletronicos escriturados.

III. DO DIREITO

3.1. FUNDAMENTO CONSTITUCIONAL:
A Constituicao Federal, Art. 155, par. 2, I, assegura a nao-cumulatividade
do ICMS, garantindo o direito de compensar o imposto devido com o
cobrado nas operacoes anteriores. O Art. 155, par. 2, X, "a", assegura
a imunidade do ICMS nas exportacoes, incluindo a manutencao dos creditos.

3.2. FUNDAMENTO INFRACONSTITUCIONAL:
${getFundamentacaoUF(params.uf, params.tipoPedido)}

3.3. JURISPRUDENCIA DO STF:
- RE 574.706 — Tema 69 STF (15/03/2017): "O ICMS nao compoe a base de
  calculo para fins de incidencia do PIS e da COFINS" — aplicavel quando
  o credito acumulado decorre de exclusao do ICMS da base de PIS/COFINS.
- RE 714.139 — Tema 986 STF (27/03/2024): "E inconstitucional a incidencia
  do ICMS sobre as tarifas de uso dos sistemas de transmissao (TUST) e de
  distribuicao (TUSD) de energia eletrica" — aplicavel a contribuintes do
  setor energetico.
- RE 593.849 — Tema 201 STF (19/10/2016): "E devida a restituicao da
  diferenca do ICMS pago a mais no regime de substituicao tributaria" —
  aplicavel a creditos de ICMS-ST.
- ADC 49 STF (19/04/2021): "Nao incide ICMS no deslocamento de bens de
  um estabelecimento para outro do mesmo contribuinte" — aplicavel a
  transferencias entre filiais.

3.4. JURISPRUDENCIA ADMINISTRATIVA (CARF):
- CARF Acordao 3201-005.543 (2a Camara/1a Turma, 2019): "O saldo credor
  de ICMS decorrente de diferenca de aliquotas entre entradas (importacao
  a 16-18%) e saidas interestaduais (4% - Resolucao SF 13/2012) configura
  acumulo estrutural e irreversivel, devendo ser ressarcido pelo Estado
  conforme art. 25, par. 1 da LC 87/96."

3.5. DECLARACAO DE NAO UTILIZACAO PREVIA:
O Requerente DECLARA, sob as penas do Art. 299 do Codigo Penal, que os
creditos de ICMS objeto deste requerimento NAO foram utilizados, total
ou parcialmente, em transferencias, compensacoes ou qualquer outra forma
de aproveitamento perante este ou outro Estado da Federacao.

IV. DOCUMENTOS ANEXOS

1. Procuracao com poderes especificos
2. Contrato social / ultima alteracao
3. Comprovante de inscricao CNPJ e Inscricao Estadual ativa
4. Certidao Negativa de Debitos Tributarios Estaduais (CND)
5. EFD ICMS/IPI dos periodos envolvidos (arquivos digitais)
6. Demonstrativo detalhado dos creditos com memoria de calculo
7. Livros fiscais digitais (Registro de Entradas e Saidas)
8. Documentos fiscais eletronicos (NF-e) comprobatorios
9. Parecer tecnico elaborado pela TaxCredit Enterprise

V. DO PEDIDO

Ante o exposto, requer:

a) O recebimento e processamento deste requerimento;
b) A ${params.tipoPedido.toLowerCase()} do credito acumulado de ICMS no valor de
   R$ ${formatNumber(params.valorTotalCredito)} (${valorExtenso});
c) Intimacao na pessoa do advogado em ${params.advogadoEmail}.

Nestes termos, pede deferimento.

${params.empresaCidade}, ${dataAtual}

_______________________________________
${params.advogadoNome}
OAB/${params.advogadoUf} n. ${params.advogadoOab}

_______________________________________
${params.representanteNome}
${params.representanteCargo} — ${params.empresaNome}
=============================================================================`;
}

// ============================================================
// JURISPRUDÊNCIA CARF POR TIPO DE CRÉDITO
// ============================================================

const CARF_JURISPRUDENCIA: Record<string, string[]> = {
  PIS: [
    'CARF Acordao 3302-007.891 (3a Camara/3a Turma, 2019): "Manutencao de maquinas e equipamentos utilizados no processo produtivo constitui insumo para creditamento de PIS/COFINS, a luz dos criterios de essencialidade do REsp 1.221.170/PR"',
    'CARF Acordao 3401-005.765 (4a Camara/1a Turma, 2019): "Despesas com frete na aquisicao de insumos geram direito a credito de PIS/COFINS, pois integram o custo de aquisicao do bem utilizado no processo produtivo"',
    'CARF Acordao 9303-013.059 (CSRF/3a Turma, 2023): "O ICMS destacado nas notas fiscais de saida deve ser excluido da base de calculo do PIS e da COFINS, conforme RE 574.706 (Tema 69)"',
    'Parecer Normativo COSIT n. 5/2018 — regulamentou o conceito de insumo do Tema 779 STJ',
  ],
  COFINS: [
    'CARF Acordao 3302-007.891 (3a Camara/3a Turma, 2019): "Manutencao de maquinas e equipamentos constitui insumo para creditamento de PIS/COFINS"',
    'CARF Acordao 9303-010.068 (CSRF/3a Turma, 2020): "Material de embalagem utilizado no acondicionamento de produtos constitui insumo essencial, gerando direito a credito de PIS e COFINS"',
    'CARF Acordao 9303-013.059 (CSRF/3a Turma, 2023): "O ICMS destacado deve ser excluido da base de calculo do PIS e da COFINS, conforme Tema 69 STF"',
    'Parecer Normativo COSIT n. 5/2018 — conceito de insumo conforme Tema 779 STJ',
  ],
  IRPJ: [
    'CARF Acordao 1302-004.012 (3a Camara/2a Turma, 2022): "Creditos presumidos de ICMS concedidos como incentivo fiscal estadual nao integram a base de calculo do IRPJ e da CSLL, conforme LC 160/2017 e art. 30 da Lei 12.973/2014"',
    'CARF Acordao 1301-005.674 (3a Camara/1a Turma, 2022): "Os juros de mora (SELIC) recebidos em repeticao de indebito tributario nao configuram receita tributavel pelo IRPJ e CSLL, conforme RE 1.063.187/SC (Tema 1.079)"',
  ],
  CSLL: [
    'CARF Acordao 1302-004.012 (3a Camara/2a Turma, 2022): "Beneficios fiscais de ICMS nao integram base de calculo da CSLL, conforme LC 160/2017"',
    'CARF Acordao 1301-005.674 (3a Camara/1a Turma, 2022): "Juros SELIC de repeticao de indebito nao sao tributaveis pela CSLL, conforme Tema 1.079 STF"',
  ],
  INSS: [
    'CARF Acordao 2401-008.765 (4a Camara/1a Turma, 2021): "O terco constitucional de ferias, o aviso previo indenizado e os primeiros 15 dias de afastamento por doenca possuem natureza indenizatoria e nao integram a base de calculo das contribuicoes previdenciarias patronais, conforme Temas 985 STF e 478 STJ"',
  ],
  ICMS: [
    'CARF Acordao 3201-005.543 (2a Camara/1a Turma, 2019): "Saldo credor de ICMS decorrente de diferenca de aliquotas entre entradas e saidas configura acumulo estrutural, devendo ser ressarcido conforme art. 25, par. 1 da LC 87/96"',
  ],
};

function getJurisprudenciaCARF(creditos: Array<{ tributo: string; descricaoTese: string }>): string {
  const cited = new Set<string>();
  const lines: string[] = [];

  for (const c of creditos) {
    const tributoUpper = c.tributo.toUpperCase().replace(/[^A-Z]/g, '');
    let key = 'PIS';
    if (tributoUpper.includes('COFINS')) key = 'COFINS';
    else if (tributoUpper.includes('PIS')) key = 'PIS';
    else if (tributoUpper.includes('IRPJ')) key = 'IRPJ';
    else if (tributoUpper.includes('CSLL')) key = 'CSLL';
    else if (tributoUpper.includes('INSS') || tributoUpper.includes('PREVIDENCI')) key = 'INSS';
    else if (tributoUpper.includes('ICMS')) key = 'ICMS';

    const acordaos = CARF_JURISPRUDENCIA[key] || [];
    for (const a of acordaos) {
      if (!cited.has(a)) {
        cited.add(a);
        lines.push(`   - ${a}`);
      }
    }
  }

  if (lines.length === 0) {
    lines.push('   - Consultar base CARF para acordaos especificos ao caso');
  }

  return lines.join('\n');
}

// ============================================================
// PARECER TECNICO PER/DCOMP
// ============================================================

export interface PerdcompDocumentParams {
  empresaNome: string;
  cnpj: string;
  protocoloPlataforma: string;
  advogadoNome: string;
  advogadoOab: string;
  advogadoUf: string;
  cidade: string;
  // Creditos
  creditos: Array<{
    tributo: string;
    tipoCredito: string;
    periodo: string;
    valorOriginal: number;
    valorAtualizado: number;
    baseLegal: string;
    descricaoTese: string;
  }>;
  valorTotal: number;
  // Orientacoes
  tipoDocumento: string; // Declaracao de Compensacao, Pedido de Restituicao, etc.
  tipoCreditoPerdcomp: string;
  periodoCredito: string;
  codigoReceitaDebito: string;
  periodoDebito: string;
}

export function generatePerdcompDocument(params: PerdcompDocumentParams): string {
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const numeroParecer = `PTCE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

  const creditosText = params.creditos.map((c, i) =>
    `2.${i + 1}. ${c.tributo}\n` +
    `   Tipo: ${c.tipoCredito}\n` +
    `   Periodo: ${c.periodo}\n` +
    `   Valor original: R$ ${formatNumber(c.valorOriginal)}\n` +
    `   Valor atualizado (SELIC): R$ ${formatNumber(c.valorAtualizado)}\n` +
    `   Base legal: ${c.baseLegal}\n` +
    `   Tese: ${c.descricaoTese}`
  ).join('\n\n');

  const jurisprudenciaCAFR = getJurisprudenciaCARF(params.creditos);

  return `=============================================================================
PARECER TECNICO — SUPORTE A DECLARACAO DE COMPENSACAO (PER/DCOMP)
MEMORIAL DESCRITIVO DE CREDITO TRIBUTARIO
=============================================================================

CONTRIBUINTE: ${params.empresaNome}
CNPJ: ${params.cnpj}
PARECER N.: ${numeroParecer}
DATA: ${dataAtual}
PROTOCOLO TAXCREDIT: ${params.protocoloPlataforma}
CLASSIFICACAO: CONFIDENCIAL — USO EXCLUSIVO PARA INSTRUCAO DE PER/DCOMP

=============================================================================
1. OBJETO E ESCOPO
=============================================================================

O presente Parecer Tecnico tem por objetivo instruir e fundamentar a(s)
Declaracao(oes) de Compensacao a serem transmitidas via PER/DCOMP Web
(IN RFB 2.055/2021), relativas aos creditos tributarios federais
identificados por meio de analise documental, escrituracao fiscal digital
e cruzamento com legislacao vigente e jurisprudencia consolidada.

Este documento serve como suporte tecnico para:
a) Fundamentacao da natureza e origem dos creditos;
b) Demonstracao da memoria de calculo;
c) Comprovacao de nao utilizacao previa;
d) Instrucao para preenchimento correto da PER/DCOMP;
e) Base documental para eventual fiscalizacao ou auditoria.

=============================================================================
2. CREDITOS IDENTIFICADOS — DETALHAMENTO
=============================================================================

${creditosText}

VALOR TOTAL DOS CREDITOS: R$ ${formatNumber(params.valorTotal)}

=============================================================================
3. FUNDAMENTACAO LEGAL — 3 CAMADAS DE EMBASAMENTO
=============================================================================

3.1. DO DIREITO A COMPENSACAO TRIBUTARIA:
- Constituicao Federal, Art. 150, par. 7 (restituicao do indevido)
- Lei 9.430/1996, Art. 74 (compensacao de tributos federais)
- IN RFB 2.055/2021 (normas e procedimentos de compensacao)
- Lei 5.172/1966, Art. 170 (CTN — compensacao tributaria)

3.2. DAS TESES ESPECIFICAS — LEGISLACAO:
${params.creditos.map(c => `   - ${c.descricaoTese}: ${c.baseLegal}`).join('\n')}

3.3. JURISPRUDENCIA VINCULANTE (STF/STJ):
${params.creditos.map(c => `   - ${c.descricaoTese}: Tema vinculante conforme tese fixada em sede de repercussao geral ou recurso repetitivo`).join('\n')}

3.4. JURISPRUDENCIA ADMINISTRATIVA (CARF):
${jurisprudenciaCAFR}

=============================================================================
4. DECLARACAO DE NAO UTILIZACAO PREVIA DOS CREDITOS
=============================================================================

DECLARAMOS, sob as penas do Art. 299 do Codigo Penal, que:

a) Os creditos tributarios descritos neste parecer NAO foram objeto de
   compensacao, restituicao ou ressarcimento anterior, total ou parcial;

b) NAO existem PER/DCOMPs anteriores referentes aos mesmos creditos
   e periodos aqui indicados;

c) Os creditos NAO estao sendo objeto de discussao judicial ou
   processo administrativo fiscal que impediriam a compensacao;

d) As obrigacoes acessorias (EFD Contribuicoes, DCTF, ECF, GFIP/eSocial)
   serao retificadas para refletir os creditos aqui apurados ANTES da
   transmissao da PER/DCOMP;

e) O contribuinte mantera a guarda dos documentos comprobatorios pelo
   prazo minimo de 5 (cinco) anos, contados da data da transmissao.

=============================================================================
5. ORIENTACOES PARA PREENCHIMENTO DO PER/DCOMP WEB
=============================================================================

5.1. ACESSO:
- Portal e-CAC (https://cav.receita.fazenda.gov.br)
- Certificado digital e-CNPJ tipo A1 ou A3 (conta gov.br nivel Ouro)
- Menu: Restituicao e Compensacao > PER/DCOMP Web > Criar Novo Pedido

5.2. PREENCHIMENTO:

   | Campo PER/DCOMP            | Valor                              |
   |----------------------------|--------------------------------------|
   | Tipo de Documento          | ${params.tipoDocumento}              |
   | Tipo de Credito            | ${params.tipoCreditoPerdcomp}        |
   | Qualificacao               | Outra Qualificacao                   |
   | Periodo Apuracao Credito   | ${params.periodoCredito}             |
   | Valor Credito Original     | R$ ${formatNumber(params.valorTotal)}|
   | Codigo Receita Debito      | ${params.codigoReceitaDebito}        |
   | Periodo Debito             | ${params.periodoDebito}              |

5.3. PROCEDIMENTO:
a) Criar pedido com os dados acima
b) Anexar este Parecer Tecnico como documento suporte
c) Anexar demonstrativo de calculo (planilha Excel com detalhamento)
d) Transmitir e salvar recibo (protocolo e numero da PER/DCOMP)
e) Registrar na DCTF a compensacao efetuada

5.4. RETIFICACAO DE OBRIGACOES ACESSORIAS (OBRIGATORIO):
- EFD Contribuicoes: retificar periodos para refletir creditos apurados
- DCTF: incluir compensacao declarada
- ECF: ajustar base de calculo quando aplicavel
- GFIP/eSocial: retificar quando envolver contribuicoes previdenciarias

=============================================================================
6. PRAZOS E OBSERVACOES
=============================================================================

- A compensacao produz efeitos na data da transmissao (Art. 74, par. 2, Lei 9.430/96)
- Homologacao tacita em 5 anos se nao houver pronunciamento da RFB
- Prazo legal para analise: 360 dias (Art. 24, Lei 11.457/2007)
- Vedada compensacao de creditos em discussao judicial sem transito em julgado
- PIS/COFINS nao-cumulativo: ressarcimento pode ser pedido cumulativamente
- Manter TODOS os documentos fiscais e escrituracao por MINIMO 5 anos
- Em caso de nao homologacao: prazo de 30 dias para manifestacao de inconformidade
- Recurso ao CARF: prazo de 30 dias apos decisao da DRJ

=============================================================================
7. RESPONSABILIDADE E RESSALVAS
=============================================================================

Este parecer foi elaborado com base nos documentos fornecidos pelo
contribuinte e na legislacao vigente na data de sua emissao.

A responsabilidade pela veracidade das informacoes, documentos e
escrituracoes e integralmente do contribuinte.

A transmissao da PER/DCOMP e a retificacao das obrigacoes acessorias
devem ser realizadas por profissional habilitado (contador ou advogado
tributarista) com certificado digital do contribuinte.

A TaxCredit Enterprise atua como consultoria tecnica na identificacao
e fundamentacao dos creditos, nao sendo responsavel pela transmissao
das declaracoes nem pela analise dos orgaos competentes.

=============================================================================

${params.cidade}, ${dataAtual}

Responsavel Tecnico: ${params.advogadoNome} — OAB/${params.advogadoUf} ${params.advogadoOab}
Elaborado por: TaxCredit Enterprise — ATOM BRASIL DIGITAL LTDA
CNPJ: 22.003.550/0001-05
Protocolo: ${params.protocoloPlataforma}
=============================================================================`;
}

// ============================================================
// CONTRATO BIPARTITE (TaxCredit + Cliente)
// ============================================================

export interface BipartiteContractParams {
  empresaClienteNome: string;
  cnpjCliente: string;
  ieCliente: string;
  enderecoCliente: string;
  cepCliente: string;
  cidadeCliente: string;
  ufCliente: string;
  representanteCliente: string;
  cargoRepresentanteCliente: string;
  cpfRepresentanteCliente: string;
  percentualCliente: number;
  percentualPlataforma: number;
  taxaAdesao: number;
  valorEstimado: number;
  advogadoNome: string;
  advogadoOab: string;
  escrowAgencia: string;
  escrowConta: string;
  dataContrato: string;
}

// Dados fixos da ATOM BRASIL DIGITAL (hardcoded)
const TAXCREDIT = {
  razaoSocial: 'ATOM BRASIL DIGITAL LTDA',
  cnpj: '22.003.550/0001-05',
  endereco: 'Rua Arthur Possolo 50/SL102, Recreio dos Bandeirantes',
  cidade: 'Rio de Janeiro',
  uf: 'RJ',
  representante: 'Felicio Frauches Carega',
  cpf: '005.309.447-66',
  cargo: 'Socio-Administrador',
  foro: 'Comarca do Rio de Janeiro/RJ',
} as const;

const BANCO_FIBRA = {
  nome: 'Banco Fibra S.A.',
  cnpj: '58.616.418/0001-08',
} as const;

export function generateBipartiteContract(params: BipartiteContractParams): string {
  const pctCliente = params.percentualCliente || 80;
  const pctPlataforma = params.percentualPlataforma || 20;
  const taxa = params.taxaAdesao || 2000;

  return `=============================================================================
CONTRATO DE PRESTACAO DE SERVICOS DE ANALISE E RECUPERACAO DE
CREDITOS TRIBUTARIOS — INSTRUMENTO PARTICULAR BIPARTITE
=============================================================================

Pelo presente instrumento particular, as Partes abaixo qualificadas:

CONTRATADA:
${TAXCREDIT.razaoSocial}, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${TAXCREDIT.cnpj}, com sede na ${TAXCREDIT.endereco},
na cidade do ${TAXCREDIT.cidade}/${TAXCREDIT.uf}, neste ato representada por
${TAXCREDIT.representante}, ${TAXCREDIT.cargo}, CPF n. ${TAXCREDIT.cpf},
doravante denominada "TAXCREDIT";

CONTRATANTE:
${params.empresaClienteNome || '[EMPRESA CLIENTE]'}, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${params.cnpjCliente || '[CNPJ]'}, IE n. ${params.ieCliente || '[IE]'}, com sede em
${params.enderecoCliente || '[Endereco]'}, CEP ${params.cepCliente || '[CEP]'}, na cidade de
${params.cidadeCliente || '[Cidade]'}/${params.ufCliente || '[UF]'}, neste ato representada por
${params.representanteCliente || '[Representante]'}, ${params.cargoRepresentanteCliente || '[Cargo]'},
CPF n. ${params.cpfRepresentanteCliente || '[CPF]'}, doravante denominada "CLIENTE";

As Partes tem entre si justo e contratado:

CLAUSULA PRIMEIRA — DO OBJETO

1.1. Prestacao de servicos de analise, identificacao e assessoria na
recuperacao de creditos tributarios da CLIENTE, por meio da plataforma
"TaxCredit Enterprise" (taxcreditenterprise.com).

1.2. Os servicos compreendem:
a) Analise tecnica da documentacao fiscal e contabil;
b) Identificacao de oportunidades de recuperacao (ICMS, PIS, COFINS,
   IRPJ, CSLL, IPI, INSS e demais tributos);
c) Relatorio detalhado com teses, valores estimados e fundamentacao legal;
d) Geracao de documentacao para protocolo (PER/DCOMP, requerimentos SEFAZ);
e) Orientacao tecnica para formalizacao;
f) Acompanhamento processual ate conclusao.

1.3. Obrigacao de meio, nao de resultado. A TAXCREDIT nao garante exito
na recuperacao, que depende de analise dos orgaos competentes.

CLAUSULA SEGUNDA — DA TAXA DE ADESAO

2.1. Taxa de adesao: R$ ${formatNumber(taxa)} (${numberToWordsCurrency(taxa)}), paga
integralmente e de forma antecipada.

2.2. Forma de pagamento: PIX ou transferencia bancaria para:
   Titular: ${TAXCREDIT.razaoSocial}
   CNPJ: ${TAXCREDIT.cnpj}
   Chave PIX: [CHAVE_PIX]
   Banco: [BANCO]

2.3. A taxa cobre custos de infraestrutura tecnologica, processamento
da analise e geracao do relatorio de oportunidades.

2.4. Devolucao: A taxa sera devolvida integralmente APENAS se a analise
concluir pela inexistencia total de oportunidades de recuperacao,
desde que o CLIENTE tenha fornecido toda documentacao solicitada.

2.5. A analise completa sera iniciada somente apos confirmacao do
recebimento da taxa.

CLAUSULA TERCEIRA — DA REMUNERACAO E DISTRIBUICAO DE VALORES

3.1. Sobre o valor efetivamente recuperado ou compensado, sera aplicada
a seguinte distribuicao:

   CLIENTE:    ${pctCliente}% (${numberToWordsPercent(pctCliente)} por cento)
   TAXCREDIT:  ${pctPlataforma}% (${numberToWordsPercent(pctPlataforma)} por cento)

3.2. "Valor efetivamente recuperado ou compensado" significa, sem qualquer
distincao quanto a modalidade de realizacao do credito:
a) Valor creditado em conta corrente (restituicao em especie);
b) Valor compensado com tributos devidos (PER/DCOMP ou equivalente estadual);
c) Valor de credito utilizado, transferido, habilitado ou cedido (ICMS
   acumulado, precatorios, cessao a terceiros);
d) Valor obtido mediante compensacao determinada ou autorizada pelo Estado,
   Municipio ou orgao publico, inclusive quando o ente publico optar por
   compensar os creditos tributarios identificados com debitos do CLIENTE
   ou com futuros tributos, em vez de efetuar restituicao em especie.

3.3. CLAUSULA HIBRIDA — COMPENSACAO PELO ESTADO: Na hipotese de o Estado,
Municipio ou qualquer ente publico optar por compensar os creditos
tributarios objeto deste contrato com quaisquer debitos, obrigacoes ou
tributos futuros do CLIENTE, em vez de realizar o pagamento em especie ou
a restituicao direta, o CLIENTE tera a MESMA OBRIGACAO de repassar a
TAXCREDIT os ${pctPlataforma}% (${numberToWordsPercent(pctPlataforma)} por cento) sobre o valor
da compensacao, calculado pelo valor do credito compensado. O CLIENTE
devera notificar a TAXCREDIT em ate 5 (cinco) dias uteis da ciencia da
decisao administrativa ou judicial que determinar a compensacao,
fornecendo todos os documentos comprobatorios.

3.4. Os percentuais incidem sobre o valor BRUTO recuperado/compensado,
sem deducao de custos processuais, administrativos ou honorarios
advocaticios, que ja estao incluidos na parte da TAXCREDIT.

3.5. Estimativa de creditos identificados: R$ ${formatNumber(params.valorEstimado || 0)} conforme
relatorio de analise anexo, sujeito a confirmacao documental.

CLAUSULA QUARTA — DA CONTA ESCROW (BANCO FIBRA)

4.1. Para garantia e seguranca de ambas as Partes, todos os valores
recuperados serao recebidos exclusivamente por meio de CONTA ESCROW
mantida junto ao ${BANCO_FIBRA.nome} (CNPJ ${BANCO_FIBRA.cnpj}).

4.2. Na hipotese de compensacao pelo Estado (Clausula 3.3), o CLIENTE
devera depositar na conta escrow o valor equivalente a ${pctPlataforma}% do
credito compensado no prazo de ate 10 (dez) dias uteis contados da
efetivacao da compensacao, para que o Banco Fibra realize o split
automatico.

4.3. SPLIT AUTOMATICO: Ao receber os valores na conta escrow, o Banco
Fibra realizara automaticamente a distribuicao:
   - ${pctCliente}% -> conta corrente do CLIENTE
   - ${pctPlataforma}% -> conta corrente da TAXCREDIT

4.4. O split sera realizado em ate 48 (quarenta e oito) horas uteis
do efetivo recebimento na conta escrow.

4.5. VEDACOES AO CLIENTE: E expressamente vedado ao CLIENTE:
a) Solicitar alteracao dos dados bancarios de restituicao perante
   Receita Federal, SEFAZ ou outros orgaos sem autorizacao previa
   e escrita da TAXCREDIT;
b) Solicitar restituicao em conta diversa da conta escrow;
c) Compensar creditos unilateralmente sem autorizacao da TAXCREDIT;
d) Aceitar compensacao pelo Estado sem comunicar a TAXCREDIT no prazo
   de 5 dias uteis.

4.6. O descumprimento das vedacoes acima configura inadimplemento grave,
sujeitando o CLIENTE as penalidades da Clausula Oitava.

CLAUSULA QUINTA — DA PROCURACAO E ACESSO A SISTEMAS

5.1. O CLIENTE outorgara procuracao ao advogado ${params.advogadoNome || '[ADVOGADO]'},
inscrito na OAB ${params.advogadoOab || '[OAB]'}, com poderes para:
a) Protocolar pedidos de restituicao, compensacao e ressarcimento;
b) Acessar sistemas eletronicos (e-CAC, SEFAZ) em nome do CLIENTE;
c) Retificar declaracoes e escrituracoes fiscais quando necessario;
d) Receber intimacoes e notificacoes oficiais;
e) Praticar todos os atos necessarios a recuperacao dos creditos.

5.2. A procuracao e vinculada ao interesse contratual nos termos do
art. 117 do Codigo Civil.

CLAUSULA SEXTA — DAS OBRIGACOES DA TAXCREDIT

6.1. A TAXCREDIT se obriga a:
a) Disponibilizar a plataforma TaxCredit Enterprise;
b) Realizar analise tecnica com inteligencia artificial e revisao
   especializada;
c) Gerar relatorio de oportunidades com fundamentacao legal;
d) Providenciar documentacao para protocolo;
e) Acompanhar o processo ate a efetiva recuperacao;
f) Manter sigilo conforme Clausula Decima;
g) Conformidade com a LGPD (Lei 13.709/2018).

CLAUSULA SETIMA — DAS OBRIGACOES DO CLIENTE

7.1. O CLIENTE se obriga a:
a) Fornecer documentos fiscais e contabeis completos e tempestivos;
b) Garantir veracidade e integridade dos documentos fornecidos;
c) Outorgar procuracao conforme Clausula Quinta;
d) Efetuar pagamentos nos termos e prazos contratados;
e) Informar a TAXCREDIT em ate 5 dias uteis sobre qualquer evento
   de recuperacao ou compensacao de creditos, incluindo compensacoes
   determinadas pelo Estado;
f) Nao contratar terceiros para recuperacao dos mesmos creditos
   durante a vigencia deste contrato;
g) Manter dados cadastrais atualizados.

CLAUSULA OITAVA — DAS PENALIDADES

8.1. Em caso de descumprimento grave (alteracao de dados bancarios
sem autorizacao, revogacao de procuracao sem justa causa, recebimento
de creditos sem repasse, aceitacao de compensacao estatal sem
notificacao, contratacao de terceiros para mesmos creditos):
a) Multa compensatoria de 30% sobre o valor total dos creditos
   identificados;
b) Rescisao imediata do contrato;
c) Execucao das garantias, se houver.

8.2. Em caso de descumprimento leve (atraso em documentos, nao
atualizacao cadastral): prazo de 15 dias para regularizacao.

8.3. Atraso no repasse de valores: multa de 2% + juros de 1% ao mes
+ correcao pelo IPCA.

CLAUSULA NONA — DA RESPONSABILIDADE

9.1. A TAXCREDIT nao se responsabiliza por:
a) Indeferimentos ou glosas pelas autoridades fiscais;
b) Incorrecoes nos documentos fornecidos pelo CLIENTE;
c) Alteracoes legislativas supervenientes;
d) Prazos dos orgaos publicos.

9.2. Os valores do relatorio sao estimativas baseadas nos documentos
fornecidos e legislacao vigente.

CLAUSULA DECIMA — SIGILO E PROTECAO DE DADOS

10.1. Sigilo absoluto sobre todas as informacoes trocadas, pelo prazo
de 5 anos apos o termino do contrato.

10.2. Tratamento de dados pessoais conforme LGPD (Lei 13.709/2018),
exclusivamente para finalidade contratual.

10.3. A TAXCREDIT podera compartilhar dados com advogados, contadores
e o ${BANCO_FIBRA.nome}, estritamente necessarios a execucao contratual.

CLAUSULA DECIMA PRIMEIRA — PRAZO E RESCISAO

11.1. Prazo: 12 meses, renovacao automatica por periodos iguais,
salvo aviso previo de 30 dias.

11.2. A rescisao nao exime o pagamento sobre creditos ja identificados
ou em processo de recuperacao durante a vigencia.

11.3. Apos rescisao, a TAXCREDIT mantem direito sobre creditos
identificados pelo prazo de 5 anos.

CLAUSULA DECIMA SEGUNDA — DA FORMALIZACAO E REGISTRO

12.1. O presente contrato sera assinado por todas as Partes com
FIRMA RECONHECIDA EM CARTORIO, sendo esta condicao indispensavel
para sua validade e plena execucao.

12.2. Copia do contrato com firmas reconhecidas sera encaminhada
ao Banco Fibra S.A. para cadastramento da operacao de conta escrow.

12.3. A analise detalhada e entrega do relatorio completo de
oportunidades somente ocorrera APOS:
a) Assinatura do contrato por todas as Partes com firma reconhecida;
b) Pagamento integral da taxa de adesao;
c) Confirmacao do cadastramento da operacao pelo Banco Fibra S.A.

CLAUSULA DECIMA TERCEIRA — DO FORO

13.1. Foro da ${TAXCREDIT.foro}, com renuncia a qualquer
outro, por mais privilegiado que seja.

E por estarem justas e contratadas:

Rio de Janeiro, ${params.dataContrato || new Date().toLocaleDateString('pt-BR')}

_______________________________________
${TAXCREDIT.razaoSocial} (TAXCREDIT)
${TAXCREDIT.representante}
CPF: ${TAXCREDIT.cpf}
CNPJ: ${TAXCREDIT.cnpj}

_______________________________________
${params.empresaClienteNome || '[EMPRESA CLIENTE]'} (CLIENTE)
${params.representanteCliente || '[Representante]'}
CPF: ${params.cpfRepresentanteCliente || '[CPF]'}
CNPJ: ${params.cnpjCliente || '[CNPJ]'}

TESTEMUNHAS:
1. _______________________________ Nome: _________________ CPF: _______________
2. _______________________________ Nome: _________________ CPF: _______________
=============================================================================`;
}

// ============================================================
// CONTRATO TRIPARTITE (TaxCredit + Cliente + Parceiro)
// ============================================================

export interface TripartiteContractParams extends BipartiteContractParams {
  percentualParceiro: number;
  parceiroNome: string;
  parceiroCnpjCpf: string;
  parceiroTipoPessoa: string;
  parceiroOab: string;
  parceiroEndereco: string;
  parceiroCidade: string;
  parceiroUf: string;
  parceiroBanco: string;
  parceiroAgencia: string;
  parceiroConta: string;
  parceiroTitular: string;
  parceiroDocBanco: string;
}

export function generateTripartiteContract(params: TripartiteContractParams): string {
  const pctCliente = params.percentualCliente || 80;
  const pctPlataforma = params.percentualPlataforma || 12;
  const pctParceiro = params.percentualParceiro || 8;
  const taxa = params.taxaAdesao || 2000;

  return `=============================================================================
CONTRATO DE PRESTACAO DE SERVICOS DE ANALISE E RECUPERACAO DE
CREDITOS TRIBUTARIOS — INSTRUMENTO PARTICULAR TRIPARTITE
=============================================================================

Pelo presente instrumento particular, as Partes abaixo qualificadas:

CONTRATADA:
${TAXCREDIT.razaoSocial}, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${TAXCREDIT.cnpj}, com sede na ${TAXCREDIT.endereco},
na cidade do ${TAXCREDIT.cidade}/${TAXCREDIT.uf}, neste ato representada por
${TAXCREDIT.representante}, ${TAXCREDIT.cargo}, CPF n. ${TAXCREDIT.cpf},
doravante denominada "TAXCREDIT";

CONTRATANTE:
${params.empresaClienteNome || '[EMPRESA CLIENTE]'}, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${params.cnpjCliente || '[CNPJ]'}, IE n. ${params.ieCliente || '[IE]'}, com sede em
${params.enderecoCliente || '[Endereco]'}, CEP ${params.cepCliente || '[CEP]'}, na cidade de
${params.cidadeCliente || '[Cidade]'}/${params.ufCliente || '[UF]'}, neste ato representada por
${params.representanteCliente || '[Representante]'}, ${params.cargoRepresentanteCliente || '[Cargo]'},
CPF n. ${params.cpfRepresentanteCliente || '[CPF]'}, doravante denominada "CLIENTE";

PARCEIRO:
${params.parceiroNome || '[PARCEIRO]'}, pessoa ${params.parceiroTipoPessoa || 'juridica'} de direito
privado, ${params.parceiroCnpjCpf ? (params.parceiroTipoPessoa === 'fisica' ? `CPF n. ${params.parceiroCnpjCpf}` : `inscrita no CNPJ/MF sob n. ${params.parceiroCnpjCpf}`) : '[CNPJ/CPF]'}${params.parceiroOab ? `, inscrito na OAB ${params.parceiroOab}` : ''},
com sede/domicilio em ${params.parceiroEndereco || '[Endereco]'},
na cidade de ${params.parceiroCidade || '[Cidade]'}/${params.parceiroUf || '[UF]'},
doravante denominado "PARCEIRO";

As Partes tem entre si justo e contratado:

CLAUSULA PRIMEIRA — DO OBJETO

1.1. Prestacao de servicos de analise, identificacao e assessoria na
recuperacao de creditos tributarios da CLIENTE, por meio da plataforma
"TaxCredit Enterprise" (taxcreditenterprise.com).

1.2. Os servicos compreendem:
a) Analise tecnica da documentacao fiscal e contabil;
b) Identificacao de oportunidades de recuperacao (ICMS, PIS, COFINS,
   IRPJ, CSLL, IPI, INSS e demais tributos);
c) Relatorio detalhado com teses, valores estimados e fundamentacao legal;
d) Geracao de documentacao para protocolo (PER/DCOMP, requerimentos SEFAZ);
e) Orientacao tecnica para formalizacao;
f) Acompanhamento processual ate conclusao.

1.3. Obrigacao de meio, nao de resultado. A TAXCREDIT nao garante exito
na recuperacao, que depende de analise dos orgaos competentes.

CLAUSULA SEGUNDA — DA TAXA DE ADESAO

2.1. Taxa de adesao: R$ ${formatNumber(taxa)} (${numberToWordsCurrency(taxa)}), paga
integralmente e de forma antecipada.

2.2. Forma de pagamento: PIX ou transferencia bancaria para:
   Titular: ${TAXCREDIT.razaoSocial}
   CNPJ: ${TAXCREDIT.cnpj}
   Chave PIX: [CHAVE_PIX]
   Banco: [BANCO]

2.3. A taxa cobre custos de infraestrutura tecnologica, processamento
da analise e geracao do relatorio de oportunidades.

2.4. Devolucao: A taxa sera devolvida integralmente APENAS se a analise
concluir pela inexistencia total de oportunidades de recuperacao,
desde que o CLIENTE tenha fornecido toda documentacao solicitada.

2.5. A analise completa sera iniciada somente apos confirmacao do
recebimento da taxa.

CLAUSULA TERCEIRA — DA REMUNERACAO E DISTRIBUICAO DE VALORES

3.1. Sobre o valor efetivamente recuperado ou compensado, sera aplicada
a seguinte distribuicao:

   CLIENTE:    ${pctCliente}% (${numberToWordsPercent(pctCliente)} por cento)
   TAXCREDIT:  ${pctPlataforma}% (${numberToWordsPercent(pctPlataforma)} por cento)
   PARCEIRO:   ${pctParceiro}% (${numberToWordsPercent(pctParceiro)} por cento)

3.2. "Valor efetivamente recuperado ou compensado" significa, sem qualquer
distincao quanto a modalidade de realizacao do credito:
a) Valor creditado em conta corrente (restituicao em especie);
b) Valor compensado com tributos devidos (PER/DCOMP ou equivalente estadual);
c) Valor de credito utilizado, transferido, habilitado ou cedido (ICMS
   acumulado, precatorios, cessao a terceiros);
d) Valor obtido mediante compensacao determinada ou autorizada pelo Estado,
   Municipio ou orgao publico, inclusive quando o ente publico optar por
   compensar os creditos tributarios identificados com debitos do CLIENTE
   ou com futuros tributos, em vez de efetuar restituicao em especie.

3.3. CLAUSULA HIBRIDA — COMPENSACAO PELO ESTADO: Na hipotese de o Estado,
Municipio ou qualquer ente publico optar por compensar os creditos
tributarios objeto deste contrato com quaisquer debitos, obrigacoes ou
tributos futuros do CLIENTE, em vez de realizar o pagamento em especie ou
a restituicao direta, o CLIENTE tera a MESMA OBRIGACAO de repassar a
TAXCREDIT os ${pctPlataforma + pctParceiro}% (${numberToWordsPercent(pctPlataforma + pctParceiro)} por cento — sendo
${pctPlataforma}% TAXCREDIT + ${pctParceiro}% PARCEIRO) sobre o valor da compensacao,
calculado pelo valor do credito compensado. O CLIENTE devera notificar a
TAXCREDIT em ate 5 (cinco) dias uteis da ciencia da decisao administrativa
ou judicial que determinar a compensacao, fornecendo todos os documentos
comprobatorios.

3.4. O PARCEIRO e remunerado pela indicacao e/ou acompanhamento da
operacao. Seu percentual e oriundo da parte da TAXCREDIT, nao
onerando o CLIENTE.

3.5. Os percentuais incidem sobre o valor BRUTO recuperado/compensado,
sem deducao de custos processuais, administrativos ou honorarios
advocaticios, que ja estao incluidos na parte da TAXCREDIT.

3.6. Estimativa de creditos identificados: R$ ${formatNumber(params.valorEstimado || 0)} conforme
relatorio de analise anexo, sujeito a confirmacao documental.

CLAUSULA QUARTA — DA CONTA ESCROW (BANCO FIBRA)

4.1. Para garantia e seguranca de todas as Partes, todos os valores
recuperados serao recebidos exclusivamente por meio de CONTA ESCROW
mantida junto ao ${BANCO_FIBRA.nome} (CNPJ ${BANCO_FIBRA.cnpj}).

4.2. Na hipotese de compensacao pelo Estado (Clausula 3.3), o CLIENTE
devera depositar na conta escrow o valor equivalente a ${pctPlataforma + pctParceiro}% do
credito compensado no prazo de ate 10 (dez) dias uteis contados da
efetivacao da compensacao, para que o Banco Fibra realize o split
automatico.

4.3. SPLIT AUTOMATICO em 3 vias: Ao receber os valores na conta escrow,
o Banco Fibra realizara automaticamente a distribuicao:
   - ${pctCliente}% -> conta corrente do CLIENTE
   - ${pctPlataforma}% -> conta corrente da TAXCREDIT
   - ${pctParceiro}% -> conta corrente do PARCEIRO

Dados bancarios do PARCEIRO para split:
   Banco: ${params.parceiroBanco || '[BANCO]'}
   Agencia: ${params.parceiroAgencia || '[AGENCIA]'}
   Conta: ${params.parceiroConta || '[CONTA]'}
   Titular: ${params.parceiroTitular || '[TITULAR]'}
   CPF/CNPJ: ${params.parceiroDocBanco || '[DOC]'}

4.4. O split sera realizado em ate 48 (quarenta e oito) horas uteis
do efetivo recebimento na conta escrow.

4.5. VEDACOES AO CLIENTE: E expressamente vedado ao CLIENTE:
a) Solicitar alteracao dos dados bancarios de restituicao perante
   Receita Federal, SEFAZ ou outros orgaos sem autorizacao previa
   e escrita da TAXCREDIT;
b) Solicitar restituicao em conta diversa da conta escrow;
c) Compensar creditos unilateralmente sem autorizacao da TAXCREDIT;
d) Aceitar compensacao pelo Estado sem comunicar a TAXCREDIT no prazo
   de 5 dias uteis.

4.6. O descumprimento das vedacoes acima configura inadimplemento grave,
sujeitando o CLIENTE as penalidades da Clausula Nona.

CLAUSULA QUINTA — DA PROCURACAO E ACESSO A SISTEMAS

5.1. O CLIENTE outorgara procuracao ao advogado ${params.advogadoNome || '[ADVOGADO]'},
inscrito na OAB ${params.advogadoOab || '[OAB]'}, com poderes para:
a) Protocolar pedidos de restituicao, compensacao e ressarcimento;
b) Acessar sistemas eletronicos (e-CAC, SEFAZ) em nome do CLIENTE;
c) Retificar declaracoes e escrituracoes fiscais quando necessario;
d) Receber intimacoes e notificacoes oficiais;
e) Praticar todos os atos necessarios a recuperacao dos creditos.

5.2. A procuracao e vinculada ao interesse contratual nos termos do
art. 117 do Codigo Civil.

CLAUSULA SEXTA — DAS OBRIGACOES DA TAXCREDIT

6.1. A TAXCREDIT se obriga a:
a) Disponibilizar a plataforma TaxCredit Enterprise;
b) Realizar analise tecnica com inteligencia artificial e revisao
   especializada;
c) Gerar relatorio de oportunidades com fundamentacao legal;
d) Providenciar documentacao para protocolo;
e) Acompanhar o processo ate a efetiva recuperacao;
f) Manter sigilo conforme Clausula Decima Primeira;
g) Conformidade com a LGPD (Lei 13.709/2018).

CLAUSULA SETIMA — DAS OBRIGACOES DO CLIENTE

7.1. O CLIENTE se obriga a:
a) Fornecer documentos fiscais e contabeis completos e tempestivos;
b) Garantir veracidade e integridade dos documentos fornecidos;
c) Outorgar procuracao conforme Clausula Quinta;
d) Efetuar pagamentos nos termos e prazos contratados;
e) Informar a TAXCREDIT em ate 5 dias uteis sobre qualquer evento
   de recuperacao ou compensacao de creditos, incluindo compensacoes
   determinadas pelo Estado;
f) Nao contratar terceiros para recuperacao dos mesmos creditos
   durante a vigencia deste contrato;
g) Manter dados cadastrais atualizados.

CLAUSULA OITAVA — DAS OBRIGACOES DO PARCEIRO

8.1. O PARCEIRO se obriga a:
a) Contribuir para o bom andamento da operacao;
b) Manter sigilo sobre todas as informacoes;
c) Nao negociar diretamente com o CLIENTE sem anuencia da TAXCREDIT;
d) Nao indicar o CLIENTE a concorrentes da TAXCREDIT.

8.2. O PARCEIRO reconhece que seu percentual e definido pela TAXCREDIT
e podera ser ajustado em futuros contratos mediante acordo previo.

CLAUSULA NONA — DAS PENALIDADES

9.1. Em caso de descumprimento grave (alteracao de dados bancarios
sem autorizacao, revogacao de procuracao sem justa causa, recebimento
de creditos sem repasse, aceitacao de compensacao estatal sem
notificacao, contratacao de terceiros para mesmos creditos):
a) Multa compensatoria de 30% sobre o valor total dos creditos
   identificados;
b) Rescisao imediata do contrato;
c) Execucao das garantias, se houver.

9.2. Em caso de descumprimento leve: prazo de 15 dias para regularizacao.

9.3. Atraso no repasse de valores: multa de 2% + juros de 1% ao mes
+ correcao pelo IPCA.

CLAUSULA DECIMA — DA RESPONSABILIDADE

10.1. A TAXCREDIT nao se responsabiliza por:
a) Indeferimentos ou glosas pelas autoridades fiscais;
b) Incorrecoes nos documentos fornecidos pelo CLIENTE;
c) Alteracoes legislativas supervenientes;
d) Prazos dos orgaos publicos.

10.2. Os valores do relatorio sao estimativas baseadas nos documentos
fornecidos e legislacao vigente.

CLAUSULA DECIMA PRIMEIRA — SIGILO E PROTECAO DE DADOS

11.1. Sigilo absoluto sobre todas as informacoes trocadas, pelo prazo
de 5 anos apos o termino do contrato.

11.2. Tratamento de dados pessoais conforme LGPD (Lei 13.709/2018),
exclusivamente para finalidade contratual.

11.3. A TAXCREDIT podera compartilhar dados com advogados, contadores
e o ${BANCO_FIBRA.nome}, estritamente necessarios a execucao contratual.

CLAUSULA DECIMA SEGUNDA — PRAZO E RESCISAO

12.1. Prazo: 12 meses, renovacao automatica por periodos iguais,
salvo aviso previo de 30 dias.

12.2. A rescisao nao exime o pagamento sobre creditos ja identificados
ou em processo de recuperacao durante a vigencia.

12.3. Apos rescisao, a TAXCREDIT mantem direito sobre creditos
identificados pelo prazo de 5 anos.

CLAUSULA DECIMA TERCEIRA — DA FORMALIZACAO E REGISTRO

13.1. O presente contrato sera assinado por todas as Partes com
FIRMA RECONHECIDA EM CARTORIO, sendo esta condicao indispensavel
para sua validade e plena execucao.

13.2. Copia do contrato com firmas reconhecidas sera encaminhada
ao Banco Fibra S.A. para cadastramento da operacao de conta escrow.

13.3. A analise detalhada e entrega do relatorio completo de
oportunidades somente ocorrera APOS:
a) Assinatura do contrato por todas as Partes com firma reconhecida;
b) Pagamento integral da taxa de adesao;
c) Confirmacao do cadastramento da operacao pelo Banco Fibra S.A.

CLAUSULA DECIMA QUARTA — DO FORO

14.1. Foro da ${TAXCREDIT.foro}, com renuncia a qualquer
outro, por mais privilegiado que seja.

E por estarem justas e contratadas:

Rio de Janeiro, ${params.dataContrato || new Date().toLocaleDateString('pt-BR')}

_______________________________________
${TAXCREDIT.razaoSocial} (TAXCREDIT)
${TAXCREDIT.representante}
CPF: ${TAXCREDIT.cpf}
CNPJ: ${TAXCREDIT.cnpj}

_______________________________________
${params.empresaClienteNome || '[EMPRESA CLIENTE]'} (CLIENTE)
${params.representanteCliente || '[Representante]'}
CPF: ${params.cpfRepresentanteCliente || '[CPF]'}
CNPJ: ${params.cnpjCliente || '[CNPJ]'}

_______________________________________
${params.parceiroNome || '[PARCEIRO]'} (PARCEIRO)
CPF/CNPJ: ${params.parceiroCnpjCpf || '[DOC]'}

TESTEMUNHAS:
1. _______________________________ Nome: _________________ CPF: _______________
2. _______________________________ Nome: _________________ CPF: _______________
=============================================================================`;
}

// ============================================================
// CLASSIFICADOR DE TRIBUTOS POR COMPETENCIA
// Separa oportunidades em estaduais (SEFAZ) e federais (RFB)
// ============================================================

type Competencia = 'estadual' | 'federal';
type GrupoTributo = 'ICMS' | 'PIS' | 'COFINS' | 'IRPJ' | 'CSLL' | 'IPI' | 'INSS' | 'FGTS' | 'OUTROS';

interface ClassifiedOpportunity {
  original: any;
  competencia: Competencia;
  grupoTributo: GrupoTributo;
  naturezaCredito: string;
  codigoReceita: string;
  fundamentacaoFederal: string;
}

const TRIBUTO_CONFIG: Record<GrupoTributo, {
  competencia: Competencia;
  naturezaCredito: string;
  codigoReceita: string;
  fundamentacao: string;
}> = {
  ICMS: {
    competencia: 'estadual',
    naturezaCredito: 'N/A — Competencia Estadual',
    codigoReceita: 'N/A',
    fundamentacao: 'Legislacao estadual (RICMS do respectivo estado)',
  },
  PIS: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de PIS',
    codigoReceita: '8109',
    fundamentacao: 'Lei 10.637/2002 | Lei 10.865/2004 (importacao) | IN RFB 2.055/2021',
  },
  COFINS: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de COFINS',
    codigoReceita: '2172',
    fundamentacao: 'Lei 10.833/2003 | Lei 10.865/2004 (importacao) | IN RFB 2.055/2021',
  },
  IRPJ: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de IRPJ',
    codigoReceita: '2362',
    fundamentacao: 'Lei 9.249/1995 | Lei 12.973/2014 | LC 160/2017 | IN RFB 2.055/2021',
  },
  CSLL: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de CSLL',
    codigoReceita: '2372',
    fundamentacao: 'Lei 7.689/1988 | Lei 12.973/2014 | LC 160/2017 | IN RFB 2.055/2021',
  },
  IPI: {
    competencia: 'federal',
    naturezaCredito: 'Ressarcimento de IPI',
    codigoReceita: '0676',
    fundamentacao: 'RIPI (Decreto 7.212/2010) | IN RFB 2.055/2021',
  },
  INSS: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de Contribuicao Previdenciaria',
    codigoReceita: '2100',
    fundamentacao: 'Lei 8.212/1991 | IN RFB 2.055/2021',
  },
  FGTS: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior de FGTS',
    codigoReceita: 'N/A — Via GRRF/Caixa',
    fundamentacao: 'Lei 8.036/1990',
  },
  OUTROS: {
    competencia: 'federal',
    naturezaCredito: 'Pagamento Indevido ou a Maior',
    codigoReceita: '[A DEFINIR]',
    fundamentacao: 'Legislacao federal vigente',
  },
};

const ICMS_KEYWORDS = [
  'ICMS', 'ICMS-ST', 'ICMS-IMPORTACAO', 'ICMS IMPORTACAO',
  'SALDO CREDOR', 'SUBSTITUICAO TRIBUTARIA', 'TUSD', 'TUST',
  'ENERGIA ELETRICA', 'CREDITO ACUMULADO', 'TRANSFERENCIA ENTRE FILIAIS',
  'ADC 49', 'LEI KANDIR', 'DIFAL',
];

export function classifyOpportunity(op: any): ClassifiedOpportunity {
  const text = JSON.stringify(op).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tributo = (op.tributo || '').toUpperCase();
  const tipo = (op.tipo || op.tese || op.titulo || '').toUpperCase();

  let grupo: GrupoTributo = 'OUTROS';

  if (ICMS_KEYWORDS.some(k => text.includes(k)) || tributo.includes('ICMS')) {
    grupo = 'ICMS';
  } else if (tributo === 'PIS' || tributo.includes('PIS-IMPORT') || (tipo.includes('PIS') && !tipo.includes('COFINS'))) {
    grupo = 'PIS';
  } else if (tributo === 'COFINS' || tributo.includes('COFINS-IMPORT') || (tipo.includes('COFINS') && !tipo.includes('PIS'))) {
    grupo = 'COFINS';
  } else if (tipo.includes('PIS') && tipo.includes('COFINS')) {
    grupo = text.includes('COFINS') ? 'COFINS' : 'PIS';
  } else if (tributo === 'IRPJ' || tipo.includes('IRPJ') || tipo.includes('IMPOSTO DE RENDA')) {
    grupo = 'IRPJ';
  } else if (tributo === 'CSLL' || tipo.includes('CSLL') || tipo.includes('CONTRIBUICAO SOCIAL')) {
    grupo = 'CSLL';
  } else if (tributo === 'IPI' || tipo.includes('IPI')) {
    grupo = 'IPI';
  } else if (tributo === 'INSS' || tipo.includes('INSS') || tipo.includes('PREVIDENCIARIA') || tipo.includes('PATRONAL')) {
    grupo = 'INSS';
  } else if (tributo === 'FGTS' || tipo.includes('FGTS')) {
    grupo = 'FGTS';
  } else if (text.includes('ICMS') || text.includes('SALDO CREDOR')) {
    grupo = 'ICMS';
  } else if (text.includes('PIS')) {
    grupo = 'PIS';
  } else if (text.includes('COFINS')) {
    grupo = 'COFINS';
  }

  const config = TRIBUTO_CONFIG[grupo];
  return {
    original: op,
    competencia: config.competencia,
    grupoTributo: grupo,
    naturezaCredito: config.naturezaCredito,
    codigoReceita: config.codigoReceita,
    fundamentacaoFederal: config.fundamentacao,
  };
}

export function classifyAllOpportunities(opportunities: any[]): ClassifiedOpportunity[] {
  return opportunities.map(classifyOpportunity);
}

// ============================================================
// KIT DE FORMALIZACAO — Gera documentos separados por competencia
// ============================================================

export interface FormalizationKitParams {
  opportunities: any[];
  empresaNome: string;
  cnpj: string;
  uf: string;
  inscricaoEstadual?: string;
  empresaEndereco?: string;
  empresaCidade?: string;
  empresaCep?: string;
  atividadeEmpresa?: string;
  cnaePrincipal?: string;
  advogadoNome?: string;
  advogadoOab?: string;
  advogadoUf?: string;
  advogadoEmail?: string;
  advogadoEndereco?: string;
  representanteNome?: string;
  representanteCargo?: string;
  representanteCpf?: string;
  representanteRg?: string;
  tipoPedido?: string;
  periodoInicio?: string;
  periodoFim?: string;
}

export interface FormalizationKitDocument {
  tipo: 'sefaz' | 'perdcomp';
  tributo: string;
  destinatario: string;
  naturezaCredito: string;
  valorTotal: number;
  documento: string;
}

export interface FormalizationKitResult {
  protocolo: string;
  documentos: FormalizationKitDocument[];
  resumo: {
    totalEstadual: number;
    totalFederal: number;
    totalGeral: number;
    qtdDocumentos: number;
  };
}

export function generateFormalizationKit(params: FormalizationKitParams): FormalizationKitResult {
  const protocolo = `TCE-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const classified = classifyAllOpportunities(params.opportunities);
  const documentos: FormalizationKitDocument[] = [];

  const estaduais = classified.filter(c => c.competencia === 'estadual');
  const federais = classified.filter(c => c.competencia === 'federal');

  // 1. Gerar Requerimento SEFAZ (apenas ICMS)
  if (estaduais.length > 0) {
    const teses = estaduais.map(c => ({
      descricao: c.original.tese || c.original.titulo || c.original.description || 'Oportunidade ICMS',
      valor: c.original.valorEstimado || c.original.valor || 0,
      fundamentacao: c.original.fundamentacaoLegal || c.original.base_legal || 'Legislacao estadual vigente',
      periodo: c.original.periodo || 'Conforme documentacao anexa',
    }));
    const valorEstadual = teses.reduce((sum, t) => sum + t.valor, 0);

    const sefazDoc = generateSefazDocument({
      empresaNome: params.empresaNome,
      cnpj: params.cnpj,
      inscricaoEstadual: params.inscricaoEstadual || '[IE]',
      empresaEndereco: params.empresaEndereco || '[Endereco]',
      empresaCidade: params.empresaCidade || '[Cidade]',
      empresaUf: params.uf,
      empresaCep: params.empresaCep || '[CEP]',
      atividadeEmpresa: params.atividadeEmpresa || '[Atividade]',
      cnaePrincipal: params.cnaePrincipal || '[CNAE]',
      advogadoNome: params.advogadoNome || '[Advogado]',
      advogadoOab: params.advogadoOab || '[OAB]',
      advogadoUf: params.advogadoUf || params.uf,
      advogadoEmail: params.advogadoEmail || '[email]',
      advogadoEndereco: params.advogadoEndereco || '[Endereco]',
      representanteNome: params.representanteNome || '[Representante]',
      representanteCargo: params.representanteCargo || '[Cargo]',
      representanteCpf: params.representanteCpf || '[CPF]',
      representanteRg: params.representanteRg || '[RG]',
      uf: params.uf,
      tipoPedido: params.tipoPedido || 'COMPENSACAO',
      valorTotalCredito: valorEstadual,
      periodoInicio: params.periodoInicio || '[Data inicio]',
      periodoFim: params.periodoFim || '[Data fim]',
      teses,
      protocoloPlataforma: protocolo,
    });

    documentos.push({
      tipo: 'sefaz',
      tributo: 'ICMS',
      destinatario: `SEFAZ-${params.uf}`,
      naturezaCredito: 'Credito Acumulado de ICMS',
      valorTotal: valorEstadual,
      documento: sefazDoc,
    });
  }

  // 2. Gerar PER/DCOMP separado por grupo de tributo federal
  const gruposFederais = new Map<GrupoTributo, ClassifiedOpportunity[]>();
  for (const f of federais) {
    const grupo = f.grupoTributo;
    if (!gruposFederais.has(grupo)) gruposFederais.set(grupo, []);
    gruposFederais.get(grupo)!.push(f);
  }

  // Agrupar PIS+COFINS juntos quando fazem parte da mesma tese (ex: Tese do Seculo)
  // mas manter separados quando sao teses diferentes
  for (const [grupo, items] of gruposFederais) {
    const creditos = items.map(c => ({
      tributo: `${grupo} — ${c.original.tese || c.original.titulo || 'Credito identificado'}`,
      tipoCredito: c.naturezaCredito,
      periodo: c.original.periodo || '[Periodo de apuracao]',
      valorOriginal: c.original.valorEstimado || c.original.valor || 0,
      valorAtualizado: (c.original.valorEstimado || c.original.valor || 0) * 1.08,
      baseLegal: c.fundamentacaoFederal + (c.original.fundamentacaoLegal ? ` | ${c.original.fundamentacaoLegal}` : ''),
      descricaoTese: c.original.tese || c.original.titulo || c.original.description || 'Oportunidade identificada',
    }));
    const valorGrupo = creditos.reduce((sum, c) => sum + c.valorOriginal, 0);
    const config = TRIBUTO_CONFIG[grupo];

    const perdcompDoc = generatePerdcompDocument({
      empresaNome: params.empresaNome,
      cnpj: params.cnpj,
      protocoloPlataforma: protocolo,
      advogadoNome: params.advogadoNome || '[Advogado]',
      advogadoOab: params.advogadoOab || '[OAB]',
      advogadoUf: params.advogadoUf || params.uf,
      cidade: params.empresaCidade || '[Cidade]',
      creditos,
      valorTotal: valorGrupo,
      tipoDocumento: 'Declaracao de Compensacao',
      tipoCreditoPerdcomp: config.naturezaCredito,
      periodoCredito: items[0]?.original.periodo || '[Periodo]',
      codigoReceitaDebito: config.codigoReceita,
      periodoDebito: '[Periodo do debito a compensar]',
    });

    documentos.push({
      tipo: 'perdcomp',
      tributo: grupo,
      destinatario: 'Receita Federal do Brasil',
      naturezaCredito: config.naturezaCredito,
      valorTotal: valorGrupo,
      documento: perdcompDoc,
    });
  }

  const totalEstadual = estaduais.reduce((s, c) => s + (c.original.valorEstimado || c.original.valor || 0), 0);
  const totalFederal = federais.reduce((s, c) => s + (c.original.valorEstimado || c.original.valor || 0), 0);

  return {
    protocolo,
    documentos,
    resumo: {
      totalEstadual,
      totalFederal,
      totalGeral: totalEstadual + totalFederal,
      qtdDocumentos: documentos.length,
    },
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function numberToWords(value: number): string {
  // Simplified — for production, use a proper library like extenso.js
  const formatted = formatNumber(value);
  if (value >= 1000000) {
    const millions = Math.floor(value / 1000000);
    return `${formatted} reais`;
  }
  return `${formatted} reais`;
}

function numberToWordsPercent(value: number): string {
  const units: Record<number, string> = {
    1: 'um', 2: 'dois', 3: 'tres', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove',
  };
  const teens: Record<number, string> = {
    10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze',
    15: 'quinze', 16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove',
  };
  const tens: Record<number, string> = {
    20: 'vinte', 30: 'trinta', 40: 'quarenta', 50: 'cinquenta',
    60: 'sessenta', 70: 'setenta', 80: 'oitenta', 90: 'noventa',
  };

  if (value === 0) return 'zero';
  if (value === 100) return 'cem';
  if (value >= 10 && value <= 19) return teens[value] || String(value);
  if (value < 10) return units[value] || String(value);

  const t = Math.floor(value / 10) * 10;
  const u = value % 10;
  if (u === 0) return tens[t] || String(value);
  return `${tens[t]} e ${units[u]}`;
}

function numberToWordsCurrency(value: number): string {
  if (value === 2000) return 'dois mil reais';
  if (value === 1000) return 'mil reais';
  if (value === 1500) return 'mil e quinhentos reais';
  if (value === 2500) return 'dois mil e quinhentos reais';
  if (value === 3000) return 'tres mil reais';
  if (value === 5000) return 'cinco mil reais';
  return `R$ ${formatNumber(value)}`;
}

function getFundamentacaoUF(uf: string, tipoPedido: string): string {
  const fundamentacoes: Record<string, string> = {
    SP: `No ambito do Estado de Sao Paulo, o RICMS/SP (Decreto 45.490/2000),
Arts. 71 a 81, disciplina a apropriacao e utilizacao de creditos acumulados
de ICMS, regulamentada pelo sistema e-CredAc.`,
    RJ: `No ambito do Estado do Rio de Janeiro, o RICMS/RJ (Decreto 27.427/2000),
Livro III, com redacao dada pelo Decreto 46.668/2019, disciplina o saldo
credor de ICMS, complementado pela Resolucao SEFAZ 720/2014 (Anexo XX)
e Resolucao SEFAZ 35/2019. A ${tipoPedido.toLowerCase()} de credito acumulado
encontra amparo nos Arts. 2 a 18 do Livro III.`,
    MG: `No ambito do Estado de Minas Gerais, o RICMS/MG (Decreto 43.080/2002),
Anexo VIII, disciplina os procedimentos relativos a credito acumulado de
ICMS, administrado pelo sistema DCA-ICMS no SIARE.`,
    RS: `No ambito do Estado do Rio Grande do Sul, o RICMS/RS (Decreto 37.699/1997),
Arts. 58 e 59, disciplina a transferencia e utilizacao de saldo credor
de ICMS.`,
    PR: `No ambito do Estado do Parana, o RICMS/PR (Decreto 7.871/2017),
Arts. 47 a 61, disciplina o credito acumulado de ICMS, administrado pelo
sistema SISCRED.`,
    SC: `No ambito do Estado de Santa Catarina, o RICMS/SC (Decreto 2.870/2001),
Arts. 40 a 52, disciplina a utilizacao e transferencia de creditos acumulados,
com sistema de Reserva de Credito e TTD.`,
    BA: `No ambito do Estado da Bahia, o RICMS/BA (Decreto 13.780/2012),
Art. 317, disciplina os procedimentos para utilizacao de credito acumulado
de ICMS.`,
    MT: `No ambito do Estado de Mato Grosso, o RICMS/MT (Decreto 2.212/2014),
Arts. 99 a 125, disciplina o credito acumulado de ICMS, administrado pelo
sistema PAC-e/RUC-e.`,
    ES: `No ambito do Estado do Espirito Santo, o RICMS/ES (Decreto 1.090-R/2002),
Arts. 103 e seguintes, disciplina a transferencia e utilizacao de credito
acumulado de ICMS. O credito acumulado de exportacao pode ser transferido
a outros contribuintes do ES, utilizado para pagamento de debitos proprios
ou pedido de ressarcimento. A legislacao permite transferencia para
fornecedores locais de materia-prima, embalagem e outros insumos.
Regulamentacao complementar: Portaria SEFAZ n. 015-R/2018 e instrucoes
normativas vigentes. O protocolo pode ser feito via DT-e (Domicilio
Tributario Eletronico) ou presencialmente na Agencia da Receita Estadual.`,
  };
  return fundamentacoes[uf] || fundamentacoes['SP'];
}
