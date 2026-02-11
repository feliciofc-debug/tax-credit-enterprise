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

A Constituicao Federal, Art. 155, par. 2, I, assegura a nao-cumulatividade
do ICMS, garantindo o direito de compensar o imposto devido com o
cobrado nas operacoes anteriores.

${getFundamentacaoUF(params.uf, params.tipoPedido)}

IV. DOCUMENTOS ANEXOS

1. Procuracao com poderes especificos
2. Contrato social / ultima alteracao
3. Comprovante de inscricao CNPJ
4. Comprovante de Inscricao Estadual ativa
5. Certidao Negativa de Debitos Tributarios Estaduais
6. EFD ICMS/IPI dos periodos envolvidos
7. Demonstrativo detalhado dos creditos (gerado pela plataforma TaxCredit Enterprise)

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

  return `=============================================================================
PARECER TECNICO — SUPORTE A DECLARACAO DE COMPENSACAO (PER/DCOMP)
=============================================================================

CONTRIBUINTE: ${params.empresaNome}
CNPJ: ${params.cnpj}
PARECER N.: ${numeroParecer}
DATA: ${dataAtual}
PROTOCOLO TAXCREDIT: ${params.protocoloPlataforma}

1. OBJETO
Instruir e fundamentar a(s) Declaracao(oes) de Compensacao via
PER/DCOMP Web, relativas aos creditos tributarios identificados.

2. CREDITOS IDENTIFICADOS

${creditosText}

VALOR TOTAL: R$ ${formatNumber(params.valorTotal)}

3. FUNDAMENTACAO LEGAL

3.1. Da compensacao tributaria:
- Lei 9.430/1996, Art. 74
- IN RFB 2.055/2021

3.2. Das teses especificas:
${params.creditos.map(c => `   ${c.descricaoTese}: ${c.baseLegal}`).join('\n')}

4. ORIENTACOES PARA PREENCHIMENTO DO PER/DCOMP WEB

a) Acessar e-CAC com certificado digital e-CNPJ (conta gov.br Ouro)
b) PER/DCOMP Web > Criar Pedido
c) Preencher conforme tabela:

   | Campo PER/DCOMP            | Valor                              |
   |----------------------------|--------------------------------------|
   | Tipo de Documento          | ${params.tipoDocumento}              |
   | Tipo de Credito            | ${params.tipoCreditoPerdcomp}        |
   | Qualificacao               | Outra Qualificacao                   |
   | Periodo Apuracao Credito   | ${params.periodoCredito}             |
   | Valor Credito Original     | R$ ${formatNumber(params.valorTotal)}|
   | Codigo Receita Debito      | ${params.codigoReceitaDebito}        |
   | Periodo Debito             | ${params.periodoDebito}              |

d) Anexar este Parecer Tecnico
e) Transmitir e guardar recibo

5. OBSERVACOES

- Compensacao produz efeitos na transmissao, sujeita a homologacao (5 anos)
- Vedada compensacao de creditos em discussao judicial sem transito em julgado
- PIS/COFINS nao-cumulativo: ressarcimento obrigatorio ANTES da compensacao
- Manter documentos fiscais por 5 anos

6. RESPONSABILIDADE

Parecer baseado nos documentos fornecidos. Responsabilidade pela
veracidade e do contribuinte. Revisao obrigatoria por profissional
habilitado antes da transmissao.

${params.cidade}, ${dataAtual}
Responsavel: ${params.advogadoNome} — OAB/${params.advogadoUf} ${params.advogadoOab}
=============================================================================`;
}

// ============================================================
// CONTRATO BIPARTITE (Venda Direta)
// ============================================================

export interface BipartiteContractParams {
  cnpjPlataforma: string;
  enderecoPlataforma: string;
  cidadePlataforma: string;
  ufPlataforma: string;
  cepPlataforma: string;
  representantePlataforma: string;
  cargoRepresentantePlataforma: string;
  cpfRepresentantePlataforma: string;
  // Cliente
  empresaClienteNome: string;
  cnpjCliente: string;
  ieCliente: string;
  enderecoCliente: string;
  cidadeCliente: string;
  ufCliente: string;
  cepCliente: string;
  representanteCliente: string;
  cargoRepresentanteCliente: string;
  cpfRepresentanteCliente: string;
  // Valores
  percentualPlataforma: number;
  chavePix: string;
  dataContrato: string;
  cidadeContrato: string;
}

export function generateBipartiteContract(params: BipartiteContractParams): string {
  return `=============================================================================
CONTRATO DE PRESTACAO DE SERVICOS DE ANALISE E RECUPERACAO DE
CREDITOS TRIBUTARIOS — INSTRUMENTO PARTICULAR
=============================================================================

Pelo presente instrumento particular, as Partes abaixo qualificadas:

CONTRATADA:
ATOM BRASIL DIGITAL LTDA, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${params.cnpjPlataforma || '[CNPJ ATOM BRASIL DIGITAL]'}, com sede a
${params.enderecoPlataforma || '[Endereco]'}, CEP ${params.cepPlataforma || '[CEP]'}, na cidade de
${params.cidadePlataforma || 'Sao Paulo'}/${params.ufPlataforma || 'SP'}, representada por
${params.representantePlataforma || '[Representante]'}, ${params.cargoRepresentantePlataforma || 'Socio-Administrador'},
CPF n. ${params.cpfRepresentantePlataforma || '[CPF]'}, doravante "CONTRATADA";

CONTRATANTE:
${params.empresaClienteNome || '[EMPRESA CLIENTE]'}, pessoa juridica de direito privado, inscrita
no CNPJ/MF sob n. ${params.cnpjCliente || '[CNPJ]'}, IE n. ${params.ieCliente || '[IE]'}, com sede a
${params.enderecoCliente || '[Endereco]'}, CEP ${params.cepCliente || '[CEP]'}, na cidade de
${params.cidadeCliente || '[Cidade]'}/${params.ufCliente || '[UF]'}, representada por
${params.representanteCliente || '[Representante]'}, ${params.cargoRepresentanteCliente || '[Cargo]'},
CPF n. ${params.cpfRepresentanteCliente || '[CPF]'}, doravante "CONTRATANTE";

As Partes tem entre si justo e contratado:

CLAUSULA PRIMEIRA — DO OBJETO

1.1. Prestacao de servicos de analise, identificacao e assessoria na
recuperacao de creditos tributarios da CONTRATANTE, por meio da
plataforma "TaxCredit Enterprise" (taxcreditenterprise.com).

1.2. Os servicos compreendem:
a) Analise da documentacao fiscal e contabil;
b) Identificacao de oportunidades de recuperacao (ICMS, PIS, COFINS,
   IRPJ, CSLL, IPI e tributos trabalhistas);
c) Relatorio detalhado com teses, valores e fundamentacao legal;
d) Documentacao de suporte para protocolo (SEFAZ/Receita Federal);
e) Orientacao tecnica para formalizacao.

1.3. Obrigacao de meio (nao de resultado). A CONTRATADA nao garante
resultado positivo na recuperacao.

CLAUSULA SEGUNDA — DA TAXA DE ADESAO

2.1. Taxa de adesao: R$ 2.000,00 (dois mil reais), paga integralmente
e de forma antecipada, via PIX.

2.2. Dados para pagamento:
   Chave PIX: ${params.chavePix || 'felicio@atacadistadigital.com'}
   Titular: ATOM BRASIL DIGITAL LTDA
   CNPJ: ${params.cnpjPlataforma || '[CNPJ]'}
   Banco: C6 Bank

2.3. Taxa integralmente devida a CONTRATADA. Nao reembolsavel apos
confirmacao e inicio da analise, exceto conforme Clausula Nona.

2.4. Analise completa iniciada somente apos confirmacao do recebimento.

CLAUSULA TERCEIRA — DA REMUNERACAO SOBRE CREDITOS RECUPERADOS

3.1. A CONTRATANTE pagara a CONTRATADA ${params.percentualPlataforma}%
(${numberToWordsPercent(params.percentualPlataforma)} por cento) sobre o valor
efetivamente recuperado ou compensado.

3.2. "Valor efetivamente recuperado ou compensado" significa:
a) Valor creditado em conta (restituicao em especie);
b) Valor compensado com tributos (PER/DCOMP ou equivalente estadual);
c) Valor de credito utilizado ou transferido (ICMS acumulado).

3.3. Remuneracao devida em ate 15 dias uteis do efetivo proveito
economico.

3.4. CONTRATANTE informara a CONTRATADA em ate 5 dias uteis qualquer
evento de recuperacao/compensacao.

3.5. Pagamento via PIX (dados da Clausula Segunda, item 2.2).

CLAUSULA QUARTA — DAS OBRIGACOES DA CONTRATADA

4.1. A CONTRATADA se obriga a:
a) Disponibilizar a plataforma TaxCredit Enterprise;
b) Realizar analise tecnica com IA e revisao especializada;
c) Gerar relatorio de oportunidades com fundamentacao legal;
d) Gerar documentacao de suporte para protocolo;
e) Fornecer checklist de documentos por estado/esfera federal;
f) Manter sigilo (Clausula Setima);
g) Conformidade com LGPD (Lei 13.709/2018).

CLAUSULA QUINTA — DAS OBRIGACOES DA CONTRATANTE

5.1. A CONTRATANTE se obriga a:
a) Fornecer documentos fiscais/contabeis completos e tempestivos;
b) Garantir veracidade e integridade dos documentos;
c) Contratar advogado habilitado para protocolar, revisar e assinar;
d) Efetuar pagamentos nos termos e prazos;
e) Informar tempestivamente sobre recuperacao/compensacao de creditos;
f) Manter dados cadastrais atualizados.

CLAUSULA SEXTA — DA RESPONSABILIDADE

6.1. A CONTRATADA nao se responsabiliza por:
a) Indeferimentos, glosas ou questionamentos das autoridades fiscais;
b) Incorrecoes nos documentos fornecidos;
c) Atuacao do advogado contratado pela CONTRATANTE;
d) Alteracoes legislativas supervenientes;
e) Demora dos orgaos publicos.

6.2. Valores do relatorio sao estimativas baseadas nos documentos e
legislacao vigente.

CLAUSULA SETIMA — SIGILO E PROTECAO DE DADOS

7.1. Sigilo absoluto sobre informacoes trocadas, pelo prazo de 5 anos
apos termino do Contrato.

7.2. Tratamento de dados pessoais conforme LGPD, exclusivamente para
finalidade contratual.

CLAUSULA OITAVA — PRAZO E RESCISAO

8.1. Prazo: 12 meses, renovacao automatica por periodos iguais, salvo
aviso previo de 30 dias.

8.2. Rescisao por: acordo mutuo; descumprimento (15 dias para
regularizacao); qualquer parte com aviso de 30 dias.

8.3. Rescisao nao exime pagamento sobre creditos ja recuperados ou em
processo iniciado durante a vigencia.

CLAUSULA NONA — DEVOLUCAO DA TAXA DE ADESAO

9.1. Devolucao integral somente se analise concluir inexistencia de
qualquer oportunidade (resultado zero).

9.2. Devolucao em ate 15 dias uteis, via PIX.

CLAUSULA DECIMA — DISPOSICOES GERAIS

10.1. Este Contrato constitui entendimento integral entre as Partes.
10.2. Alteracoes validas apenas por escrito e assinadas por ambas.
10.3. Tolerancia nao implica renuncia.
10.4. Obriga as Partes e seus sucessores.

CLAUSULA DECIMA PRIMEIRA — DO FORO

11.1. Foro da Comarca de Sao Paulo/SP, com renuncia a qualquer outro.

E por estarem justas e contratadas:

${params.cidadeContrato || 'Sao Paulo'}, ${params.dataContrato || new Date().toLocaleDateString('pt-BR')}

_______________________________________
ATOM BRASIL DIGITAL LTDA
${params.representantePlataforma || '[Representante]'}
CNPJ: ${params.cnpjPlataforma || '[CNPJ]'}

_______________________________________
${params.empresaClienteNome || '[EMPRESA CLIENTE]'}
${params.representanteCliente || '[Representante]'}
CNPJ: ${params.cnpjCliente || '[CNPJ]'}

TESTEMUNHAS:
1. _______________________________ Nome: _________________ CPF: _______________
2. _______________________________ Nome: _________________ CPF: _______________
=============================================================================`;
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
  const map: Record<number, string> = {
    10: 'dez', 15: 'quinze', 20: 'vinte', 25: 'vinte e cinco', 30: 'trinta',
    35: 'trinta e cinco', 40: 'quarenta', 45: 'quarenta e cinco', 50: 'cinquenta',
    55: 'cinquenta e cinco', 60: 'sessenta', 65: 'sessenta e cinco', 70: 'setenta',
    75: 'setenta e cinco', 80: 'oitenta', 85: 'oitenta e cinco', 90: 'noventa',
    95: 'noventa e cinco', 100: 'cem',
  };
  return map[value] || String(value);
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
  };
  return fundamentacoes[uf] || fundamentacoes['SP'];
}
