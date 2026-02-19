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

3.2. "Valor efetivamente recuperado ou compensado" significa:
a) Valor creditado em conta corrente (restituicao em especie);
b) Valor compensado com tributos devidos (PER/DCOMP ou equivalente estadual);
c) Valor de credito utilizado, transferido ou habilitado (ICMS acumulado,
   precatorios).

3.3. Os percentuais acima incidem sobre o valor BRUTO recuperado, sem
deducao de custos processuais, administrativos ou honorarios advocaticios,
que ja estao incluidos na parte da TAXCREDIT.

3.4. Estimativa de creditos identificados: R$ ${formatNumber(params.valorEstimado || 0)} conforme
relatorio de analise anexo, sujeito a confirmacao documental.

CLAUSULA QUARTA — DA CONTA ESCROW (BANCO FIBRA)

4.1. Para garantia e seguranca de ambas as Partes, todos os valores
recuperados serao recebidos exclusivamente por meio de CONTA ESCROW
mantida junto ao ${BANCO_FIBRA.nome} (CNPJ ${BANCO_FIBRA.cnpj}).

4.2. Estrutura da conta escrow:
a) Modalidade: Conta escrow com split automatico de pagamentos;
b) Administracao: ${BANCO_FIBRA.nome}, instituicao financeira regulada
   pelo Banco Central do Brasil;
c) Finalidade: EXCLUSIVA para recebimento de creditos tributarios
   objeto deste contrato.

4.3. Dados da conta escrow:
   Banco: ${BANCO_FIBRA.nome}
   CNPJ: ${BANCO_FIBRA.cnpj}
   Agencia: ${params.escrowAgencia || '[AGENCIA]'}
   Conta: ${params.escrowConta || '[CONTA]'}

4.4. SPLIT AUTOMATICO: Ao receber os valores na conta escrow, o Banco
Fibra realizara automaticamente a distribuicao conforme percentuais
da Clausula Terceira:
   - ${pctCliente}% -> conta corrente do CLIENTE
   - ${pctPlataforma}% -> conta corrente da TAXCREDIT

4.5. O split sera realizado em ate 48 (quarenta e oito) horas uteis
do efetivo recebimento na conta escrow.

4.6. VEDACOES AO CLIENTE: E expressamente vedado ao CLIENTE:
a) Solicitar alteracao dos dados bancarios de restituicao perante
   Receita Federal, SEFAZ ou outros orgaos sem autorizacao previa
   e escrita da TAXCREDIT;
b) Solicitar restituicao em conta diversa da conta escrow;
c) Compensar creditos unilateralmente sem autorizacao da TAXCREDIT.

4.7. O descumprimento das vedacoes acima configura inadimplemento grave,
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
   de recuperacao ou compensacao de creditos;
f) Nao contratar terceiros para recuperacao dos mesmos creditos
   durante a vigencia deste contrato;
g) Manter dados cadastrais atualizados.

CLAUSULA OITAVA — DAS PENALIDADES

8.1. Em caso de descumprimento grave (alteracao de dados bancarios
sem autorizacao, revogacao de procuracao sem justa causa, recebimento
de creditos sem repasse, contratacao de terceiros para mesmos creditos):
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

3.2. "Valor efetivamente recuperado ou compensado" significa:
a) Valor creditado em conta corrente (restituicao em especie);
b) Valor compensado com tributos devidos (PER/DCOMP ou equivalente estadual);
c) Valor de credito utilizado, transferido ou habilitado (ICMS acumulado,
   precatorios).

3.3. Os percentuais acima incidem sobre o valor BRUTO recuperado, sem
deducao de custos processuais, administrativos ou honorarios advocaticios,
que ja estao incluidos na parte da TAXCREDIT.

3.4. O PARCEIRO e remunerado pela indicacao e/ou acompanhamento da
operacao. Seu percentual e oriundo da parte da TAXCREDIT, nao
onerando o CLIENTE.

3.5. Estimativa de creditos identificados: R$ ${formatNumber(params.valorEstimado || 0)} conforme
relatorio de analise anexo, sujeito a confirmacao documental.

CLAUSULA QUARTA — DA CONTA ESCROW (BANCO FIBRA)

4.1. Para garantia e seguranca de todas as Partes, todos os valores
recuperados serao recebidos exclusivamente por meio de CONTA ESCROW
mantida junto ao ${BANCO_FIBRA.nome} (CNPJ ${BANCO_FIBRA.cnpj}).

4.2. Estrutura da conta escrow:
a) Modalidade: Conta escrow com split automatico de pagamentos;
b) Administracao: ${BANCO_FIBRA.nome}, instituicao financeira regulada
   pelo Banco Central do Brasil;
c) Finalidade: EXCLUSIVA para recebimento de creditos tributarios
   objeto deste contrato.

4.3. Dados da conta escrow:
   Banco: ${BANCO_FIBRA.nome}
   CNPJ: ${BANCO_FIBRA.cnpj}
   Agencia: ${params.escrowAgencia || '[AGENCIA]'}
   Conta: ${params.escrowConta || '[CONTA]'}

4.4. SPLIT AUTOMATICO em 3 vias: Ao receber os valores na conta escrow,
o Banco Fibra realizara automaticamente a distribuicao conforme
percentuais da Clausula Terceira:
   - ${pctCliente}% -> conta corrente do CLIENTE
   - ${pctPlataforma}% -> conta corrente da TAXCREDIT
   - ${pctParceiro}% -> conta corrente do PARCEIRO

Dados bancarios do PARCEIRO para split:
   Banco: ${params.parceiroBanco || '[BANCO]'}
   Agencia: ${params.parceiroAgencia || '[AGENCIA]'}
   Conta: ${params.parceiroConta || '[CONTA]'}
   Titular: ${params.parceiroTitular || '[TITULAR]'}
   CPF/CNPJ: ${params.parceiroDocBanco || '[DOC]'}

4.5. O split sera realizado em ate 48 (quarenta e oito) horas uteis
do efetivo recebimento na conta escrow.

4.6. VEDACOES AO CLIENTE: E expressamente vedado ao CLIENTE:
a) Solicitar alteracao dos dados bancarios de restituicao perante
   Receita Federal, SEFAZ ou outros orgaos sem autorizacao previa
   e escrita da TAXCREDIT;
b) Solicitar restituicao em conta diversa da conta escrow;
c) Compensar creditos unilateralmente sem autorizacao da TAXCREDIT.

4.7. O descumprimento das vedacoes acima configura inadimplemento grave,
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
   de recuperacao ou compensacao de creditos;
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
de creditos sem repasse, contratacao de terceiros para mesmos creditos):
a) Multa compensatoria de 30% sobre o valor total dos creditos
   identificados;
b) Rescisao imediata do contrato;
c) Execucao das garantias, se houver.

9.2. Em caso de descumprimento leve (atraso em documentos, nao
atualizacao cadastral): prazo de 15 dias para regularizacao.

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
