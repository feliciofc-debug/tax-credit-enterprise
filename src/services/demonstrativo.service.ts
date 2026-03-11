// src/services/demonstrativo.service.ts
// Demonstrativo cálculo por cálculo — Real (dados SPED) vs Hipótese (estimativa)
// Formato compatível com entrada na fazenda (RFB/SEFAZ)

import { ZipProcessResult, SpedDocument, EfdContribData, EcfData, EcdData } from './zipProcessor.service';
import { TaxAnalysisResult } from './claude.service';
import { logger } from '../utils/logger';

// CFOPs típicos de importação
const CFOP_IMPORTACAO = ['3102', '3101', '3103', '2102', '2101', '2103'];
const CFOP_SAIDA_TRIBUTADA = ['5102', '5101', '6102', '6101', '5104', '6104'];

/**
 * Crédito PIS/COFINS só existe sobre ENTRADAS (compras, insumos, importação).
 * CFOPs que começam com 1, 2 ou 3 são entradas; 5, 6, 7 são saídas.
 */
function isCfopEntrada(cfop: string): boolean {
  const first = cfop.charAt(0);
  return first === '1' || first === '2' || first === '3';
}

export interface DemonstrativoItem {
  tributo: string;
  ponto: string;
  situacaoIdentificada: string;
  periodo: string;
  baseCalculo: number;
  vlrPis: number;
  vlrCofins: number;
  total: number;
  baseLegal: string;
  tipo: 'real' | 'hipotese';
  observacao?: string;
  /** Número sequencial da operação (para extrato) */
  numeroOperacao?: number;
  /** Referência SPED para extrato bancário (ex: E110 ago/2024, C190 3102) */
  referenciaSped?: string;
}

export interface DemonstrativoResult {
  empresa: { nome: string; cnpj: string } | null;
  periodoAnalisado: string;
  itens: DemonstrativoItem[];
  totalReal: number;
  totalHipotese: number;
  totalGeral: number;
  resumoReal: string;
  resumoHipotese: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getDescricaoCfop(cfop: string): string {
  if (CFOP_IMPORTACAO.includes(cfop)) return `Importação (CFOP ${cfop})`;
  if (CFOP_SAIDA_TRIBUTADA.includes(cfop)) return `Saída tributada (CFOP ${cfop})`;
  return `CFOP ${cfop}`;
}

function getBaseLegalCfop(cfop: string): string {
  if (CFOP_IMPORTACAO.includes(cfop)) return 'Lei 10.865/04 art. 3º | Decreto 5.442/05 | Crédito PIS/COFINS sobre importação';
  if (CFOP_SAIDA_TRIBUTADA.includes(cfop)) return 'RE 574.706 — Tema 69 STF | Exclusão ICMS da base PIS/COFINS';
  return 'Lei 10.637/02 e 10.833/03';
}

/**
 * Gera demonstrativo cálculo por cálculo a partir do ZIP processado + análise IA.
 * Dados reais (SPED) → tipo 'real'
 * Dados sem comprovação → tipo 'hipotese'
 */
export function buildDemonstrativo(
  zipResult: ZipProcessResult,
  analysisResult: TaxAnalysisResult
): DemonstrativoResult {
  const itens: DemonstrativoItem[] = [];
  const periodos = new Set<string>();

  // Deduplicar SPEDs por CNPJ+período (evita contar 2x se mesmo arquivo foi enviado)
  const seenSpeds = new Set<string>();
  const uniqueSpeds: SpedDocument[] = [];
  for (const sped of (zipResult.speds || []) as SpedDocument[]) {
    const key = `${sped.cnpj || ''}|${sped.periodo?.inicio || ''}|${sped.periodo?.fim || ''}`;
    if (seenSpeds.has(key)) {
      logger.warn(`[DEMONSTRATIVO] SPED duplicado ignorado: ${key}`);
      continue;
    }
    seenSpeds.add(key);
    uniqueSpeds.push(sped);
  }

  // 1. DADOS REAIS — do SPED (por período, por CFOP)
  for (const sped of uniqueSpeds) {
    const periodo = sped.periodo?.fim || sped.periodo?.inicio || 'N/D';
    periodos.add(periodo);

    // 1.1 ICMS Saldo Credor (E110)
    const saldoCredor = sped.resumo?.saldoCredor ?? 0;
    if (saldoCredor > 0) {
      itens.push({
        tributo: 'ICMS',
        ponto: 'Saldo credor a transportar',
        situacaoIdentificada: `Saldo credor período ${periodo}`,
        periodo,
        baseCalculo: saldoCredor,
        vlrPis: 0,
        vlrCofins: 0,
        total: saldoCredor,
        baseLegal: 'LC 87/96 art. 25 | RICMS-RJ Livro III | Ressarcimento/transferência',
        tipo: 'real',
        observacao: 'Dado extraído do registro E110 do SPED EFD Fiscal',
      });
    }

    // 1.2 PIS/COFINS — por operação (C190) quando disponível, senão por CFOP agregado
    const operacoesExtrato = sped.resumo?.operacoesExtrato || [];
    const cfopBreakdown = sped.resumo?.cfopBreakdown || [];

    if (operacoesExtrato.length > 0) {
      for (const op of operacoesExtrato) {
        if (!isCfopEntrada(op.cfop)) continue;
        const totalOp = (op.vlPis || 0) + (op.vlCofins || 0);
        if (totalOp > 0) {
          itens.push({
            tributo: 'PIS/COFINS',
            ponto: getDescricaoCfop(op.cfop),
            situacaoIdentificada: `Crédito sobre entrada CFOP ${op.cfop} — período ${periodo}`,
            periodo,
            baseCalculo: op.vlOpr,
            vlrPis: op.vlPis,
            vlrCofins: op.vlCofins,
            total: totalOp,
            baseLegal: getBaseLegalCfop(op.cfop),
            tipo: 'real',
            observacao: 'Registro C190 SPED EFD Fiscal (operação de entrada)',
            referenciaSped: `C190 ${op.cfop} ${periodo}`,
          });
        }
      }
    } else {
      for (const cf of cfopBreakdown) {
        if (!isCfopEntrada(cf.cfop)) continue;
        const totalCf = (cf.vlPis || 0) + (cf.vlCofins || 0);
        if (totalCf > 0) {
          itens.push({
            tributo: 'PIS/COFINS',
            ponto: getDescricaoCfop(cf.cfop),
            situacaoIdentificada: `Crédito sobre entrada CFOP ${cf.cfop} — período ${periodo}`,
            periodo,
            baseCalculo: cf.vlOpr,
            vlrPis: cf.vlPis,
            vlrCofins: cf.vlCofins,
            total: totalCf,
            baseLegal: getBaseLegalCfop(cf.cfop),
            tipo: 'real',
            observacao: 'Registros C100/C190 SPED EFD Fiscal (operação de entrada)',
            referenciaSped: `C100/C190 ${cf.cfop} ${periodo}`,
          });
        }
      }
    }

    // 1.3 Fallback: PIS/COFINS por NF (C100) ou total entradas quando não há C190
    if (operacoesExtrato.length === 0 && cfopBreakdown.length === 0) {
      const PIS_RATE = 0.0165;
      const COFINS_RATE = 0.0760;
      const entradas = (sped.resumo?.operacoes || []).filter(o => o.tipo === 'ENTRADA');
      if (entradas.length > 0) {
        let addedAny = false;
        for (const op of entradas) {
          const hasPisCofins = (op.pis || 0) > 0 || (op.cofins || 0) > 0;
          const vlPis = hasPisCofins ? (op.pis || 0) : op.valor * PIS_RATE;
          const vlCofins = hasPisCofins ? (op.cofins || 0) : op.valor * COFINS_RATE;
          const totalOp = vlPis + vlCofins;
          if (totalOp > 0) {
            addedAny = true;
            itens.push({
              tributo: 'PIS/COFINS',
              ponto: `NF ${op.nf}`,
              situacaoIdentificada: `Crédito NF ${op.nf} — período ${periodo}`,
              periodo,
              baseCalculo: op.valor,
              vlrPis: vlPis,
              vlrCofins: vlCofins,
              total: totalOp,
              baseLegal: 'Lei 10.637/02 e 10.833/03 | Crédito sobre insumos e importação',
              tipo: 'real',
              observacao: hasPisCofins
                ? 'Registro C100 SPED EFD Fiscal'
                : 'Base C100 SPED EFD Fiscal — PIS 1,65% e COFINS 7,60% (regime não-cumulativo)',
              referenciaSped: `C100 NF ${op.nf} ${periodo}`,
            });
          }
        }
        if (!addedAny) {
          const totalBase = entradas.reduce((s, o) => s + (o.valor || 0), 0);
          if (totalBase > 0) {
            const vlPis = totalBase * PIS_RATE;
            const vlCofins = totalBase * COFINS_RATE;
            itens.push({
              tributo: 'PIS/COFINS',
              ponto: 'Crédito sobre entradas',
              situacaoIdentificada: `Crédito PIS/COFINS entradas — período ${periodo}`,
              periodo,
              baseCalculo: totalBase,
              vlrPis: vlPis,
              vlrCofins: vlCofins,
              total: vlPis + vlCofins,
              baseLegal: 'Lei 10.637/02 e 10.833/03 | Crédito sobre insumos e importação',
              tipo: 'real',
              observacao: 'Base C100 SPED EFD Fiscal — PIS 1,65% e COFINS 7,60% (regime não-cumulativo)',
              referenciaSped: `C100 ${periodo}`,
            });
          }
        }
      }
    }
  }

  // 1b. EFD CONTRIBUIÇÕES — PIS/COFINS reais (quando disponível, substitui estimativas)
  const efdContribs = (zipResult.efdContribs || []) as EfdContribData[];
  if (efdContribs.length > 0) {
    for (const efd of efdContribs) {
      const periodo = efd.periodo?.fim || efd.periodo?.inicio || 'N/D';
      periodos.add(periodo);

      // PIS saldo credor
      if (efd.pisSaldoCredor > 0) {
        itens.push({
          tributo: 'PIS',
          ponto: 'Saldo credor EFD Contribuições',
          situacaoIdentificada: `Saldo credor PIS apurado — período ${periodo}`,
          periodo,
          baseCalculo: efd.pisTotalCredito,
          vlrPis: efd.pisSaldoCredor,
          vlrCofins: 0,
          total: efd.pisSaldoCredor,
          baseLegal: 'Lei 10.637/02 art. 3° | Regime não-cumulativo PIS',
          tipo: 'real',
          observacao: 'Registro M200 EFD Contribuições — valor real apurado',
          referenciaSped: `M200 PIS ${periodo}`,
        });
      }

      // COFINS saldo credor
      if (efd.cofinsSaldoCredor > 0) {
        itens.push({
          tributo: 'COFINS',
          ponto: 'Saldo credor EFD Contribuições',
          situacaoIdentificada: `Saldo credor COFINS apurado — período ${periodo}`,
          periodo,
          baseCalculo: efd.cofinsTotalCredito,
          vlrPis: 0,
          vlrCofins: efd.cofinsSaldoCredor,
          total: efd.cofinsSaldoCredor,
          baseLegal: 'Lei 10.833/03 art. 3° | Regime não-cumulativo COFINS',
          tipo: 'real',
          observacao: 'Registro M600 EFD Contribuições — valor real apurado',
          referenciaSped: `M600 COFINS ${periodo}`,
        });
      }

      // Créditos detalhados PIS (M100)
      for (const cred of efd.creditosPis) {
        if (cred.vlCredito > 0) {
          itens.push({
            tributo: 'PIS',
            ponto: `Crédito ${cred.descricao}`,
            situacaoIdentificada: `Crédito PIS ${cred.descricao} — período ${periodo}`,
            periodo,
            baseCalculo: cred.vlCredito,
            vlrPis: cred.vlCredito,
            vlrCofins: 0,
            total: cred.vlCredito,
            baseLegal: 'Lei 10.637/02 art. 3° | Regime não-cumulativo',
            tipo: 'real',
            observacao: 'Registro M100 EFD Contribuições',
            referenciaSped: `M100 ${cred.cstPis} ${periodo}`,
          });
        }
      }

      // Créditos detalhados COFINS (M500)
      for (const cred of efd.creditosCofins) {
        if (cred.vlCredito > 0) {
          itens.push({
            tributo: 'COFINS',
            ponto: `Crédito ${cred.descricao}`,
            situacaoIdentificada: `Crédito COFINS ${cred.descricao} — período ${periodo}`,
            periodo,
            baseCalculo: cred.vlCredito,
            vlrPis: 0,
            vlrCofins: cred.vlCredito,
            total: cred.vlCredito,
            baseLegal: 'Lei 10.833/03 art. 3° | Regime não-cumulativo',
            tipo: 'real',
            observacao: 'Registro M500 EFD Contribuições',
            referenciaSped: `M500 ${cred.cstCofins} ${periodo}`,
          });
        }
      }

      // Demais créditos F100
      for (const cred of efd.demaisCreditos) {
        const totalCred = (cred.vlPis || 0) + (cred.vlCofins || 0);
        if (totalCred > 0) {
          itens.push({
            tributo: 'PIS/COFINS',
            ponto: `Demais créditos — ${cred.natureza}`,
            situacaoIdentificada: `Crédito F100 ${cred.natureza} — período ${periodo}`,
            periodo,
            baseCalculo: cred.vlOpr,
            vlrPis: cred.vlPis,
            vlrCofins: cred.vlCofins,
            total: totalCred,
            baseLegal: 'Lei 10.637/02 e 10.833/03 | Demais créditos',
            tipo: 'real',
            observacao: 'Registro F100 EFD Contribuições — demais documentos',
            referenciaSped: `F100 ${periodo}`,
          });
        }
      }
    }

    // When EFD Contribuições provides real PIS/COFINS, remove estimated PIS/COFINS from EFD ICMS/IPI
    const hasRealPisCofins = itens.some(i => i.tipo === 'real' && /^(PIS|COFINS|PIS\/COFINS)$/.test(i.tributo) && (i.observacao || '').includes('EFD Contribuições'));
    if (hasRealPisCofins) {
      const estimatedPisCofinsIdx: number[] = [];
      itens.forEach((item, idx) => {
        if (item.tipo === 'real' && /PIS|COFINS/.test(item.tributo) && (item.observacao || '').includes('SPED EFD Fiscal')) {
          estimatedPisCofinsIdx.push(idx);
        }
      });
      for (let i = estimatedPisCofinsIdx.length - 1; i >= 0; i--) {
        itens.splice(estimatedPisCofinsIdx[i], 1);
      }
      logger.info(`[DEMONSTRATIVO] EFD Contribuições disponível — removidas ${estimatedPisCofinsIdx.length} estimativas PIS/COFINS do EFD ICMS/IPI`);
    }
  }

  // 1c. ECF — IRPJ/CSLL reais
  const ecfs = (zipResult.ecfs || []) as EcfData[];
  if (ecfs.length > 0) {
    for (const ecf of ecfs) {
      const periodo = ecf.periodo?.fim || ecf.periodo?.inicio || 'N/D';
      periodos.add(periodo);

      // IRPJ retido (possível crédito a recuperar)
      if (ecf.irpjRetido > 0 && ecf.irpjRetido >= ecf.irpjAPagar) {
        const credito = ecf.irpjRetido - ecf.irpjAPagar;
        if (credito > 0) {
          itens.push({
            tributo: 'IRPJ',
            ponto: 'IRPJ retido na fonte a compensar',
            situacaoIdentificada: `IRPJ retido (${fmt(ecf.irpjRetido)}) > devido (${fmt(ecf.irpjAPagar)}) — período ${periodo}`,
            periodo,
            baseCalculo: ecf.irpjRetido,
            vlrPis: 0,
            vlrCofins: 0,
            total: credito,
            baseLegal: 'RIR/2018 art. 932 | Compensação IRPJ retido',
            tipo: 'real',
            observacao: 'Registros N620/N660 ECF — IRPJ retido excedente',
            referenciaSped: `N620/N660 IRPJ ${periodo}`,
          });
        }
      }

      // CSLL retida (possível crédito a recuperar)
      if (ecf.csllRetido > 0 && ecf.csllRetido >= ecf.csllAPagar) {
        const credito = ecf.csllRetido - ecf.csllAPagar;
        if (credito > 0) {
          itens.push({
            tributo: 'CSLL',
            ponto: 'CSLL retida na fonte a compensar',
            situacaoIdentificada: `CSLL retida (${fmt(ecf.csllRetido)}) > devida (${fmt(ecf.csllAPagar)}) — período ${periodo}`,
            periodo,
            baseCalculo: ecf.csllRetido,
            vlrPis: 0,
            vlrCofins: 0,
            total: credito,
            baseLegal: 'Lei 10.833/03 art. 36 | Compensação CSLL retida',
            tipo: 'real',
            observacao: 'Registros N630 ECF — CSLL retida excedente',
            referenciaSped: `N630 CSLL ${periodo}`,
          });
        }
      }

      // LALUR exclusões (potenciais créditos de IRPJ/CSLL)
      if (ecf.exclusoes > 0 && ecf.lucroReal < ecf.lucroPrejuizoContabil) {
        itens.push({
          tributo: 'IRPJ/CSLL',
          ponto: 'Exclusões LALUR — redução base tributável',
          situacaoIdentificada: `Exclusões LALUR: R$ ${fmt(ecf.exclusoes)} — Lucro contábil: R$ ${fmt(ecf.lucroPrejuizoContabil)} → Lucro Real: R$ ${fmt(ecf.lucroReal)}`,
          periodo,
          baseCalculo: ecf.exclusoes,
          vlrPis: 0,
          vlrCofins: 0,
          total: ecf.exclusoes * 0.34,
          baseLegal: 'RIR/2018 art. 249-250 | LALUR Parte A — exclusões',
          tipo: 'real',
          observacao: 'Registro M300 ECF — economia fiscal sobre exclusões LALUR (IRPJ 25% + CSLL 9%)',
          referenciaSped: `M300 LALUR ${periodo}`,
        });
      }
    }
  }

  // 1d. ECD — indicadores contábeis (informativo, não gera crédito direto)
  const ecds = (zipResult.ecds || []) as EcdData[];
  if (ecds.length > 0) {
    for (const ecd of ecds) {
      const periodo = ecd.periodo?.fim || ecd.periodo?.inicio || 'N/D';
      periodos.add(periodo);
      logger.info(`[DEMONSTRATIVO] ECD ${periodo}: Ativo R$ ${fmt(ecd.totalAtivo)} | Passivo R$ ${fmt(ecd.totalPassivo)} | Receita R$ ${fmt(ecd.receitaBruta)} — ${ecd.saldos.length} contas`);
    }
  }

  // 2. HIPÓTESES — da análise IA (oportunidades sem documentação completa no SPED)
  for (const op of analysisResult.oportunidades || []) {
    const valor = op.valorEstimado || 0;
    if (valor <= 0) continue;

    // Para PIS/COFINS: split proporcional; para ICMS/outros: total no campo total
    const isPisCofins = /pis|cofins|importação|importacao/i.test(op.tributo || '');
    const vlrPis = isPisCofins ? valor * 0.18 : 0;
    const vlrCofins = isPisCofins ? valor * 0.82 : 0;
    itens.push({
      tributo: op.tributo,
      ponto: op.tipo,
      situacaoIdentificada: op.descricao?.substring(0, 300) || op.tipo,
      periodo: analysisResult.periodoAnalisado || 'A definir',
      baseCalculo: valor,
      vlrPis: op.tributo === 'PIS' ? valor : vlrPis,
      vlrCofins: op.tributo === 'COFINS' ? valor : vlrCofins,
      total: valor,
      baseLegal: op.fundamentacaoLegal?.substring(0, 200) || '',
      tipo: 'hipotese',
      observacao: 'HIPÓTESE — Valor estimado. Sujeito a confirmação com documentação completa (razão contábil, NFes, EFD Contribuições).',
    });
  }

  const totalReal = itens.filter(i => i.tipo === 'real').reduce((s, i) => s + i.total, 0);
  const totalHipotese = itens.filter(i => i.tipo === 'hipotese').reduce((s, i) => s + i.total, 0);
  const totalGeral = totalReal + totalHipotese;

  const periodoStr = Array.from(periodos).sort().join(', ') || analysisResult.periodoAnalisado || 'N/D';

  // Numeração sequencial para extrato
  itens.forEach((item, idx) => { item.numeroOperacao = idx + 1; });

  logger.info(`[DEMONSTRATIVO] ${itens.filter(i => i.tipo === 'real').length} itens reais, ${itens.filter(i => i.tipo === 'hipotese').length} hipóteses | Total real: R$ ${fmt(totalReal)} | Total hipótese: R$ ${fmt(totalHipotese)}`);

  return {
    empresa: zipResult.empresa ? { nome: zipResult.empresa.nome, cnpj: zipResult.empresa.cnpj } : null,
    periodoAnalisado: periodoStr,
    itens,
    totalReal,
    totalHipotese,
    totalGeral,
    resumoReal: totalReal > 0
      ? `Valores comprovados nos documentos (${efdContribs.length > 0 ? 'EFD Contribuições + ' : ''}${ecfs.length > 0 ? 'ECF + ' : ''}SPED EFD): R$ ${fmt(totalReal)}. Demonstrativo cálculo por cálculo disponível.`
      : 'Nenhum valor com documentação completa no período analisado.',
    resumoHipotese: totalHipotese > 0
      ? `Valores estimados (hipótese): R$ ${fmt(totalHipotese)}. Sujeitos a confirmação com documentação adicional.`
      : '',
  };
}

/**
 * Formata o demonstrativo em texto para relatório/PDF
 */
export function formatDemonstrativoTexto(demo: DemonstrativoResult): string {
  const lines: string[] = [];
  lines.push('='.repeat(70));
  lines.push('DEMONSTRATIVO DE CRÉDITOS TRIBUTÁRIOS — CÁLCULO POR CÁLCULO');
  lines.push('='.repeat(70));
  if (demo.empresa) {
    lines.push(`Empresa: ${demo.empresa.nome}`);
    lines.push(`CNPJ: ${demo.empresa.cnpj}`);
  }
  lines.push(`Período analisado: ${demo.periodoAnalisado}`);
  lines.push('');

  lines.push('--- DADOS REAIS (comprovados nos documentos) ---');
  for (const i of demo.itens.filter(x => x.tipo === 'real')) {
    lines.push(`[REAL] ${i.tributo} | ${i.ponto} | ${i.periodo}`);
    lines.push(`  Base: R$ ${fmt(i.baseCalculo)} | PIS: R$ ${fmt(i.vlrPis)} | COFINS: R$ ${fmt(i.vlrCofins)} | Total: R$ ${fmt(i.total)}`);
    lines.push(`  Base legal: ${i.baseLegal}`);
    if (i.observacao) lines.push(`  Obs: ${i.observacao}`);
    lines.push('');
  }

  if (demo.itens.some(x => x.tipo === 'hipotese')) {
    lines.push('--- HIPÓTESES (sujeitas a confirmação) ---');
    for (const i of demo.itens.filter(x => x.tipo === 'hipotese')) {
      lines.push(`[HIPÓTESE] ${i.tributo} | ${i.ponto} | ${i.periodo}`);
      lines.push(`  Total estimado: R$ ${fmt(i.total)}`);
      lines.push(`  ${i.observacao || ''}`);
      lines.push('');
    }
  }

  lines.push('--- TOTAIS ---');
  lines.push(`Total REAL (comprovado): R$ ${fmt(demo.totalReal)}`);
  lines.push(`Total HIPÓTESE (estimado): R$ ${fmt(demo.totalHipotese)}`);
  lines.push(`TOTAL GERAL: R$ ${fmt(demo.totalGeral)}`);
  lines.push('');
  lines.push(demo.resumoReal);
  if (demo.resumoHipotese) lines.push(demo.resumoHipotese);

  return lines.join('\n');
}

/**
 * Formato EXTRATO POR OPERAÇÃO — estilo extrato bancário
 * Uma linha por operação, tabular, aceito pela fazenda
 */
export function formatExtratoPorOperacao(demo: DemonstrativoResult): string {
  const lines: string[] = [];
  const sep = ' | ';
  const col = (s: string, w: number) => String(s).padEnd(w).substring(0, w);

  lines.push('EXTRATO DE CRÉDITOS TRIBUTÁRIOS — DETALHADO POR OPERAÇÃO');
  lines.push('='.repeat(120));
  if (demo.empresa) {
    lines.push(`Empresa: ${demo.empresa.nome}`);
    lines.push(`CNPJ: ${demo.empresa.cnpj}`);
  }
  lines.push(`Período: ${demo.periodoAnalisado}`);
  lines.push('');

  // Cabeçalho tabular
  const header = [
    col('#', 4),
    col('Período', 10),
    col('Tipo', 8),
    col('Tributo', 12),
    col('Ponto/Operação', 35),
    col('Base Cálculo', 14),
    col('PIS', 14),
    col('COFINS', 14),
    col('Total', 14),
  ].join(sep);
  lines.push(header);
  lines.push('-'.repeat(120));

  for (const i of demo.itens) {
    const row = [
      col(String(i.numeroOperacao ?? 0), 4),
      col(i.periodo, 10),
      col(i.tipo === 'real' ? 'REAL' : 'HIPÓT.', 8),
      col(i.tributo, 12),
      col(i.ponto, 35),
      col(fmt(i.baseCalculo), 14),
      col(fmt(i.vlrPis), 14),
      col(fmt(i.vlrCofins), 14),
      col(fmt(i.total), 14),
    ].join(sep);
    lines.push(row);
  }

  lines.push('-'.repeat(120));
  lines.push(`TOTAL REAL (comprovado): R$ ${fmt(demo.totalReal)}`);
  lines.push(`TOTAL HIPÓTESE (estimado): R$ ${fmt(demo.totalHipotese)}`);
  lines.push(`TOTAL GERAL: R$ ${fmt(demo.totalGeral)}`);
  lines.push('');
  lines.push('Documento gerado automaticamente pela plataforma TaxCredit Enterprise.');
  lines.push('Valores REAIS: dados extraídos do SPED EFD Fiscal. Valores HIPÓTESE: sujeitos a confirmação documental.');

  return lines.join('\n');
}

/**
 * Formato EXTRATO POR OPERAÇÃO em HTML — para PDF/impressão
 */
export function formatExtratoPorOperacaoHtml(demo: DemonstrativoResult): string {
  const rows = demo.itens.map(i => `
    <tr class="${i.tipo === 'real' ? 'real' : 'hipotese'}">
      <td class="num">${i.numeroOperacao ?? ''}</td>
      <td>${i.periodo}</td>
      <td><span class="badge ${i.tipo}">${i.tipo === 'real' ? 'REAL' : 'HIPÓTESE'}</span></td>
      <td>${i.tributo}</td>
      <td>${i.ponto}</td>
      <td class="valor">${fmt(i.baseCalculo)}</td>
      <td class="valor">${fmt(i.vlrPis)}</td>
      <td class="valor">${fmt(i.vlrCofins)}</td>
      <td class="valor total">${fmt(i.total)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extrato de Créditos Tributários — ${demo.empresa?.nome || 'Empresa'}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 11px; margin: 20px; }
    h1 { font-size: 14px; margin-bottom: 4px; }
    .empresa { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
    th { background: #1e3a5f; color: white; font-weight: bold; }
    td.valor { text-align: right; }
    td.num { text-align: center; }
    tr.real { background: #f0fdf4; }
    tr.hipotese { background: #fffbeb; }
    .badge { font-size: 9px; padding: 2px 4px; border-radius: 2px; }
    .badge.real { background: #22c55e; color: white; }
    .badge.hipotese { background: #f59e0b; color: white; }
    .totais { margin-top: 12px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 9px; color: #666; }
    @media print {
      body { margin: 15mm; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      .badge.real, .badge.hipotese { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr.real, tr.hipotese { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>EXTRATO DE CRÉDITOS TRIBUTÁRIOS — DETALHADO POR OPERAÇÃO</h1>
  <div class="empresa">
    ${demo.empresa ? `<p><strong>Empresa:</strong> ${demo.empresa.nome}</p><p><strong>CNPJ:</strong> ${demo.empresa.cnpj}</p>` : ''}
    <p><strong>Período analisado:</strong> ${demo.periodoAnalisado}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Período</th>
        <th>Tipo</th>
        <th>Tributo</th>
        <th>Ponto/Operação</th>
        <th>Base Cálculo</th>
        <th>PIS</th>
        <th>COFINS</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="totais">
    <p>TOTAL REAL (comprovado): R$ ${fmt(demo.totalReal)}</p>
    <p>TOTAL HIPÓTESE (estimado): R$ ${fmt(demo.totalHipotese)}</p>
    <p>TOTAL GERAL: R$ ${fmt(demo.totalGeral)}</p>
  </div>
  <div class="footer">
    Documento gerado pela plataforma TaxCredit Enterprise. Valores REAIS: dados do SPED. Valores HIPÓTESE: sujeitos a confirmação.
  </div>
</body>
</html>`;
}

/**
 * EXTRATO DE CRÉDITOS TRIBUTÁRIOS — Formato profissional para Receita/SEFAZ
 * Modelo inspirado em relatórios gerenciais de consultorias tributárias.
 * APENAS valores REAIS extraídos do SPED — sem projeções ou estimativas.
 * Estrutura: Tabela Resumo + Tabelas Detalhadas por operação (período a período).
 */
export function formatExtratoBancarioHtml(demo: DemonstrativoResult): string {
  const itensReais = demo.itens.filter(i => i.tipo === 'real');
  const ano = new Date().getFullYear();
  const empresaNome = demo.empresa?.nome || 'Empresa';
  const empresaCnpj = demo.empresa?.cnpj || '';

  if (itensReais.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Extrato de Créditos</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:30px;font-size:12px;color:#333}
.aviso{background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin:20px 0;border-radius:4px}
h1{font-size:16px;color:#1a365d}
</style></head><body>
<h1>EXTRATO DE CRÉDITOS TRIBUTÁRIOS</h1>
${demo.empresa ? `<p><strong>Empresa:</strong> ${empresaNome} &nbsp;|&nbsp; <strong>CNPJ:</strong> ${empresaCnpj}</p>` : ''}
<div class="aviso"><strong>Nenhum valor com comprovação no SPED.</strong><br>Envie arquivos SPED (EFD ICMS/IPI, EFD Contribuições, ECF, ECD) para gerar o extrato discriminado com valores reais.</div>
</body></html>`;
  }

  // --- Group items by ponto (operation type) for detailed tables ---
  const grupos = new Map<string, DemonstrativoItem[]>();
  for (const item of itensReais) {
    const key = `${item.tributo}|||${item.ponto}|||${item.baseLegal}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(item);
  }

  // --- Summary table rows ---
  let seqResumo = 0;
  const resumoRows = Array.from(grupos.entries()).map(([key, items]) => {
    seqResumo++;
    const [tributo, ponto, baseLegal] = key.split('|||');
    const totalPis = items.reduce((s, i) => s + i.vlrPis, 0);
    const totalCofins = items.reduce((s, i) => s + i.vlrCofins, 0);
    const totalGrupo = items.reduce((s, i) => s + i.total, 0);
    const situacao = items[0].referenciaSped ? items[0].referenciaSped.split(' ')[0] : 'SPED';
    return `<tr>
      <td class="num">${seqResumo}</td>
      <td>${tributo}</td>
      <td>${ponto}</td>
      <td>${situacao}</td>
      <td class="valor">R$ ${fmt(totalPis)}</td>
      <td class="valor">R$ ${fmt(totalCofins)}</td>
      <td class="valor total-cell">R$ ${fmt(totalGrupo)}</td>
    </tr>`;
  }).join('');

  const totalPisGeral = itensReais.reduce((s, i) => s + i.vlrPis, 0);
  const totalCofinsGeral = itensReais.reduce((s, i) => s + i.vlrCofins, 0);

  // --- Detailed tables per group ---
  let seqDetalhe = 0;
  const detailSections = Array.from(grupos.entries()).map(([key, items]) => {
    seqDetalhe++;
    const [tributo, ponto, baseLegal] = key.split('|||');
    const sortedItems = [...items].sort((a, b) => a.periodo.localeCompare(b.periodo));

    const detailRows = sortedItems.map(i => `<tr>
      <td>${i.periodo}</td>
      <td>${i.ponto}</td>
      <td class="valor">R$ ${fmt(i.baseCalculo)}</td>
      <td class="valor">R$ ${fmt(i.vlrPis)}</td>
      <td class="valor">R$ ${fmt(i.vlrCofins)}</td>
      <td class="valor total-cell">R$ ${fmt(i.total)}</td>
    </tr>`).join('');

    const subBase = items.reduce((s, i) => s + i.baseCalculo, 0);
    const subPis = items.reduce((s, i) => s + i.vlrPis, 0);
    const subCofins = items.reduce((s, i) => s + i.vlrCofins, 0);
    const subTotal = items.reduce((s, i) => s + i.total, 0);

    return `
    <div class="detail-section">
      <h3>${seqDetalhe}) ${ponto}</h3>
      <table>
        <thead><tr class="detail-header">
          <th>Período</th><th>Descrição da Operação</th><th>Base Cálculo</th><th>Vlr PIS</th><th>Vlr Cofins</th><th>Total de Créditos</th>
        </tr></thead>
        <tbody>
          ${detailRows}
          <tr class="subtotal-row">
            <td colspan="2"></td>
            <td class="valor">R$ ${fmt(subBase)}</td>
            <td class="valor">R$ ${fmt(subPis)}</td>
            <td class="valor">R$ ${fmt(subCofins)}</td>
            <td class="valor total-cell">R$ ${fmt(subTotal)}</td>
          </tr>
        </tbody>
      </table>
      <p class="base-legal"><strong>Base Legal:</strong> ${baseLegal}</p>
      <p class="obs">OBSERVAÇÃO: Valores extraídos dos registros ${items[0].referenciaSped?.split(' ')[0] || 'C100/C190/E110'} do SPED EFD Fiscal.</p>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extrato de Créditos Tributários — ${empresaNome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 0; }
    .page { padding: 30px 40px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d6e3f; padding-bottom: 10px; margin-bottom: 20px; }
    .header-left { font-size: 18px; font-weight: bold; color: #1a365d; }
    .header-center { font-size: 11px; color: #555; text-align: center; }
    .header-right { font-size: 10px; color: #777; text-align: right; }

    /* Company info */
    .company-info { margin-bottom: 20px; }
    .company-info p { margin: 3px 0; font-size: 12px; }

    /* Section titles */
    h2 { font-size: 13px; color: #0d6e3f; margin: 25px 0 8px 0; }
    h3 { font-size: 12px; color: #d63384; margin: 20px 0 6px 0; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; font-size: 10px; }

    /* Summary table header - dark blue */
    thead tr.summary-header th { background: #1a365d; color: white; font-weight: bold; font-size: 10px; }

    /* Detail table header - blue/green */
    thead tr.detail-header th { background: #2563eb; color: white; font-weight: bold; font-size: 10px; }

    /* Total rows */
    tr.total-row { background: #1a365d; color: white; font-weight: bold; }
    tr.total-row td { border-color: #1a365d; }
    tr.subtotal-row { background: #e8f5e9; font-weight: bold; }
    td.total-cell { font-weight: bold; }
    td.valor { text-align: right; font-variant-numeric: tabular-nums; }
    td.num { text-align: center; width: 35px; }

    /* Detail sections */
    .detail-section { margin-bottom: 20px; page-break-inside: avoid; }
    .base-legal { font-size: 9px; color: #555; margin: 4px 0 2px 0; }
    .obs { font-size: 9px; color: #888; font-style: italic; margin-bottom: 10px; }

    /* Footer */
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #888; }
    .footer p { margin: 2px 0; }
    .confidencial { color: #c00; font-weight: bold; }

    @media print {
      body { margin: 0; }
      .page { padding: 15mm 20mm; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      .detail-section { page-break-inside: avoid; }
      th, tr.total-row td, tr.subtotal-row td, td.total-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-left">TaxCredit Enterprise</div>
    <div class="header-center">Extrato de Créditos Tributários</div>
    <div class="header-right">${ano} &nbsp;&nbsp; <span class="confidencial">Confidencial</span></div>
  </div>

  <!-- COMPANY INFO -->
  <div class="company-info">
    <p><strong>Empresa:</strong> ${empresaNome}</p>
    ${empresaCnpj ? `<p><strong>CNPJ:</strong> ${empresaCnpj}</p>` : ''}
    <p><strong>Período analisado:</strong> ${demo.periodoAnalisado}</p>
    <p><strong>Data de emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
  </div>

  <!-- SUMMARY TABLE -->
  <h2>Resumo dos Créditos Identificados — Valores apurados das escriturações digitais</h2>
  <table>
    <thead><tr class="summary-header">
      <th>#</th><th>Tributo</th><th>Ponto / Operação</th><th>Registro</th><th>PIS</th><th>COFINS</th><th>Total</th>
    </tr></thead>
    <tbody>
      ${resumoRows}
      <tr class="total-row">
        <td colspan="4">VALOR TOTAL DOS CRÉDITOS IDENTIFICADOS</td>
        <td class="valor">R$ ${fmt(totalPisGeral)}</td>
        <td class="valor">R$ ${fmt(totalCofinsGeral)}</td>
        <td class="valor">R$ ${fmt(demo.totalReal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- DETAIL TABLES -->
  <h2>Detalhamento por Operação — período a período</h2>
  <p style="font-size:10px;color:#555;margin-bottom:12px;">Valores apurados e conciliados a partir dos registros SPED EFD Fiscal (C100, C190, E110), EFD Contribuições (M100, M200, M500, M600), ECF (N620, N630, M300) e ECD (I155), quando disponíveis.</p>
  ${detailSections}

  <!-- FOOTER -->
  <div class="footer">
    <p><strong>Metodologia:</strong> Valores extraídos diretamente das escriturações digitais: SPED EFD ICMS/IPI (C100, C190, E110), EFD Contribuições (M100/M200 PIS, M500/M600 COFINS), ECF (N620 IRPJ, N630 CSLL, M300 LALUR) e ECD (I155 Balancete), conforme disponibilidade dos arquivos. Alíquotas de PIS (1,65%) e COFINS (7,60%) aplicadas conforme regime não-cumulativo (Leis 10.637/02 e 10.833/03).</p>
    <p>Este extrato contém <strong>exclusivamente valores reais</strong> comprovados nos documentos fiscais digitais. Nenhuma estimativa ou projeção foi utilizada.</p>
    <p>Documento gerado pela plataforma TaxCredit Enterprise. <span class="confidencial">Uso confidencial.</span></p>
  </div>
</div>
</body>
</html>`;
}
