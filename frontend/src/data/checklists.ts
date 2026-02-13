// ============================================================
// CHECKLISTS DE FORMALIZACAO POR ESTADO + FEDERAL
// Dados prontos para uso nos componentes React
// ============================================================

export interface ChecklistItem {
  id: string;
  descricao: string;
  obrigatorio: boolean;
  tipo: 'documento_empresa' | 'procuracao' | 'certidao' | 'certificado' | 'fiscal' | 'demonstrativo' | 'procedimento';
  condicao?: string;
}

export interface ChecklistEtapa {
  ordem: number;
  titulo: string;
  prazo?: string;
  itens: ChecklistItem[];
}

export interface ChecklistEstado {
  uf: string;
  nome: string;
  sistema: string;
  legislacao: string;
  etapas: ChecklistEtapa[];
}

export const CHECKLISTS: Record<string, ChecklistEstado> = {
  SP: {
    uf: 'SP',
    nome: 'Sao Paulo',
    sistema: 'e-CredAc',
    legislacao: 'RICMS/SP Decreto 45.490/2000, Arts. 71-81',
    etapas: [
      {
        ordem: 1,
        titulo: 'Documentacao Previa',
        prazo: 'Antes do protocolo',
        itens: [
          { id: 'SP-01', descricao: 'Contrato Social consolidado ou ultima alteracao', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'SP-02', descricao: 'Comprovante de inscricao CNPJ (atualizado)', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'SP-03', descricao: 'Inscricao Estadual ativa no CADESP', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'SP-04', descricao: 'Procuracao especifica para advogado (protocolo SEFAZ/SP)', obrigatorio: true, tipo: 'procuracao' },
          { id: 'SP-05', descricao: 'CND Tributaria Estadual (ou Positiva com Efeitos de Negativa)', obrigatorio: true, tipo: 'certidao' },
          { id: 'SP-06', descricao: 'Certificado digital e-CNPJ (ICP-Brasil, A1 ou A3) para e-CredAc', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2,
        titulo: 'Documentacao Fiscal',
        prazo: 'Periodos de apuracao dos creditos',
        itens: [
          { id: 'SP-07', descricao: 'EFD ICMS/IPI (SPED Fiscal) dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SP-08', descricao: 'NF-es (XMLs) entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SP-09', descricao: 'GIA (Guia de Informacao e Apuracao do ICMS)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SP-10', descricao: 'Demonstrativo de Credito Acumulado (e-CredAc)', obrigatorio: true, tipo: 'demonstrativo' },
          { id: 'SP-11', descricao: 'DIPAM (se aplicavel)', obrigatorio: false, tipo: 'fiscal' },
        ],
      },
      {
        ordem: 3,
        titulo: 'Apropriacao no e-CredAc',
        prazo: 'Apos documentacao fiscal',
        itens: [
          { id: 'SP-12', descricao: 'Acessar e-CredAc com certificado digital', obrigatorio: true, tipo: 'procedimento' },
          { id: 'SP-13', descricao: 'Realizar Apropriacao do Credito Acumulado', obrigatorio: true, tipo: 'procedimento' },
          { id: 'SP-14', descricao: 'Aguardar validacao eletronica SEFAZ/SP', obrigatorio: true, tipo: 'procedimento' },
          { id: 'SP-15', descricao: 'Obter extrato de credito disponivel', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
      {
        ordem: 4,
        titulo: 'Utilizacao/Transferencia',
        prazo: 'Apos credito apropriado',
        itens: [
          { id: 'SP-16', descricao: 'Solicitar utilizacao ou transferencia no e-CredAc', obrigatorio: true, tipo: 'procedimento' },
          { id: 'SP-17', descricao: 'Emitir NF-e de transferencia (se a terceiros)', obrigatorio: false, tipo: 'procedimento' },
          { id: 'SP-18', descricao: 'Acompanhar deferimento pelo e-CredAc', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  RJ: {
    uf: 'RJ',
    nome: 'Rio de Janeiro',
    sistema: 'SEI-RJ + EFD',
    legislacao: 'RICMS/RJ Decreto 27.427/2000, Livro III (Decreto 46.668/2019)',
    etapas: [
      {
        ordem: 1,
        titulo: 'Documentacao Previa',
        prazo: 'Antes do protocolo',
        itens: [
          { id: 'RJ-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'RJ-02', descricao: 'Comprovante CNPJ', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'RJ-03', descricao: 'Inscricao Estadual ativa no CADERJ', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'RJ-04', descricao: 'Procuracao especifica para advogado', obrigatorio: true, tipo: 'procuracao' },
          { id: 'RJ-05', descricao: 'CND Tributaria Estadual SEFAZ/RJ', obrigatorio: true, tipo: 'certidao' },
          { id: 'RJ-06', descricao: 'Certificado digital e-CNPJ para SEI-RJ', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2,
        titulo: 'Documentacao Fiscal',
        prazo: 'Periodos de apuracao',
        itens: [
          { id: 'RJ-07', descricao: 'EFD ICMS/IPI todos os periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RJ-08', descricao: 'NF-es entrada e saida (XMLs)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RJ-09', descricao: 'GIA-ICMS (inclui subficha Saldo Credor Exportacao)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RJ-10', descricao: 'DECLAN-IPM', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RJ-11', descricao: 'Demonstrativo de calculo saldo credor (Arts. 3/6 Livro III)', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3,
        titulo: 'Protocolo via SEI-RJ',
        prazo: 'Apos compilacao',
        itens: [
          { id: 'RJ-12', descricao: 'Criar processo no SEI-RJ', obrigatorio: true, tipo: 'procedimento' },
          { id: 'RJ-13', descricao: 'Protocolar Requerimento a Auditoria Fiscal competente', obrigatorio: true, tipo: 'procedimento' },
          { id: 'RJ-14', descricao: 'Anexar documentos e demonstrativos', obrigatorio: true, tipo: 'procedimento' },
          { id: 'RJ-15', descricao: 'Aguardar analise e diligencias', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
      {
        ordem: 4,
        titulo: 'Autorizacao e Execucao',
        prazo: 'Apos deferimento',
        itens: [
          { id: 'RJ-16', descricao: 'Obter autorizacao do Secretario de Fazenda (transferencia a terceiros)', obrigatorio: true, tipo: 'procedimento', condicao: 'Se transferencia a terceiros' },
          { id: 'RJ-17', descricao: 'Emitir NF-e de transferencia', obrigatorio: false, tipo: 'procedimento' },
          { id: 'RJ-18', descricao: 'Registrar na EFD e GIA-ICMS', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  MG: {
    uf: 'MG',
    nome: 'Minas Gerais',
    sistema: 'DCA-ICMS',
    legislacao: 'RICMS/MG Decreto 43.080/2002, Anexo VIII',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'MG-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'MG-02', descricao: 'CNPJ e IE ativa', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'MG-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'MG-04', descricao: 'CND SEFAZ/MG', obrigatorio: true, tipo: 'certidao' },
          { id: 'MG-05', descricao: 'Certificado digital e-CNPJ para SIARE/DCA-ICMS', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal',
        itens: [
          { id: 'MG-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MG-07', descricao: 'DAPI (Declaracao de Apuracao ICMS)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MG-08', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MG-09', descricao: 'Demonstrativo DCA-ICMS (SIARE)', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo DCA-ICMS',
        itens: [
          { id: 'MG-10', descricao: 'Acessar SIARE/DCA-ICMS com certificado digital', obrigatorio: true, tipo: 'procedimento' },
          { id: 'MG-11', descricao: 'Preencher pedido de apropriacao/transferencia', obrigatorio: true, tipo: 'procedimento' },
          { id: 'MG-12', descricao: 'Transmitir e acompanhar', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  RS: {
    uf: 'RS',
    nome: 'Rio Grande do Sul',
    sistema: 'e-CAC RS + Protocolo',
    legislacao: 'RICMS/RS Decreto 37.699/1997, Arts. 58-59',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'RS-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'RS-02', descricao: 'CNPJ e IE ativa', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'RS-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'RS-04', descricao: 'Certidao Situacao Fiscal SEFAZ/RS', obrigatorio: true, tipo: 'certidao' },
          { id: 'RS-05', descricao: 'Certificado digital e-CNPJ para e-CAC/RS', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal',
        itens: [
          { id: 'RS-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RS-07', descricao: 'GIA-RS dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RS-08', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'RS-09', descricao: 'Demonstrativo saldo credor', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo',
        itens: [
          { id: 'RS-10', descricao: 'Protocolar via e-CAC/RS ou Delegacia da Receita Estadual', obrigatorio: true, tipo: 'procedimento' },
          { id: 'RS-11', descricao: 'Aguardar analise fiscal', obrigatorio: true, tipo: 'procedimento' },
          { id: 'RS-12', descricao: 'Obter autorizacao (se transferencia)', obrigatorio: false, tipo: 'procedimento' },
        ],
      },
    ],
  },
  PR: {
    uf: 'PR',
    nome: 'Parana',
    sistema: 'SISCRED',
    legislacao: 'RICMS/PR Decreto 7.871/2017, Arts. 47-61',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'PR-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'PR-02', descricao: 'CNPJ e IE ativa no CAD/ICMS-PR', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'PR-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'PR-04', descricao: 'CND SEFAZ/PR', obrigatorio: true, tipo: 'certidao' },
          { id: 'PR-05', descricao: 'Certificado digital e-CNPJ para Receita/PR e SISCRED', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal + Habilitacao',
        itens: [
          { id: 'PR-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'PR-07', descricao: 'GIA-PR / EFD dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'PR-08', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'PR-09', descricao: 'Habilitacao previa no SISCRED', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo SISCRED',
        itens: [
          { id: 'PR-10', descricao: 'Acessar SISCRED via Receita/PR', obrigatorio: true, tipo: 'procedimento' },
          { id: 'PR-11', descricao: 'Solicitar habilitacao do credito acumulado', obrigatorio: true, tipo: 'procedimento' },
          { id: 'PR-12', descricao: 'Aguardar validacao da Inspetoria Geral de Fiscalizacao', obrigatorio: true, tipo: 'procedimento' },
          { id: 'PR-13', descricao: 'Emitir NF-e de transferencia apos autorizacao', obrigatorio: false, tipo: 'procedimento' },
        ],
      },
    ],
  },
  SC: {
    uf: 'SC',
    nome: 'Santa Catarina',
    sistema: 'Reserva + TTD',
    legislacao: 'RICMS/SC Decreto 2.870/2001, Arts. 40-52',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'SC-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'SC-02', descricao: 'CNPJ e IE ativa no CCICMS/SC', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'SC-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'SC-04', descricao: 'CND SEFAZ/SC', obrigatorio: true, tipo: 'certidao' },
          { id: 'SC-05', descricao: 'Certificado digital e-CNPJ para SAT', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal',
        itens: [
          { id: 'SC-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SC-07', descricao: 'DIME (Declaracao ICMS e Movimento Economico)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SC-08', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'SC-09', descricao: 'Demonstrativo creditos acumulados', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo — Reserva de Credito',
        itens: [
          { id: 'SC-10', descricao: 'Solicitar Reserva de Credito no SAT/SEFAZ-SC', obrigatorio: true, tipo: 'procedimento' },
          { id: 'SC-11', descricao: 'Requerer TTD (Tratamento Tributario Diferenciado) se transferencia', obrigatorio: false, tipo: 'procedimento' },
          { id: 'SC-12', descricao: 'Aguardar homologacao da reserva', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  BA: {
    uf: 'BA',
    nome: 'Bahia',
    sistema: 'E-mail + DT-e',
    legislacao: 'RICMS/BA Decreto 13.780/2012, Art. 317',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'BA-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'BA-02', descricao: 'CNPJ e IE ativa no CAD-ICMS/BA', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'BA-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'BA-04', descricao: 'CND SEFAZ/BA', obrigatorio: true, tipo: 'certidao' },
          { id: 'BA-05', descricao: 'Certificado digital e-CNPJ', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal',
        itens: [
          { id: 'BA-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'BA-07', descricao: 'DMA (Declaracao e Apuracao Mensal ICMS)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'BA-08', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'BA-09', descricao: 'Demonstrativo creditos acumulados', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo',
        itens: [
          { id: 'BA-10', descricao: 'Protocolar na Inspetoria Fazendaria ou via DT-e', obrigatorio: true, tipo: 'procedimento' },
          { id: 'BA-11', descricao: 'Alternativa: e-mail institucional SEFAZ/BA', obrigatorio: false, tipo: 'procedimento' },
          { id: 'BA-12', descricao: 'Aguardar analise e despacho', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  MT: {
    uf: 'MT',
    nome: 'Mato Grosso',
    sistema: 'PAC-e/RUC-e + EFD',
    legislacao: 'RICMS/MT Decreto 2.212/2014, Arts. 99-125',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'MT-01', descricao: 'Contrato Social consolidado', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'MT-02', descricao: 'CNPJ e IE ativa no CCE/MT', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'MT-03', descricao: 'Procuracao especifica', obrigatorio: true, tipo: 'procuracao' },
          { id: 'MT-04', descricao: 'CND SEFAZ/MT', obrigatorio: true, tipo: 'certidao' },
          { id: 'MT-05', descricao: 'Certificado digital e-CNPJ para PAC-e', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal',
        itens: [
          { id: 'MT-06', descricao: 'EFD ICMS/IPI dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MT-07', descricao: 'NF-es entrada e saida', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MT-08', descricao: 'GIA-ICMS ou equivalente', obrigatorio: true, tipo: 'fiscal' },
          { id: 'MT-09', descricao: 'Demonstrativo para PAC-e', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo PAC-e/RUC-e',
        itens: [
          { id: 'MT-10', descricao: 'Acessar PAC-e ou RUC-e', obrigatorio: true, tipo: 'procedimento' },
          { id: 'MT-11', descricao: 'Preencher pedido com dados da EFD', obrigatorio: true, tipo: 'procedimento' },
          { id: 'MT-12', descricao: 'Transmitir e aguardar validacao', obrigatorio: true, tipo: 'procedimento' },
          { id: 'MT-13', descricao: 'Acompanhar pelo portal SEFAZ/MT', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  ES: {
    uf: 'ES',
    nome: 'Espirito Santo',
    sistema: 'DT-e (Domicilio Tributario Eletronico) / Protocolo presencial na Agencia da Receita Estadual',
    legislacao: 'RICMS/ES (Decreto 1.090-R/2002), Arts. 103 e seguintes + Portaria SEFAZ 015-R/2018',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        prazo: 'Antes do protocolo',
        itens: [
          { id: 'ES-01', descricao: 'Contrato Social consolidado ou ultima alteracao', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'ES-02', descricao: 'Comprovante de inscricao CNPJ (atualizado)', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'ES-03', descricao: 'Inscricao Estadual ativa no Cadastro de Contribuintes ICMS/ES', obrigatorio: true, tipo: 'documento_empresa' },
          { id: 'ES-04', descricao: 'Procuracao especifica para advogado (protocolo SEFAZ/ES)', obrigatorio: true, tipo: 'procuracao' },
          { id: 'ES-05', descricao: 'CND Tributaria Estadual (ou Positiva com Efeitos de Negativa) emitida pela SEFAZ/ES', obrigatorio: true, tipo: 'certidao' },
          { id: 'ES-06', descricao: 'Certificado digital e-CNPJ (ICP-Brasil, A1 ou A3) para acesso ao DT-e', obrigatorio: true, tipo: 'certificado' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal Comprobatoria',
        prazo: 'Preparar antes do protocolo',
        itens: [
          { id: 'ES-07', descricao: 'EFD ICMS/IPI dos periodos de acumulo do credito (ultimos 5 anos)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'ES-08', descricao: 'Notas Fiscais Eletronicas (NF-e) de exportacao dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'ES-09', descricao: 'Notas Fiscais de entrada (insumos, energia, frete) que geraram credito', obrigatorio: true, tipo: 'fiscal' },
          { id: 'ES-10', descricao: 'Demonstrativo de Exportacao (DDE / Registro de Exportacao)', obrigatorio: true, tipo: 'fiscal' },
          { id: 'ES-11', descricao: 'GIA-ST ou DIEF/ES dos periodos (se aplicavel)', obrigatorio: false, tipo: 'fiscal', condicao: 'ICMS-ST' },
          { id: 'ES-12', descricao: 'Memoria de calculo dos creditos acumulados (gerada pela plataforma TaxCredit Enterprise)', obrigatorio: true, tipo: 'demonstrativo' },
          { id: 'ES-13', descricao: 'Demonstrativo de saldo credor acumulado por periodo', obrigatorio: true, tipo: 'demonstrativo' },
          { id: 'ES-14', descricao: 'Comprovantes de contas de energia eletrica (se credito sobre energia)', obrigatorio: false, tipo: 'fiscal', condicao: 'Credito de energia' },
        ],
      },
      {
        ordem: 3, titulo: 'Protocolo na SEFAZ/ES',
        prazo: 'Apos reunir toda documentacao',
        itens: [
          { id: 'ES-15', descricao: 'Acessar DT-e com certificado digital ou ir presencialmente na Agencia da Receita Estadual', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-16', descricao: 'Preencher Requerimento de Transferencia/Utilizacao/Restituicao de Credito Acumulado (gerado pela plataforma)', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-17', descricao: 'Anexar toda documentacao comprobatoria digitalizada', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-18', descricao: 'Protocolar e guardar numero do processo/recibo', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-19', descricao: 'Se transferencia a terceiros: informar CNPJ/IE do destinatario', obrigatorio: false, tipo: 'procedimento', condicao: 'Transferencia a terceiros' },
        ],
      },
      {
        ordem: 4, titulo: 'Acompanhamento',
        prazo: 'Ate 180 dias (media)',
        itens: [
          { id: 'ES-20', descricao: 'Acompanhar andamento pelo DT-e ou Agencia da Receita', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-21', descricao: 'Responder intimacoes e diligencias nos prazos legais', obrigatorio: true, tipo: 'procedimento' },
          { id: 'ES-22', descricao: 'Se indeferido: recurso administrativo ao Conselho de Recursos Fiscais (CRF/ES) em 30 dias', obrigatorio: false, tipo: 'procedimento', condicao: 'Indeferimento' },
          { id: 'ES-23', descricao: 'Apos deferimento: confirmar efetivacao da transferencia/compensacao/restituicao', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
    ],
  },
  FEDERAL: {
    uf: 'FEDERAL',
    nome: 'Federal (PER/DCOMP)',
    sistema: 'PER/DCOMP Web + e-CAC',
    legislacao: 'Lei 9.430/1996, Art. 74 + IN RFB 2.055/2021',
    etapas: [
      {
        ordem: 1, titulo: 'Documentacao Previa',
        itens: [
          { id: 'FED-01', descricao: 'Conta gov.br Ouro com certificado digital e-CNPJ', obrigatorio: true, tipo: 'certificado' },
          { id: 'FED-02', descricao: 'Procuracao eletronica no e-CAC (se representante)', obrigatorio: false, tipo: 'procuracao' },
          { id: 'FED-03', descricao: 'CND ou CPEND da Receita Federal (recomendado)', obrigatorio: false, tipo: 'certidao' },
        ],
      },
      {
        ordem: 2, titulo: 'Documentacao Fiscal Comprobatoria',
        itens: [
          { id: 'FED-04', descricao: 'ECF dos exercicios (se IRPJ/CSLL)', obrigatorio: true, tipo: 'fiscal', condicao: 'IRPJ/CSLL' },
          { id: 'FED-05', descricao: 'EFD-Contribuicoes (se PIS/COFINS)', obrigatorio: true, tipo: 'fiscal', condicao: 'PIS/COFINS' },
          { id: 'FED-06', descricao: 'DARFs pagos (se pagamento indevido)', obrigatorio: true, tipo: 'fiscal', condicao: 'Pagamento indevido' },
          { id: 'FED-07', descricao: 'DCTF / DCTFWeb dos periodos', obrigatorio: true, tipo: 'fiscal' },
          { id: 'FED-08', descricao: 'NF-es de insumos (se PIS/COFINS nao-cumulativo)', obrigatorio: true, tipo: 'fiscal', condicao: 'PIS/COFINS insumos' },
          { id: 'FED-09', descricao: 'Parecer Tecnico TaxCredit Enterprise', obrigatorio: true, tipo: 'demonstrativo' },
        ],
      },
      {
        ordem: 3, titulo: 'Transmissao PER/DCOMP Web',
        itens: [
          { id: 'FED-10', descricao: 'Acessar e-CAC > PER/DCOMP Web', obrigatorio: true, tipo: 'procedimento' },
          { id: 'FED-11', descricao: 'Se PIS/COFINS: transmitir Ressarcimento PRIMEIRO', obrigatorio: true, tipo: 'procedimento', condicao: 'PIS/COFINS insumos' },
          { id: 'FED-12', descricao: 'Criar Declaracao de Compensacao com dados do Guia', obrigatorio: true, tipo: 'procedimento' },
          { id: 'FED-13', descricao: 'Transmitir e guardar recibo PDF', obrigatorio: true, tipo: 'procedimento' },
        ],
      },
      {
        ordem: 4, titulo: 'Acompanhamento',
        prazo: 'Ate 5 anos',
        itens: [
          { id: 'FED-14', descricao: 'Acompanhar status no e-CAC', obrigatorio: true, tipo: 'procedimento' },
          { id: 'FED-15', descricao: 'Responder intimacoes nos prazos', obrigatorio: true, tipo: 'procedimento' },
          { id: 'FED-16', descricao: 'Se nao homologado: Manifestacao de Inconformidade (30 dias)', obrigatorio: false, tipo: 'procedimento', condicao: 'Nao homologacao' },
        ],
      },
    ],
  },
};

export const UF_OPTIONS = Object.keys(CHECKLISTS).map(uf => ({
  value: uf,
  label: CHECKLISTS[uf].nome,
}));

export const TIPO_LABELS: Record<string, string> = {
  documento_empresa: 'Documento da Empresa',
  procuracao: 'Procuracao',
  certidao: 'Certidao',
  certificado: 'Certificado Digital',
  fiscal: 'Documento Fiscal',
  demonstrativo: 'Demonstrativo',
  procedimento: 'Procedimento',
};

export const TIPO_COLORS: Record<string, string> = {
  documento_empresa: 'bg-blue-100 text-blue-700',
  procuracao: 'bg-purple-100 text-purple-700',
  certidao: 'bg-amber-100 text-amber-700',
  certificado: 'bg-red-100 text-red-700',
  fiscal: 'bg-green-100 text-green-700',
  demonstrativo: 'bg-indigo-100 text-indigo-700',
  procedimento: 'bg-gray-100 text-gray-700',
};
