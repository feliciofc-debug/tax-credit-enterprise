import { serproService, SerproCredentials } from './serpro.service';
import { logger } from '../utils/logger';

// ============================================================
// Cross-Analysis Service
// ------------------------------------------------------------
// Cruza dados que so existem dentro do e-CAC via procuracao:
//
//  - DIRF (o que a empresa DECLAROU que reteve/pagou)
//  - Fontes Pagadoras (o que TERCEIROS declararam que pagaram pra ela)
//
// Divergencias entre os dois sao gatilhos classicos de:
//   * teses tributarias (IR retido a maior, PIS/COFINS na BC errada)
//   * autuacoes preventiveis (malha fiscal cruzando os dois lados)
//   * exclusao do Simples Nacional (omissao de receita detectada)
//
// O detector roda em modo "snapshot" (sob demanda) e produz um
// objeto estruturado com pontuacao de risco e lista de evidencias.
// ============================================================

export type Divergencia = {
  tipo: 'rendimento_omisso' | 'imposto_divergente' | 'fonte_nao_declarada' | 'valor_divergente';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cnpjFonte?: string;
  nomeFonte?: string;
  valorDirf?: number;
  valorFonte?: number;
  diferenca?: number;
  descricao: string;
};

export type CrossAnalysisResult = {
  contribuinteCnpj: string;
  anoBase: number;
  geradoEm: string;
  resumo: {
    totalDeclaradoDirf: number;
    totalRecebidoFontes: number;
    diferencaTotal: number;
    diferencaPct: number;
    qtdFontesDirf: number;
    qtdFontesTerceiros: number;
    qtdDivergencias: number;
    scoreRisco: number;
    classificacao: 'baixo' | 'medio' | 'alto' | 'critico';
  };
  divergencias: Divergencia[];
  teses: string[];
  raw: {
    dirfSuccess: boolean;
    fontesSuccess: boolean;
    dirfErro?: string;
    fontesErro?: string;
  };
};

function num(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeCnpj(c?: string): string {
  return (c || '').replace(/\D/g, '');
}

// Extracao defensiva — a API SERPRO retorna formatos diferentes em
// trial vs producao. Tentamos varios paths comuns.
function extractDirfFontes(data: any): Array<{ cnpj: string; nome: string; rendimentos: number; irRetido: number }> {
  if (!data) return [];
  const candidates =
    data.fontes ||
    data.fontesPagadoras ||
    data.rendimentos ||
    data.beneficiarios ||
    [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((f: any) => ({
    cnpj: normalizeCnpj(f.cnpjFonte || f.cnpj || f.cnpjPagador || ''),
    nome: f.nomeFonte || f.nome || f.razaoSocial || 'Fonte nao identificada',
    rendimentos: num(f.rendimentosBrutos || f.valorRendimento || f.rendimentos || f.valor || 0),
    irRetido: num(f.irRetido || f.impostoRetido || f.valorIR || 0),
  }));
}

function extractFontesPagadoras(data: any): Array<{ cnpj: string; nome: string; rendimentos: number; irRetido: number }> {
  if (!data) return [];
  const candidates =
    data.fontesPagadoras ||
    data.pagadores ||
    data.fontes ||
    [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((f: any) => ({
    cnpj: normalizeCnpj(f.cnpjFonte || f.cnpj || f.cnpjPagador || ''),
    nome: f.nomeFonte || f.nome || f.razaoSocial || 'Fonte nao identificada',
    rendimentos: num(f.rendimentosPagos || f.valorPago || f.rendimentos || f.valor || 0),
    irRetido: num(f.irRetido || f.impostoRetido || f.valorIR || 0),
  }));
}

export async function runCrossAnalysisDirfFontes(
  creds: SerproCredentials,
  contratanteCnpj: string,
  contribuinteCnpj: string,
  anoBase: number,
): Promise<CrossAnalysisResult> {
  const cnpj = normalizeCnpj(contribuinteCnpj);

  const [dirfRes, fontesRes] = await Promise.all([
    serproService.consultarDIRF(creds, contratanteCnpj, cnpj, anoBase).catch(e => ({ success: false, data: null, raw: { error: e.message } })),
    serproService.consultarFontesPagadoras(creds, contratanteCnpj, cnpj, anoBase).catch(e => ({ success: false, data: null, raw: { error: e.message } })),
  ]);

  const dirfFontes = extractDirfFontes((dirfRes as any).data);
  const fontesTerceiros = extractFontesPagadoras((fontesRes as any).data);

  const divergencias: Divergencia[] = [];

  // Mapa por CNPJ pra cruzar
  const dirfMap = new Map(dirfFontes.map(f => [f.cnpj, f]));
  const fontesMap = new Map(fontesTerceiros.map(f => [f.cnpj, f]));
  const todosCnpjs = new Set([...dirfMap.keys(), ...fontesMap.keys()].filter(Boolean));

  for (const c of todosCnpjs) {
    const d = dirfMap.get(c);
    const f = fontesMap.get(c);
    if (!d && f && f.rendimentos > 0) {
      const sev: Divergencia['severity'] = f.rendimentos > 100000 ? 'critical' : f.rendimentos > 10000 ? 'high' : 'medium';
      divergencias.push({
        tipo: 'rendimento_omisso',
        severity: sev,
        cnpjFonte: c,
        nomeFonte: f.nome,
        valorDirf: 0,
        valorFonte: f.rendimentos,
        diferenca: f.rendimentos,
        descricao: `Fonte ${f.nome} declarou pagamento de R$ ${f.rendimentos.toFixed(2)} mas nao consta na DIRF do contribuinte (RISCO DE OMISSAO).`,
      });
    } else if (d && !f && d.rendimentos > 0) {
      divergencias.push({
        tipo: 'fonte_nao_declarada',
        severity: 'low',
        cnpjFonte: c,
        nomeFonte: d.nome,
        valorDirf: d.rendimentos,
        valorFonte: 0,
        diferenca: -d.rendimentos,
        descricao: `Contribuinte declarou na DIRF rendimento de R$ ${d.rendimentos.toFixed(2)} da fonte ${d.nome} mas terceiro nao confirmou (verificar se a fonte declarou DIRF dela).`,
      });
    } else if (d && f) {
      const dif = Math.abs(d.rendimentos - f.rendimentos);
      const difIR = Math.abs(d.irRetido - f.irRetido);
      const limite = Math.max(d.rendimentos, f.rendimentos) * 0.05; // 5% tolerancia
      if (dif > limite && dif > 100) {
        const sev: Divergencia['severity'] = dif > 50000 ? 'high' : 'medium';
        divergencias.push({
          tipo: 'valor_divergente',
          severity: sev,
          cnpjFonte: c,
          nomeFonte: f.nome,
          valorDirf: d.rendimentos,
          valorFonte: f.rendimentos,
          diferenca: f.rendimentos - d.rendimentos,
          descricao: `Divergencia de R$ ${dif.toFixed(2)} entre DIRF (R$ ${d.rendimentos.toFixed(2)}) e fonte ${f.nome} (R$ ${f.rendimentos.toFixed(2)}).`,
        });
      }
      if (difIR > 10) {
        divergencias.push({
          tipo: 'imposto_divergente',
          severity: difIR > 1000 ? 'high' : 'medium',
          cnpjFonte: c,
          nomeFonte: f.nome,
          valorDirf: d.irRetido,
          valorFonte: f.irRetido,
          diferenca: f.irRetido - d.irRetido,
          descricao: `IR retido divergente para ${f.nome}: DIRF R$ ${d.irRetido.toFixed(2)} x Fonte R$ ${f.irRetido.toFixed(2)} (potencial recuperacao se DIRF > Fonte).`,
        });
      }
    }
  }

  const totalDirf = dirfFontes.reduce((acc, f) => acc + f.rendimentos, 0);
  const totalFontes = fontesTerceiros.reduce((acc, f) => acc + f.rendimentos, 0);
  const difTotal = totalFontes - totalDirf;
  const difPct = totalDirf > 0 ? (difTotal / totalDirf) * 100 : 0;

  // Score de risco
  let score = 100;
  for (const d of divergencias) {
    if (d.severity === 'critical') score -= 30;
    else if (d.severity === 'high') score -= 15;
    else if (d.severity === 'medium') score -= 7;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  const classificacao: CrossAnalysisResult['resumo']['classificacao'] =
    score >= 80 ? 'baixo' : score >= 60 ? 'medio' : score >= 40 ? 'alto' : 'critico';

  // Sugestoes de tese tributaria
  const teses: string[] = [];
  const irRetidoMaior = divergencias.filter(d => d.tipo === 'imposto_divergente' && (d.diferenca || 0) < 0);
  if (irRetidoMaior.length > 0) {
    const total = Math.abs(irRetidoMaior.reduce((acc, d) => acc + (d.diferenca || 0), 0));
    teses.push(`Possivel IR retido a maior: R$ ${total.toFixed(2)} (${irRetidoMaior.length} fontes). Tese de restituicao via PER/DCOMP.`);
  }
  const omissoes = divergencias.filter(d => d.tipo === 'rendimento_omisso');
  if (omissoes.length > 0) {
    const total = omissoes.reduce((acc, d) => acc + (d.valorFonte || 0), 0);
    teses.push(`URGENTE: ${omissoes.length} omissoes de receita totalizando R$ ${total.toFixed(2)}. Risco alto de malha fiscal — recomenda DCTF retificadora.`);
  }
  if (Math.abs(difPct) > 10) {
    teses.push(`Divergencia agregada de ${difPct.toFixed(1)}% entre DIRF e Fontes — revisar fechamento contabil-fiscal do ano-base.`);
  }
  if (divergencias.length === 0 && totalDirf > 0) {
    teses.push('Sem divergencias relevantes detectadas. Contribuinte com boa qualidade declaratoria.');
  }

  const result: CrossAnalysisResult = {
    contribuinteCnpj: cnpj,
    anoBase,
    geradoEm: new Date().toISOString(),
    resumo: {
      totalDeclaradoDirf: totalDirf,
      totalRecebidoFontes: totalFontes,
      diferencaTotal: difTotal,
      diferencaPct: difPct,
      qtdFontesDirf: dirfFontes.length,
      qtdFontesTerceiros: fontesTerceiros.length,
      qtdDivergencias: divergencias.length,
      scoreRisco: score,
      classificacao,
    },
    divergencias,
    teses,
    raw: {
      dirfSuccess: !!(dirfRes as any).success,
      fontesSuccess: !!(fontesRes as any).success,
      dirfErro: (dirfRes as any).raw?.error,
      fontesErro: (fontesRes as any).raw?.error,
    },
  };

  logger.info(`[CrossAnalysis] cnpj=${cnpj} ano=${anoBase} divergencias=${divergencias.length} score=${score}`);
  return result;
}
