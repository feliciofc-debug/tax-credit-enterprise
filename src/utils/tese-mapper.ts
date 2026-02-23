// src/utils/tese-mapper.ts
// Mapeia oportunidades identificadas pelo Claude para códigos de tese
// para buscar jurisprudência correspondente

export function mapearTesesDasOportunidades(oportunidades: any[]): string[] {
  const teses = new Set<string>();

  for (const op of oportunidades) {
    const tipo = (op.tipo || '').toLowerCase();
    const tributo = (op.tributo || '').toLowerCase();
    const fund = (op.fundamentacaoLegal || '').toLowerCase();

    // PIS/COFINS — Tese do Século (Tema 69)
    if (fund.includes('574706') || fund.includes('tema 69') || tipo.includes('tese do século')) {
      if (tributo === 'pis') teses.add('TESE_1.1');
      if (tributo === 'cofins') teses.add('TESE_1.2');
      if (tributo !== 'pis' && tributo !== 'cofins') {
        teses.add('TESE_1.1');
        teses.add('TESE_1.2');
      }
    }

    // PIS/COFINS insumos (Tema 779)
    if (fund.includes('1221170') || fund.includes('tema 779') || tipo.includes('insumos')) {
      if (tributo === 'pis') teses.add('TESE_1.3');
      if (tributo === 'cofins') teses.add('TESE_1.4');
      if (tributo !== 'pis' && tributo !== 'cofins') {
        teses.add('TESE_1.3');
        teses.add('TESE_1.4');
      }
    }

    // PIS/COFINS monofásico
    if (tipo.includes('monofásico') || fund.includes('10147')) {
      teses.add('TESE_1.5');
    }

    // PIS/COFINS ativo imobilizado
    if ((tributo === 'pis' || tributo === 'cofins') && (tipo.includes('ativo imobilizado') || tipo.includes('depreciação'))) {
      teses.add('TESE_1.6');
    }

    // Exportação PIS/COFINS
    if (tipo.includes('exportação') && (tributo === 'pis' || tributo === 'cofins')) {
      teses.add('TESE_1.7');
    }

    // Exclusão ISS da base PIS/COFINS (Tema 1093)
    if (fund.includes('tema 1093') || fund.includes('592616') || (tipo.includes('iss') && tipo.includes('exclusão'))) {
      teses.add('TESE_1.8');
    }

    // Receitas financeiras PIS/COFINS
    if (tipo.includes('receitas financeiras') || fund.includes('8426')) {
      teses.add('TESE_1.9');
    }

    // ICMS energia (TUSD/TUST)
    if (tipo.includes('tusd') || tipo.includes('tust') || tipo.includes('energia elétrica')) {
      teses.add('TESE_2.1');
    }

    // ICMS substituição tributária
    if (tributo.includes('icms') && (tipo.includes('substituição') || tipo.includes('icms-st'))) {
      teses.add('TESE_2.2');
    }

    // ICMS ativo permanente (CIAP)
    if (tributo.includes('icms') && (tipo.includes('ciap') || tipo.includes('ativo permanente'))) {
      teses.add('TESE_2.3');
    }

    // ICMS exportação/acumulado
    if (tributo.includes('icms') && (tipo.includes('saldo credor') || tipo.includes('acumulado') || tipo.includes('exportação'))) {
      teses.add('TESE_2.4');
    }

    // Exclusão ICMS-ST da base PIS/COFINS (Tema 1048)
    if (fund.includes('tema 1048') || fund.includes('1896678')) {
      teses.add('TESE_2.6');
    }

    // ADC 49 transferência entre filiais
    if (fund.includes('adc 49') || fund.includes('lc 204') || tipo.includes('filiais') || tipo.includes('transferência entre')) {
      teses.add('TESE_2.7');
    }

    // INSS patronal verbas indenizatórias
    if (tributo === 'inss' && (tipo.includes('verbas') || tipo.includes('indenizatória') || fund.includes('tema 985'))) {
      teses.add('TESE_3.1');
    }

    // Sistema S / contribuições terceiros
    if (tipo.includes('sistema s') || tipo.includes('terceiros') || fund.includes('lei 6950')) {
      teses.add('TESE_3.2');
    }

    // FGTS
    if (tributo === 'fgts') teses.add('TESE_3.4');

    // Benefícios fiscais ICMS / IRPJ (LC 160)
    if (tipo.includes('benefícios fiscais') || fund.includes('lc 160') || fund.includes('12.973') || fund.includes('1517492')) {
      teses.add('TESE_4.1');
    }

    // Equiparação hospitalar
    if (tipo.includes('equiparação hospitalar') || tipo.includes('hospitalar') || fund.includes('tema 217')) {
      teses.add('TESE_4.4');
    }

    // SELIC sobre indébito tributário (Tema 1079)
    if (fund.includes('1063187') || fund.includes('tema 1079') || tipo.includes('selic')) {
      teses.add('TESE_4.5');
    }

    // JCP
    if (tipo.includes('jcp') || tipo.includes('juros sobre capital')) {
      teses.add('TESE_4.6');
    }

    // IPI
    if (tributo === 'ipi') teses.add('TESE_5.1');

    // Importação PIS/COFINS
    if (tributo.includes('pis') && tipo.includes('importação')) teses.add('TESE_7.1');
    if (tributo.includes('cofins') && tipo.includes('importação')) teses.add('TESE_7.1');

    // ICMS importação
    if (tipo.includes('icms-importação') || tipo.includes('icms importação') || (tributo.includes('icms') && tipo.includes('importação'))) {
      teses.add('TESE_7.2');
    }
  }

  return Array.from(teses);
}
