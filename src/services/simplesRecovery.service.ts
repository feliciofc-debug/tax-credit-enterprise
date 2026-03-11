import { logger } from '../utils/logger';

// NCMs monofásicos — PIS/COFINS concentrado na indústria
// Empresas do Simples Nacional NÃO devem pagar PIS/COFINS sobre esses no DAS
const NCM_MONOFASICO: Record<string, { grupo: string; descricao: string }> = {
  // Combustíveis e lubrificantes
  '2710': { grupo: 'Combustíveis', descricao: 'Óleos de petróleo, gasolina, diesel, querosene' },
  '2711': { grupo: 'Combustíveis', descricao: 'Gás de petróleo e outros hidrocarbonetos gasosos (GLP)' },
  '2207': { grupo: 'Combustíveis', descricao: 'Álcool etílico (etanol)' },
  '3826': { grupo: 'Combustíveis', descricao: 'Biodiesel e misturas' },
  // Veículos, autopeças e pneus
  '8701': { grupo: 'Veículos', descricao: 'Tratores' },
  '8702': { grupo: 'Veículos', descricao: 'Veículos para transporte coletivo' },
  '8703': { grupo: 'Veículos', descricao: 'Automóveis de passageiros' },
  '8704': { grupo: 'Veículos', descricao: 'Veículos para transporte de mercadorias' },
  '8711': { grupo: 'Veículos', descricao: 'Motocicletas' },
  '4011': { grupo: 'Autopeças', descricao: 'Pneumáticos novos de borracha (pneus)' },
  '4012': { grupo: 'Autopeças', descricao: 'Pneumáticos recauchutados' },
  '4013': { grupo: 'Autopeças', descricao: 'Câmaras de ar' },
  '8407': { grupo: 'Autopeças', descricao: 'Motores de pistão, ignição por centelha' },
  '8408': { grupo: 'Autopeças', descricao: 'Motores de pistão, ignição por compressão (diesel)' },
  '8409': { grupo: 'Autopeças', descricao: 'Partes de motores' },
  '8483': { grupo: 'Autopeças', descricao: 'Árvores de transmissão, engrenagens, rolamentos' },
  '8708': { grupo: 'Autopeças', descricao: 'Partes e acessórios de veículos automotores' },
  // Bebidas frias
  '2201': { grupo: 'Bebidas', descricao: 'Águas minerais e gaseificadas' },
  '2202': { grupo: 'Bebidas', descricao: 'Águas, incluindo águas com adição de açúcar (refrigerantes, sucos)' },
  '2203': { grupo: 'Bebidas', descricao: 'Cervejas de malte' },
  '2204': { grupo: 'Bebidas', descricao: 'Vinhos de uvas frescas' },
  '2205': { grupo: 'Bebidas', descricao: 'Vermutes e outros vinhos aromatizados' },
  '2206': { grupo: 'Bebidas', descricao: 'Outras bebidas fermentadas (sidra, perada)' },
  '2208': { grupo: 'Bebidas', descricao: 'Bebidas destiladas (whisky, vodka, cachaça, rum)' },
  // Produtos farmacêuticos e de perfumaria
  '3001': { grupo: 'Farmacêuticos', descricao: 'Glândulas e extratos para usos opoterápicos' },
  '3002': { grupo: 'Farmacêuticos', descricao: 'Sangue humano, vacinas, toxinas' },
  '3003': { grupo: 'Farmacêuticos', descricao: 'Medicamentos não acondicionados para venda a retalho' },
  '3004': { grupo: 'Farmacêuticos', descricao: 'Medicamentos para venda a retalho' },
  '3005': { grupo: 'Farmacêuticos', descricao: 'Algodão, gazes, curativos, etc.' },
  '3006': { grupo: 'Farmacêuticos', descricao: 'Preparações e artigos farmacêuticos diversos' },
  // Higiene e cosméticos
  '3303': { grupo: 'Cosméticos', descricao: 'Perfumes e águas de colônia' },
  '3304': { grupo: 'Cosméticos', descricao: 'Produtos de beleza, maquiagem, cuidados da pele' },
  '3305': { grupo: 'Cosméticos', descricao: 'Preparações capilares (shampoo, condicionador)' },
  '3306': { grupo: 'Cosméticos', descricao: 'Preparações para higiene bucal (pasta de dente)' },
  '3307': { grupo: 'Cosméticos', descricao: 'Desodorantes, sais de banho, depilatórios' },
  '3401': { grupo: 'Cosméticos', descricao: 'Sabões e sabonetes' },
  // Máquinas e equipamentos (Lei 10.485)
  '8429': { grupo: 'Máquinas', descricao: 'Bulldozers, escavadeiras, compactadores' },
  '8430': { grupo: 'Máquinas', descricao: 'Máquinas para terraplanagem e perfuração' },
  '8432': { grupo: 'Máquinas', descricao: 'Máquinas e aparelhos de uso agrícola' },
  '8433': { grupo: 'Máquinas', descricao: 'Máquinas para colheita e debulha' },
  '8434': { grupo: 'Máquinas', descricao: 'Máquinas de ordenha e para indústria de laticínios' },
  '8436': { grupo: 'Máquinas', descricao: 'Outras máquinas para agricultura e avicultura' },
};

// CSOSN codes que indicam ICMS-ST já recolhido
const CSOSN_ST = ['500', '201', '202', '203'];

// Alíquotas do Simples Nacional por faixa (Anexo I - Comércio)
const FAIXAS_SIMPLES_COMERCIO = [
  { ate: 180000, aliquota: 0.04, pis: 0, cofins: 0, icms: 0.0134 },
  { ate: 360000, aliquota: 0.073, pis: 0, cofins: 0, icms: 0.0186 },
  { ate: 720000, aliquota: 0.095, pis: 0.0024, cofins: 0.0111, icms: 0.0221 },
  { ate: 1800000, aliquota: 0.107, pis: 0.0028, cofins: 0.0128, icms: 0.0237 },
  { ate: 3600000, aliquota: 0.143, pis: 0.0036, cofins: 0.0163, icms: 0.0332 },
  { ate: 4800000, aliquota: 0.19, pis: 0.0056, cofins: 0.0257, icms: 0.0372 },
];

export interface SimplesAnalysisInput {
  cnpj: string;
  companyName: string;
  faturamento12m?: number;
  items: NFeItem[];
}

export interface NFeItem {
  ncm: string;
  descricao?: string;
  cfop?: string;
  csosn?: string;
  cst?: string;
  valorProduto: number;
  valorIcmsSt?: number;
  competencia?: string;
}

export interface SimplesRecoveryResult {
  cnpj: string;
  companyName: string;
  totalRecuperavel: number;
  totalMonofasicoPis: number;
  totalMonofasicoCofins: number;
  totalIcmsSt: number;
  totalItens: number;
  itensMonofasicos: number;
  itensIcmsSt: number;
  faixaSimples: typeof FAIXAS_SIMPLES_COMERCIO[0] | null;
  detalhamento: RecoveryDetail[];
  porGrupo: Record<string, { monofasico: number; icmsSt: number; total: number; itens: number }>;
  porCompetencia: Record<string, { monofasico: number; icmsSt: number; total: number }>;
}

export interface RecoveryDetail {
  tipo: string;
  tributo: string;
  ncm: string;
  descricao: string;
  grupo: string;
  valorBase: number;
  aliquotaDas: number;
  valorRecuperavel: number;
  competencia?: string;
  baseLegal: string;
}

export function isMonofasico(ncm: string): { is: boolean; grupo?: string; descricao?: string } {
  if (!ncm) return { is: false };
  const ncm4 = ncm.replace(/\D/g, '').substring(0, 4);
  const match = NCM_MONOFASICO[ncm4];
  if (match) return { is: true, ...match };
  return { is: false };
}

export function getFaixaSimples(faturamento12m: number) {
  for (const faixa of FAIXAS_SIMPLES_COMERCIO) {
    if (faturamento12m <= faixa.ate) return faixa;
  }
  return FAIXAS_SIMPLES_COMERCIO[FAIXAS_SIMPLES_COMERCIO.length - 1];
}

export function analyzeSimples(input: SimplesAnalysisInput): SimplesRecoveryResult {
  const faturamento12m = input.faturamento12m || 1800000;
  const faixa = getFaixaSimples(faturamento12m);
  
  const detalhamento: RecoveryDetail[] = [];
  let totalMonofasicoPis = 0;
  let totalMonofasicoCofins = 0;
  let totalIcmsSt = 0;
  let itensMonofasicos = 0;
  let itensIcmsSt = 0;
  const porGrupo: Record<string, { monofasico: number; icmsSt: number; total: number; itens: number }> = {};
  const porCompetencia: Record<string, { monofasico: number; icmsSt: number; total: number }> = {};

  for (const item of input.items) {
    const ncmClean = (item.ncm || '').replace(/\D/g, '');
    const mono = isMonofasico(ncmClean);
    const comp = item.competencia || 'N/D';

    if (!porCompetencia[comp]) porCompetencia[comp] = { monofasico: 0, icmsSt: 0, total: 0 };

    if (mono.is) {
      itensMonofasicos++;
      const pisPago = item.valorProduto * faixa.pis;
      const cofinsPago = item.valorProduto * faixa.cofins;
      totalMonofasicoPis += pisPago;
      totalMonofasicoCofins += cofinsPago;
      
      const grupo = mono.grupo || 'Outros';
      if (!porGrupo[grupo]) porGrupo[grupo] = { monofasico: 0, icmsSt: 0, total: 0, itens: 0 };
      porGrupo[grupo].monofasico += pisPago + cofinsPago;
      porGrupo[grupo].total += pisPago + cofinsPago;
      porGrupo[grupo].itens++;
      
      porCompetencia[comp].monofasico += pisPago + cofinsPago;
      porCompetencia[comp].total += pisPago + cofinsPago;

      if (pisPago > 0) {
        detalhamento.push({
          tipo: 'monofasico_pis',
          tributo: 'PIS',
          ncm: ncmClean,
          descricao: item.descricao || mono.descricao || ncmClean,
          grupo,
          valorBase: item.valorProduto,
          aliquotaDas: faixa.pis * 100,
          valorRecuperavel: pisPago,
          competencia: comp,
          baseLegal: 'Lei 10.147/2000, Art. 2º — PIS monofásico concentrado na indústria. Empresa do Simples Nacional não deve recolher PIS sobre produtos monofásicos no DAS (LC 123/2006, Art. 18, §4º-A, I)',
        });
      }
      if (cofinsPago > 0) {
        detalhamento.push({
          tipo: 'monofasico_cofins',
          tributo: 'COFINS',
          ncm: ncmClean,
          descricao: item.descricao || mono.descricao || ncmClean,
          grupo,
          valorBase: item.valorProduto,
          aliquotaDas: faixa.cofins * 100,
          valorRecuperavel: cofinsPago,
          competencia: comp,
          baseLegal: 'Lei 10.147/2000, Art. 2º — COFINS monofásico concentrado na indústria. Empresa do Simples Nacional não deve recolher COFINS sobre produtos monofásicos no DAS (LC 123/2006, Art. 18, §4º-A, I)',
        });
      }
    }

    const isStItem = CSOSN_ST.includes(item.csosn || '') || (item.valorIcmsSt && item.valorIcmsSt > 0);
    if (isStItem) {
      itensIcmsSt++;
      const icmsPagoNoDas = item.valorProduto * faixa.icms;
      totalIcmsSt += icmsPagoNoDas;

      const grupo = mono.is ? (mono.grupo || 'Outros') : 'ICMS-ST';
      if (!porGrupo[grupo]) porGrupo[grupo] = { monofasico: 0, icmsSt: 0, total: 0, itens: 0 };
      porGrupo[grupo].icmsSt += icmsPagoNoDas;
      porGrupo[grupo].total += icmsPagoNoDas;
      if (!mono.is) porGrupo[grupo].itens++;

      porCompetencia[comp].icmsSt += icmsPagoNoDas;
      porCompetencia[comp].total += icmsPagoNoDas;

      detalhamento.push({
        tipo: 'icms_st',
        tributo: 'ICMS',
        ncm: ncmClean,
        descricao: item.descricao || 'Produto com ICMS-ST',
        grupo,
        valorBase: item.valorProduto,
        aliquotaDas: faixa.icms * 100,
        valorRecuperavel: icmsPagoNoDas,
        competencia: comp,
        baseLegal: 'LC 123/2006, Art. 18, §4º-A, IV — ICMS já recolhido por substituição tributária não deve ser incluído no cálculo do DAS. CSOSN 500 indica ST já recolhida anteriormente.',
      });
    }
  }

  const totalRecuperavel = totalMonofasicoPis + totalMonofasicoCofins + totalIcmsSt;

  logger.info(`[SimplesRecovery] ${input.cnpj} — ${input.items.length} itens, ${itensMonofasicos} monofásicos, ${itensIcmsSt} ST, total recuperável: R$ ${totalRecuperavel.toFixed(2)}`);

  return {
    cnpj: input.cnpj,
    companyName: input.companyName,
    totalRecuperavel,
    totalMonofasicoPis,
    totalMonofasicoCofins,
    totalIcmsSt,
    totalItens: input.items.length,
    itensMonofasicos,
    itensIcmsSt,
    faixaSimples: faixa,
    detalhamento,
    porGrupo,
    porCompetencia,
  };
}

// Parser de NFe XML — extrai itens relevantes
export function parseNFeXml(xmlContent: string): NFeItem[] {
  const items: NFeItem[] = [];
  
  const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/gi;
  let detMatch;
  
  while ((detMatch = detRegex.exec(xmlContent)) !== null) {
    const det = detMatch[1];
    
    const ncm = extractTag(det, 'NCM') || '';
    const descricao = extractTag(det, 'xProd') || '';
    const cfop = extractTag(det, 'CFOP') || '';
    const csosn = extractTag(det, 'CSOSN') || '';
    const cst = extractTag(det, 'CST') || '';
    const vProd = parseFloat(extractTag(det, 'vProd') || '0');
    const vICMSST = parseFloat(extractTag(det, 'vICMSST') || '0');

    if (ncm && vProd > 0) {
      items.push({
        ncm,
        descricao,
        cfop,
        csosn,
        cst,
        valorProduto: vProd,
        valorIcmsSt: vICMSST,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

// Extrai competência da NFe (data de emissão)
export function extractCompetencia(xmlContent: string): string | null {
  const dhEmi = extractTag(xmlContent, 'dhEmi') || extractTag(xmlContent, 'dEmi');
  if (!dhEmi) return null;
  const date = dhEmi.substring(0, 7); // YYYY-MM
  return date;
}

export const NCM_TABLE = NCM_MONOFASICO;
