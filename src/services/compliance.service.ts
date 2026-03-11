// src/services/compliance.service.ts
// Compliance em Tempo Real — Análise de SPED com geração de alertas
// Módulo isolado: não altera nenhum fluxo existente (HPC, Viabilidade, Extratos)

import { SpedDocument, EfdContribData, EcfData, EcdData } from './zipProcessor.service';
import { executarCruzamento } from './cruzamentoContabil.service';
import { logger } from '../utils/logger';

const PIS_RATE = 0.0165;
const COFINS_RATE = 0.0760;

export interface ComplianceAlertData {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  tributo: string;
  title: string;
  description: string;
  valorEnvolvido: number;
  economiaEstimada: number;
  baseLegal: string;
  registroSped: string;
  parecer: string;
  periodo: string;
}

export interface ComplianceAnalysisResult {
  spedType: string;
  periodoInicio: string;
  periodoFim: string;
  ano: number;
  mes: number;
  totalCreditos: number;
  totalDebitos: number;
  alerts: ComplianceAlertData[];
  resumo: {
    empresa: string;
    cnpj: string;
    totalAlertasCriticos: number;
    totalAlertasWarning: number;
    totalAlertasInfo: number;
    economiaTotal: number;
  };
}

export class ComplianceAnalyzer {
  /**
   * Analisa um SPED e gera alertas de compliance
   */
  static analyze(
    sped: SpedDocument,
    efdContrib?: EfdContribData,
    ecf?: EcfData,
    ecd?: EcdData,
  ): ComplianceAnalysisResult {
    const alerts: ComplianceAlertData[] = [];
    const tipo = sped.tipoSped || 'efd-icms';
    const periodo = sped.periodo?.fim || sped.periodo?.inicio || '';
    const ano = periodo.length >= 8 ? parseInt(periodo.substring(4, 8), 10) : new Date().getFullYear();
    const mes = periodo.length >= 8 ? parseInt(periodo.substring(2, 4), 10) : 0;

    // 1. ICMS — Saldo credor não aproveitado
    if (sped.resumo?.saldoCredor > 0) {
      alerts.push({
        severity: 'warning',
        category: 'missing_credit',
        tributo: 'ICMS',
        title: `Saldo credor ICMS de R$ ${fmt(sped.resumo.saldoCredor)} acumulado`,
        description: `A empresa possui R$ ${fmt(sped.resumo.saldoCredor)} em créditos de ICMS acumulados no período ${formatPeriod(periodo)}. Este saldo pode ser objeto de transferência a terceiros, ressarcimento ou compensação conforme a legislação estadual.`,
        valorEnvolvido: sped.resumo.saldoCredor,
        economiaEstimada: sped.resumo.saldoCredor,
        baseLegal: 'LC 87/96 art. 25 | RICMS estadual — transferência/ressarcimento de créditos acumulados',
        registroSped: 'E110 — Apuração do ICMS',
        parecer: `Recomenda-se análise da viabilidade de transferência de créditos acumulados (art. 25, LC 87/96) ou pedido de ressarcimento junto à SEFAZ-${sped.uf || 'UF'}. O saldo credor de R$ ${fmt(sped.resumo.saldoCredor)} é um ativo tributário não utilizado.`,
        periodo: formatPeriod(periodo),
      });
    }

    // 2. PIS/COFINS — Créditos sobre entradas não aproveitados
    const operacoes = sped.resumo?.operacoesExtrato || [];
    const cfops = sped.resumo?.cfopBreakdown || [];
    let pisCreditoNaoAproveitado = 0;
    let cofinsCreditoNaoAproveitado = 0;

    for (const op of operacoes) {
      const cfopStr = String(op.cfop || '');
      if (!cfopStr.startsWith('1') && !cfopStr.startsWith('2') && !cfopStr.startsWith('3')) continue;
      if (op.vlOpr > 0 && (op.vlPis === 0 || op.vlCofins === 0)) {
        pisCreditoNaoAproveitado += op.vlOpr * PIS_RATE;
        cofinsCreditoNaoAproveitado += op.vlOpr * COFINS_RATE;
      }
    }

    if (pisCreditoNaoAproveitado + cofinsCreditoNaoAproveitado > 100) {
      const totalNaoAprov = pisCreditoNaoAproveitado + cofinsCreditoNaoAproveitado;
      alerts.push({
        severity: 'critical',
        category: 'missing_credit',
        tributo: 'PIS/COFINS',
        title: `R$ ${fmt(totalNaoAprov)} em créditos PIS/COFINS não aproveitados`,
        description: `Identificadas entradas com valor operacional mas sem crédito de PIS/COFINS registrado. Base de cálculo: R$ ${fmt(pisCreditoNaoAproveitado / PIS_RATE)}. PIS estimado: R$ ${fmt(pisCreditoNaoAproveitado)}. COFINS estimado: R$ ${fmt(cofinsCreditoNaoAproveitado)}.`,
        valorEnvolvido: pisCreditoNaoAproveitado / PIS_RATE,
        economiaEstimada: totalNaoAprov,
        baseLegal: 'Lei 10.637/02 art. 3° (PIS) | Lei 10.833/03 art. 3° (COFINS) | STJ Tema 779',
        registroSped: 'C190 — Consolidação por CFOP',
        parecer: `As operações de entrada totalizam R$ ${fmt(pisCreditoNaoAproveitado / PIS_RATE)} sem créditos de PIS/COFINS. No regime não-cumulativo, estas aquisições geram direito a crédito. Recomenda-se retificação da EFD Contribuições para aproveitamento dos créditos.`,
        periodo: formatPeriod(periodo),
      });
    }

    // 3. ICMS ST — Possível pagamento a maior na substituição tributária
    const cfopsST = cfops.filter(c => ['1403', '2403', '1603', '2603'].includes(String(c.cfop)));
    if (cfopsST.length > 0) {
      const totalST = cfopsST.reduce((s, c) => s + ((c as any).vlIcms || 0), 0);
      if (totalST > 0) {
        alerts.push({
          severity: 'info',
          category: 'retention_excess',
          tributo: 'ICMS-ST',
          title: `ICMS-ST de R$ ${fmt(totalST)} — verificar ressarcimento`,
          description: `Operações com ICMS-ST (CFOPs 1403/2403) totalizando R$ ${fmt(totalST)}. Se a base de cálculo presumida for superior à efetiva, há direito ao ressarcimento da diferença.`,
          valorEnvolvido: totalST,
          economiaEstimada: totalST * 0.1,
          baseLegal: 'LC 87/96 art. 10 | ADI 2.777 STF | Portaria CAT (SP)',
          registroSped: 'C190 — CFOP 1403/2403',
          parecer: `Recomenda-se verificação da base de cálculo presumida vs. efetiva nas operações sujeitas a ICMS-ST. A diferença a maior pode ser objeto de pedido de ressarcimento junto à SEFAZ.`,
          periodo: formatPeriod(periodo),
        });
      }
    }

    // 4. Tema 69 STF — Exclusão do ICMS da base de PIS/COFINS
    const totalSaidas = sped.resumo?.totalSaidas || 0;
    const icmsDebitos = sped.resumo?.icmsDebitos || 0;
    if (totalSaidas > 0 && icmsDebitos > 0) {
      const icmsNaBase = totalSaidas * 0.0925;
      const economiaTema69 = icmsNaBase * (PIS_RATE + COFINS_RATE);
      if (economiaTema69 > 50) {
        alerts.push({
          severity: 'warning',
          category: 'base_error',
          tributo: 'PIS/COFINS',
          title: `Tema 69 STF — Possível economia de R$ ${fmt(economiaTema69)}/mês`,
          description: `O ICMS destacado nas saídas (R$ ${fmt(icmsDebitos)}) deve ser excluído da base de cálculo de PIS e COFINS conforme RE 574.706 (Tema 69 STF). Economia estimada: R$ ${fmt(economiaTema69)} neste período.`,
          valorEnvolvido: icmsDebitos,
          economiaEstimada: economiaTema69,
          baseLegal: 'RE 574.706 — Tema 69 STF | Exclusão do ICMS da base de PIS/COFINS',
          registroSped: 'E110 — ICMS débitos sobre saídas',
          parecer: `Conforme decidido pelo STF no RE 574.706 (Tema 69), com repercussão geral, o ICMS não compõe a base de cálculo do PIS e da COFINS. A empresa deve verificar se já aplica esta exclusão. Caso contrário, há oportunidade de recuperação dos últimos 5 anos.`,
          periodo: formatPeriod(periodo),
        });
      }
    }

    // 5. EFD Contribuições — Saldo credor PIS/COFINS
    if (efdContrib) {
      if (efdContrib.pisSaldoCredor > 0) {
        alerts.push({
          severity: 'info',
          category: 'missing_credit',
          tributo: 'PIS',
          title: `Saldo credor PIS de R$ ${fmt(efdContrib.pisSaldoCredor)}`,
          description: `A EFD Contribuições aponta saldo credor de PIS de R$ ${fmt(efdContrib.pisSaldoCredor)}. Este valor pode ser compensado com outros tributos federais via PER/DCOMP.`,
          valorEnvolvido: efdContrib.pisSaldoCredor,
          economiaEstimada: efdContrib.pisSaldoCredor,
          baseLegal: 'Lei 10.637/02 | IN RFB 2.055/2021 — compensação via PER/DCOMP',
          registroSped: 'M200 — Apuração PIS',
          parecer: `Saldo credor de PIS disponível para compensação. Recomenda-se utilização via PER/DCOMP para compensar IRPJ, CSLL, PIS ou COFINS vincendos.`,
          periodo: formatPeriod(periodo),
        });
      }
      if (efdContrib.cofinsSaldoCredor > 0) {
        alerts.push({
          severity: 'info',
          category: 'missing_credit',
          tributo: 'COFINS',
          title: `Saldo credor COFINS de R$ ${fmt(efdContrib.cofinsSaldoCredor)}`,
          description: `A EFD Contribuições aponta saldo credor de COFINS de R$ ${fmt(efdContrib.cofinsSaldoCredor)}. Este valor pode ser compensado via PER/DCOMP.`,
          valorEnvolvido: efdContrib.cofinsSaldoCredor,
          economiaEstimada: efdContrib.cofinsSaldoCredor,
          baseLegal: 'Lei 10.833/03 | IN RFB 2.055/2021',
          registroSped: 'M600 — Apuração COFINS',
          parecer: `Saldo credor de COFINS disponível para compensação via PER/DCOMP.`,
          periodo: formatPeriod(periodo),
        });
      }
    }

    // 6. ECF — IRPJ/CSLL retidos a maior
    if (ecf) {
      if (ecf.irpjRetido > ecf.irpjAPagar && ecf.irpjRetido > 0) {
        const excedente = ecf.irpjRetido - ecf.irpjAPagar;
        alerts.push({
          severity: 'critical',
          category: 'retention_excess',
          tributo: 'IRPJ',
          title: `IRPJ retido a maior: R$ ${fmt(excedente)}`,
          description: `O IRPJ retido na fonte (R$ ${fmt(ecf.irpjRetido)}) excede o IRPJ devido (R$ ${fmt(ecf.irpjAPagar)}) em R$ ${fmt(excedente)}. Este valor pode ser restituído ou compensado.`,
          valorEnvolvido: ecf.irpjRetido,
          economiaEstimada: excedente,
          baseLegal: 'RIR/2018 art. 932 | IN RFB 2.055/2021',
          registroSped: 'N620/N660 — Cálculo IRPJ',
          parecer: `IRPJ retido (R$ ${fmt(ecf.irpjRetido)}) superior ao devido (R$ ${fmt(ecf.irpjAPagar)}). O excedente de R$ ${fmt(excedente)} é restituível via PER/DCOMP ou pedido de restituição.`,
          periodo: formatPeriod(periodo),
        });
      }
      if (ecf.csllRetido > ecf.csllAPagar && ecf.csllRetido > 0) {
        const excedente = ecf.csllRetido - ecf.csllAPagar;
        alerts.push({
          severity: 'critical',
          category: 'retention_excess',
          tributo: 'CSLL',
          title: `CSLL retida a maior: R$ ${fmt(excedente)}`,
          description: `A CSLL retida na fonte (R$ ${fmt(ecf.csllRetido)}) excede a CSLL devida (R$ ${fmt(ecf.csllAPagar)}) em R$ ${fmt(excedente)}.`,
          valorEnvolvido: ecf.csllRetido,
          economiaEstimada: excedente,
          baseLegal: 'Lei 10.833/03 art. 36 | IN RFB 2.055/2021',
          registroSped: 'N630 — Cálculo CSLL',
          parecer: `CSLL retida (R$ ${fmt(ecf.csllRetido)}) superior à devida (R$ ${fmt(ecf.csllAPagar)}). Excedente de R$ ${fmt(excedente)} restituível.`,
          periodo: formatPeriod(periodo),
        });
      }
    }

    const economiaTotal = alerts.reduce((s, a) => s + a.economiaEstimada, 0);

    logger.info(`[COMPLIANCE] ${sped.empresa} | ${alerts.length} alertas | Economia: R$ ${fmt(economiaTotal)}`);

    return {
      spedType: tipo,
      periodoInicio: sped.periodo?.inicio || '',
      periodoFim: sped.periodo?.fim || '',
      ano,
      mes,
      totalCreditos: sped.resumo?.icmsCreditos || 0,
      totalDebitos: sped.resumo?.icmsDebitos || 0,
      alerts,
      resumo: {
        empresa: sped.empresa,
        cnpj: sped.cnpj,
        totalAlertasCriticos: alerts.filter(a => a.severity === 'critical').length,
        totalAlertasWarning: alerts.filter(a => a.severity === 'warning').length,
        totalAlertasInfo: alerts.filter(a => a.severity === 'info').length,
        economiaTotal,
      },
    };
  }
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriod(dt: string): string {
  if (!dt || dt.length !== 8) return dt;
  return `${dt.substring(0, 2)}/${dt.substring(2, 4)}/${dt.substring(4, 8)}`;
}
