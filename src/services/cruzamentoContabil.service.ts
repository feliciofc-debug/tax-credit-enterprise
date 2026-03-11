// src/services/cruzamentoContabil.service.ts
// Cruzamento Contábil — Análise ECD conta por conta, identificando créditos PIS/COFINS
// Modelo de excelência inspirado em relatórios de consultorias tributárias de referência

import { EcdData, EfdContribData, ContaAnual, MovimentoConta } from './zipProcessor.service';
import { logger } from '../utils/logger';

const PIS_RATE = 0.0165;
const COFINS_RATE = 0.0760;

// ============================================================
// 1. CLASSIFICAÇÃO DE CONTAS ELEGÍVEIS PIS/COFINS
// ============================================================

const KEYWORDS_ELIGIBLE = [
  'energia', 'eletrica', 'elétrica', 'luz',
  'agua', 'água', 'saneamento',
  'telecomunica', 'telefone', 'internet', 'celular',
  'aluguel', 'aluguéis', 'locação', 'locacao', 'arrendamento',
  'frete', 'transporte', 'logistica', 'logística', 'combustivel', 'combustível', 'pedagio', 'pedágio',
  'manutencao', 'manutenção', 'reparo', 'conservação', 'conservacao',
  'seguro', 'seguros',
  'embalagem', 'embalagens',
  'materia prima', 'matéria prima', 'matéria-prima', 'insumo', 'insumos',
  'serviço', 'servico', 'serviços', 'servicos', 'consultoria', 'assessoria', 'honorario', 'honorário',
  'publicidade', 'propaganda', 'marketing',
  'viagem', 'hospedagem', 'diaria', 'diária',
  'copa', 'cozinha', 'alimentação', 'alimentacao', 'refeição', 'refeicao', 'vale refeição',
  'limpeza', 'higiene', 'conservação', 'zeladoria',
  'material', 'escritório', 'escritorio', 'expediente',
  'empilhadeira', 'equipamento', 'ferramenta', 'peça', 'peca',
  'uniforme', 'epi', 'segurança do trabalho',
  'despesa comercial', 'despesas comerciais', 'comissão', 'comissao', 'comissões',
  'tarifa', 'tarifas', 'taxa', 'bancaria', 'bancária', 'banco',
  'juro', 'juros', 'encargo', 'encargos financeiros',
  'empréstimo', 'emprestimo', 'financiamento',
  'armazenagem', 'armazenamento', 'estocagem',
  'terceirizad', 'mão de obra', 'mao de obra',
  'tecnologia', 'software', 'licença', 'licenca', 'sistema',
  'correio', 'cartório', 'despachante',
  'laboratório', 'laboratorio', 'análise', 'analise', 'ensaio',
  'treinamento', 'capacitação', 'capacitacao',
  'vigilância', 'vigilancia', 'monitoramento', 'portaria',
  'custo', 'custos', 'despesa', 'despesas',
];

const KEYWORDS_EXCLUDE = [
  'depreciação', 'depreciacao', 'amortização', 'amortizacao',
  'provisão', 'provisao', 'provisões', 'provisoes',
  'imposto', 'tributo', 'irpj', 'csll', 'icms', 'iss', 'ipi',
  'pis', 'cofins', 'contribuição social', 'contribuicao social',
  'multa', 'penalidade', 'juros mora', 'juros de mora',
  'doação', 'doacao', 'doações', 'doacoes',
  'perda', 'baixa', 'sinistro',
  'folha', 'salário', 'salario', 'salários', 'salarios', 'férias', 'ferias',
  'encargo social', 'inss', 'fgts', '13° salário', '13 salario',
  'resultado', 'lucro', 'prejuízo', 'prejuizo',
  'receita', 'venda', 'faturamento',
  'ativo', 'passivo', 'patrimônio', 'patrimonio',
  'investimento', 'aplicação', 'aplicacao',
  'dividendo', 'distribuição', 'distribuicao',
];

interface ContaClassificada {
  codCta: string;
  descricao: string;
  natureza: string;
  elegivel: boolean;
  motivoElegibilidade: string;
}

function classificarConta(codCta: string, descricao: string, natureza: string): ContaClassificada {
  const desc = descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const descOriginal = descricao.toLowerCase();

  // Only expense/cost accounts (natureza 04=receita, 05=despesa/custo)
  // We want 05 (despesas/custos) primarily. Some 04 (receitas) might have adjustments but we skip them.
  if (natureza !== '05' && natureza !== '4' && natureza !== '5') {
    return { codCta, descricao, natureza, elegivel: false, motivoElegibilidade: 'Não é conta de despesa/custo' };
  }

  // Check exclusions first
  for (const kw of KEYWORDS_EXCLUDE) {
    if (descOriginal.includes(kw)) {
      return { codCta, descricao, natureza, elegivel: false, motivoElegibilidade: `Excluída: ${kw}` };
    }
  }

  // Check eligibility keywords
  for (const kw of KEYWORDS_ELIGIBLE) {
    if (descOriginal.includes(kw)) {
      return { codCta, descricao, natureza, elegivel: true, motivoElegibilidade: `Insumo: ${kw}` };
    }
  }

  // Broad catch: any expense account not explicitly excluded gets flagged as potentially eligible
  // per STJ REsp 1.221.170 (broad "insumo" concept)
  if (natureza === '05' || natureza === '5') {
    return { codCta, descricao, natureza, elegivel: true, motivoElegibilidade: 'Despesa operacional — conceito amplo de insumo (STJ Tema 779)' };
  }

  return { codCta, descricao, natureza, elegivel: false, motivoElegibilidade: 'Não classificada como insumo' };
}

// ============================================================
// 2. CRUZAMENTO CONTÁBIL — ECD → Créditos PIS/COFINS
// ============================================================

export interface ResultadoCruzamento {
  empresa: string;
  cnpj: string;
  periodo: string;
  contasElegiveis: ContaAnual[];
  contasNaoElegiveis: string[];
  totalBaseCalculo: number;
  totalPis: number;
  totalCofins: number;
  totalCreditos: number;
  totalContasAnalisadas: number;
  totalContasElegiveis: number;
  anosAbrangidos: number[];
}

export function executarCruzamento(
  ecdData: EcdData,
  efdContrib?: EfdContribData
): ResultadoCruzamento {
  const movimentos = ecdData.movimentosDetalhados || [];
  const planoContas = ecdData.planoContas || [];

  // Build account info map
  const contaInfoMap = new Map<string, { descricao: string; natureza: string }>();
  for (const conta of planoContas) {
    contaInfoMap.set(conta.codigo, { descricao: conta.descricao, natureza: conta.natureza });
  }

  // Group movements by account code
  const contaMovMap = new Map<string, MovimentoConta[]>();
  for (const mov of movimentos) {
    if (!contaMovMap.has(mov.codCta)) contaMovMap.set(mov.codCta, []);
    contaMovMap.get(mov.codCta)!.push(mov);
  }

  const contasElegiveis: ContaAnual[] = [];
  const contasNaoElegiveis: string[] = [];
  const anosSet = new Set<number>();

  for (const [codCta, movs] of contaMovMap.entries()) {
    const info = contaInfoMap.get(codCta) || { descricao: codCta, natureza: '' };
    const classificacao = classificarConta(codCta, info.descricao, info.natureza);

    if (!classificacao.elegivel) {
      contasNaoElegiveis.push(`${codCta} ${info.descricao}`);
      continue;
    }

    // Aggregate by year
    const anoMap = new Map<number, number>();
    for (const mov of movs) {
      if (mov.ano <= 0) continue;
      anosSet.add(mov.ano);
      // For expense accounts, debits = expenses incurred = base de cálculo
      const base = mov.vlDeb;
      if (base > 0) {
        anoMap.set(mov.ano, (anoMap.get(mov.ano) || 0) + base);
      }
    }

    if (anoMap.size === 0) continue;

    const anos = Array.from(anoMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([ano, baseCalculo]) => ({
        ano,
        baseCalculo,
        vlPis: baseCalculo * PIS_RATE,
        vlCofins: baseCalculo * COFINS_RATE,
        totalCreditos: baseCalculo * PIS_RATE + baseCalculo * COFINS_RATE,
      }));

    const totalBase = anos.reduce((s, a) => s + a.baseCalculo, 0);
    const totalPis = anos.reduce((s, a) => s + a.vlPis, 0);
    const totalCofins = anos.reduce((s, a) => s + a.vlCofins, 0);
    const totalCreditos = anos.reduce((s, a) => s + a.totalCreditos, 0);

    if (totalBase > 0) {
      contasElegiveis.push({
        codCta,
        descricao: info.descricao,
        natureza: info.natureza,
        anos,
        totalBase,
        totalPis,
        totalCofins,
        totalCreditos,
      });
    }
  }

  // Sort by total credits descending
  contasElegiveis.sort((a, b) => b.totalCreditos - a.totalCreditos);

  const totalBaseCalculo = contasElegiveis.reduce((s, c) => s + c.totalBase, 0);
  const totalPis = contasElegiveis.reduce((s, c) => s + c.totalPis, 0);
  const totalCofins = contasElegiveis.reduce((s, c) => s + c.totalCofins, 0);
  const totalCreditos = contasElegiveis.reduce((s, c) => s + c.totalCreditos, 0);

  logger.info(`[CRUZAMENTO] ${contasElegiveis.length} contas elegíveis | ${contasNaoElegiveis.length} não elegíveis | Total créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  return {
    empresa: ecdData.empresa,
    cnpj: ecdData.cnpj,
    periodo: `${ecdData.periodo.inicio} a ${ecdData.periodo.fim}`,
    contasElegiveis,
    contasNaoElegiveis,
    totalBaseCalculo,
    totalPis,
    totalCofins,
    totalCreditos,
    totalContasAnalisadas: contaMovMap.size,
    totalContasElegiveis: contasElegiveis.length,
    anosAbrangidos: Array.from(anosSet).sort(),
  };
}

// ============================================================
// 3. FORMATADOR HTML — MODELO ALLINKO (conta por conta, ano a ano)
// ============================================================

export function formatExtratoCruzadoHtml(resultado: ResultadoCruzamento): string {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ano = new Date().getFullYear();

  if (resultado.contasElegiveis.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Extrato Cruzado</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:30px;font-size:12px;color:#333}
.aviso{background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin:20px 0;border-radius:4px}
h1{font-size:16px;color:#1a365d}</style></head><body>
<h1>EXTRATO CRUZADO DE CRÉDITOS TRIBUTÁRIOS</h1>
<div class="aviso"><strong>Sem dados contábeis para cruzamento.</strong><br>
Envie a ECD (Escrituração Contábil Digital) para gerar o extrato discriminado por conta contábil.</div>
</body></html>`;
  }

  // Build per-account sections
  const accountSections = resultado.contasElegiveis.map((conta, idx) => {
    const rows = conta.anos.map(a => `
      <tr>
        <td class="num">${a.ano}</td>
        <td class="num">${conta.codCta}</td>
        <td>${conta.descricao}</td>
        <td class="valor">R$ ${fmt(a.baseCalculo)}</td>
        <td class="valor">R$ ${fmt(a.vlPis)}</td>
        <td class="valor">R$ ${fmt(a.vlCofins)}</td>
        <td class="valor total-cell">R$ ${fmt(a.totalCreditos)}</td>
      </tr>`).join('');

    return `
    <div class="account-section">
      <h3>${idx + 1}) ${conta.descricao} — ${conta.codCta}</h3>
      <table>
        <thead><tr class="detail-header">
          <th>Ano</th><th>Código Conta</th><th>Descrição da Conta</th>
          <th>Base Cálculo</th><th>Vlr PIS</th><th>Vlr Cofins</th><th>Total de Créditos</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="subtotal-row">
            <td colspan="3" class="valor" style="text-align:right;padding-right:12px;">R$ ${fmt(conta.totalBase)}</td>
            <td class="valor"></td>
            <td class="valor"></td>
            <td class="valor"></td>
            <td class="valor total-cell">R$ ${fmt(conta.totalCreditos)}</td>
          </tr>
        </tbody>
      </table>
      <p class="obs"><strong>OBSERVAÇÃO:</strong> O resumo acima foi obtido direto do razão contábil da conta, extraído da ECD (Escrituração Contábil Digital). Os valores representam os lançamentos de despesas registrados na contabilidade. Os créditos de PIS (1,65%) e COFINS (7,60%) foram calculados conforme regime não-cumulativo (Leis 10.637/02 e 10.833/03), com base no conceito amplo de insumo firmado pelo STJ no REsp 1.221.170/PR (Tema 779).</p>
    </div>`;
  }).join('');

  // Summary table (top accounts)
  const summaryRows = resultado.contasElegiveis.map((conta, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td>${conta.codCta}</td>
      <td>${conta.descricao}</td>
      <td class="valor">R$ ${fmt(conta.totalBase)}</td>
      <td class="valor">R$ ${fmt(conta.totalPis)}</td>
      <td class="valor">R$ ${fmt(conta.totalCofins)}</td>
      <td class="valor total-cell">R$ ${fmt(conta.totalCreditos)}</td>
    </tr>`).join('');

  // Grand total by year
  const anoTotals = new Map<number, { base: number; pis: number; cofins: number; total: number }>();
  for (const conta of resultado.contasElegiveis) {
    for (const a of conta.anos) {
      if (!anoTotals.has(a.ano)) anoTotals.set(a.ano, { base: 0, pis: 0, cofins: 0, total: 0 });
      const entry = anoTotals.get(a.ano)!;
      entry.base += a.baseCalculo;
      entry.pis += a.vlPis;
      entry.cofins += a.vlCofins;
      entry.total += a.totalCreditos;
    }
  }
  const anoTotalRows = Array.from(anoTotals.entries()).sort(([a], [b]) => a - b).map(([anoKey, totals]) => `
    <tr>
      <td class="num">${anoKey}</td>
      <td class="valor">R$ ${fmt(totals.base)}</td>
      <td class="valor">R$ ${fmt(totals.pis)}</td>
      <td class="valor">R$ ${fmt(totals.cofins)}</td>
      <td class="valor total-cell">R$ ${fmt(totals.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Extrato Cruzado de Créditos Tributários — ${resultado.empresa}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #222; background: white; }
    .page { max-width: 210mm; margin: 0 auto; padding: 20mm 18mm; }

    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0d6e3f; padding-bottom: 8px; margin-bottom: 20px; }
    .header-logo { font-size: 18px; font-weight: bold; color: #0d6e3f; letter-spacing: 1px; }
    .header-subtitle { font-size: 10px; color: #555; text-align: center; }
    .header-right { font-size: 9px; color: #777; text-align: right; }
    .confidencial { color: #c00; font-weight: bold; }

    .company-info { margin-bottom: 20px; }
    .company-info p { margin: 3px 0; font-size: 11px; }

    h2 { font-size: 13px; color: #0d6e3f; margin: 25px 0 10px 0; border-bottom: 1px solid #0d6e3f; padding-bottom: 4px; }
    h3 { font-size: 11px; color: #d63384; margin: 20px 0 6px 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #aaa; padding: 5px 8px; text-align: left; font-size: 10px; }

    thead tr.summary-header th { background: #1a365d; color: white; font-weight: bold; }
    thead tr.detail-header th { background: #2563eb; color: white; font-weight: bold; }
    thead tr.ano-header th { background: #0d6e3f; color: white; font-weight: bold; }

    tr.total-row { background: #1a365d; color: white; font-weight: bold; }
    tr.total-row td { border-color: #1a365d; }
    tr.subtotal-row { background: #e8f5e9; font-weight: bold; }
    td.total-cell { font-weight: bold; }
    td.valor { text-align: right; font-variant-numeric: tabular-nums; }
    td.num { text-align: center; }

    .account-section { margin-bottom: 22px; page-break-inside: avoid; }
    .obs { font-size: 9px; color: #666; font-style: italic; margin: 6px 0 16px 0; line-height: 1.4; }
    .base-legal { font-size: 9px; color: #555; margin: 4px 0 2px 0; }

    .highlight-box { background: #f0fdf4; border: 2px solid #0d6e3f; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .highlight-box h3 { color: #0d6e3f; margin: 0 0 8px 0; font-size: 14px; }
    .highlight-value { font-size: 22px; font-weight: bold; color: #0d6e3f; }

    .footer { margin-top: 30px; padding-top: 10px; border-top: 2px solid #0d6e3f; font-size: 9px; color: #888; }
    .footer p { margin: 2px 0; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
    .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 16px; font-weight: bold; color: #1a365d; margin-top: 4px; }

    @media print {
      body { margin: 0; }
      .page { padding: 15mm 18mm; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .account-section { page-break-inside: avoid; }
      th, tr.total-row td, tr.subtotal-row td, td.total-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">TaxCredit Enterprise</div>
    <div class="header-subtitle">Extrato Cruzado de Créditos Tributários<br>Análise Contábil — Razão por Conta</div>
    <div class="header-right">${ano} &nbsp;&nbsp; <span class="confidencial">Confidencial</span></div>
  </div>

  <!-- COMPANY INFO -->
  <div class="company-info">
    <p><strong>Empresa:</strong> ${resultado.empresa}</p>
    ${resultado.cnpj ? `<p><strong>CNPJ:</strong> ${resultado.cnpj}</p>` : ''}
    <p><strong>Período analisado:</strong> ${resultado.periodo}</p>
    <p><strong>Data de emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
    <p><strong>Fonte dos dados:</strong> ECD — Escrituração Contábil Digital (Razão Contábil)</p>
  </div>

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-label">Contas analisadas</div>
      <div class="stat-value">${resultado.totalContasAnalisadas}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Contas elegíveis</div>
      <div class="stat-value">${resultado.totalContasElegiveis}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Anos abrangidos</div>
      <div class="stat-value">${resultado.anosAbrangidos.join(', ')}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Total de créditos</div>
      <div class="stat-value" style="color:#0d6e3f;">R$ ${fmt(resultado.totalCreditos)}</div>
    </div>
  </div>

  <!-- TOTAL HIGHLIGHT -->
  <div class="highlight-box">
    <h3>Oportunidades identificadas — Créditos PIS/COFINS sobre despesas do Razão Contábil</h3>
    <p style="font-size:11px;margin-bottom:8px;">Análise realizada sobre ${resultado.totalContasElegiveis} contas de despesa/custo elegíveis, abrangendo ${resultado.anosAbrangidos.length} ano(s) (${resultado.anosAbrangidos.join(' a ')}).</p>
    <div style="display:flex;gap:30px;align-items:baseline;">
      <div>
        <span style="font-size:10px;color:#555;">Base de Cálculo Total:</span><br>
        <span style="font-size:16px;font-weight:bold;">R$ ${fmt(resultado.totalBaseCalculo)}</span>
      </div>
      <div>
        <span style="font-size:10px;color:#555;">PIS (1,65%):</span><br>
        <span style="font-size:16px;font-weight:bold;">R$ ${fmt(resultado.totalPis)}</span>
      </div>
      <div>
        <span style="font-size:10px;color:#555;">COFINS (7,60%):</span><br>
        <span style="font-size:16px;font-weight:bold;">R$ ${fmt(resultado.totalCofins)}</span>
      </div>
      <div>
        <span style="font-size:10px;color:#555;">Total de Créditos:</span><br>
        <span class="highlight-value">R$ ${fmt(resultado.totalCreditos)}</span>
      </div>
    </div>
  </div>

  <!-- ANNUAL SUMMARY -->
  <h2>Resumo por Exercício</h2>
  <table>
    <thead><tr class="ano-header">
      <th>Ano</th><th>Base Cálculo</th><th>Vlr PIS</th><th>Vlr Cofins</th><th>Total de Créditos</th>
    </tr></thead>
    <tbody>
      ${anoTotalRows}
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="valor">R$ ${fmt(resultado.totalBaseCalculo)}</td>
        <td class="valor">R$ ${fmt(resultado.totalPis)}</td>
        <td class="valor">R$ ${fmt(resultado.totalCofins)}</td>
        <td class="valor">R$ ${fmt(resultado.totalCreditos)}</td>
      </tr>
    </tbody>
  </table>

  <!-- SUMMARY TABLE -->
  <h2>Resumo por Conta Contábil — ${resultado.totalContasElegiveis} contas elegíveis</h2>
  <table>
    <thead><tr class="summary-header">
      <th>#</th><th>Código</th><th>Descrição da Conta</th>
      <th>Base Cálculo</th><th>Vlr PIS</th><th>Vlr Cofins</th><th>Total de Créditos</th>
    </tr></thead>
    <tbody>
      ${summaryRows}
      <tr class="total-row">
        <td colspan="3">VALOR TOTAL DOS CRÉDITOS IDENTIFICADOS</td>
        <td class="valor">R$ ${fmt(resultado.totalBaseCalculo)}</td>
        <td class="valor">R$ ${fmt(resultado.totalPis)}</td>
        <td class="valor">R$ ${fmt(resultado.totalCofins)}</td>
        <td class="valor">R$ ${fmt(resultado.totalCreditos)}</td>
      </tr>
    </tbody>
  </table>

  <!-- DETAIL SECTIONS -->
  <h2>Detalhamento por Conta — ano a ano</h2>
  <p style="font-size:10px;color:#555;margin-bottom:12px;">Valores apurados a partir do razão contábil de cada conta de despesa/custo identificada na ECD. Créditos de PIS/COFINS calculados conforme regime não-cumulativo.</p>

  ${accountSections}

  <!-- FOOTER -->
  <div class="footer">
    <p><strong>Metodologia:</strong> Extrato elaborado a partir da ECD (Escrituração Contábil Digital), registros I050 (Plano de Contas), I150 (Abertura do Período) e I155 (Saldos Periódicos). Para cada conta analítica de despesa/custo com natureza elegível, foram aplicadas as alíquotas de PIS (1,65%) e COFINS (7,60%) sobre a base de cálculo (valor debitado no período), conforme regime não-cumulativo das Leis 10.637/02 e 10.833/03.</p>
    <p><strong>Base Legal:</strong> Lei 10.637/02 art. 3° (PIS) | Lei 10.833/03 art. 3° (COFINS) | STJ REsp 1.221.170/PR — Tema 779 (conceito amplo de insumo) | IN RFB 1.911/2019.</p>
    <p>Este extrato contém <strong>valores reais</strong> extraídos da escrituração contábil da empresa. Os créditos são calculados sobre despesas efetivamente registradas no razão contábil.</p>
    <p>Documento gerado pela plataforma TaxCredit Enterprise. <span class="confidencial">Uso confidencial.</span></p>
  </div>
</div>
</body>
</html>`;
}
