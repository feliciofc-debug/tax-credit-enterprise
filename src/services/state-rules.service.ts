/**
 * StateRulesService — API publica do StateRulesEngine
 * ============================================================
 *
 * Substitui os mapas hardcoded espalhados pelo backend:
 *   - formalization.service.ts: AUTORIDADES_UF, getFundamentacaoUF
 *   - demonstrativo.service.ts: baseLegal RICMS-RJ fixo
 *   - procuration.service.ts: SEFAZ/${uf} com default RJ
 *   - compliance.service.ts: "Portaria CAT (SP)" hardcoded
 *
 * Toda chamada de regra estadual passa por aqui.
 */

import { STATE_RULES, ALL_UFS, StateRule, StateStatus, StateTier, Regiao } from '../config/state-rules.config';

const DEFAULT_UF = 'SP';

function safeUf(uf?: string | null): string {
  const u = (uf || '').toUpperCase().trim();
  return STATE_RULES[u] ? u : DEFAULT_UF;
}

export function getStateRule(uf?: string | null): StateRule {
  return STATE_RULES[safeUf(uf)];
}

export function getAutoridade(uf?: string | null): string {
  return getStateRule(uf).sefaz.autoridade;
}

export function getAutoridadeOficial(uf?: string | null): string {
  const r = getStateRule(uf);
  return r.sefaz.autoridadeOficial || r.sefaz.autoridade;
}

export function getNomeOrgao(uf?: string | null): string {
  return getStateRule(uf).sefaz.nomeOrgao;
}

export function getNomeOficial(uf?: string | null): string {
  const r = getStateRule(uf);
  return r.sefaz.nomeOficial || r.sefaz.nomeOrgao;
}

export function getCadastroEstadual(uf?: string | null): string {
  const r = getStateRule(uf);
  return r.sefaz.cadastroEstadual || `Cadastro de Contribuintes ICMS/${r.uf}`;
}

/**
 * Estrutura compativel com AUTORIDADES_UF antigo
 * (drop-in para formalization.service)
 */
export function getAutoridadeFormatada(uf?: string | null): { autoridade: string; orgao: string; cadastro: string } {
  return {
    autoridade: getAutoridadeOficial(uf),
    orgao: getNomeOficial(uf),
    cadastro: getCadastroEstadual(uf),
  };
}

export function getSistemaCredito(uf?: string | null): string | undefined {
  return getStateRule(uf).sefaz.sistemaCreditoAcumulado;
}

export function getPortalProcessos(uf?: string | null): string | undefined {
  return getStateRule(uf).sefaz.portalProcessos;
}

export function getRicms(uf?: string | null): string {
  const rule = getStateRule(uf);
  return rule.baseLegal.ricms || `RICMS/${rule.uf}`;
}

/**
 * Texto de fundamentacao normativa para inclusao em peticoes
 * SEFAZ. Substitui o getFundamentacaoUF() hardcoded em
 * formalization.service.
 */
export function getFundamentacaoLegal(uf?: string | null): string {
  const r = getStateRule(uf);
  const partes: string[] = [];
  if (r.baseLegal.leiComplementar) partes.push(r.baseLegal.leiComplementar);
  if (r.baseLegal.ricms) partes.push(r.baseLegal.ricms);
  if (r.baseLegal.artigosPrincipais?.length) partes.push(r.baseLegal.artigosPrincipais.join('; '));
  if (r.baseLegal.resolucoesRelevantes?.length) partes.push(r.baseLegal.resolucoesRelevantes.join('; '));
  if (r.sefaz.sistemaCreditoAcumulado) partes.push(`Sistema oficial: ${r.sefaz.sistemaCreditoAcumulado}`);
  return partes.length > 0 ? partes.join('. ') + '.' : `Lei Complementar 87/1996; RICMS/${r.uf}.`;
}

export function getProcuracaoConfig(uf?: string | null) {
  return getStateRule(uf).procuracao;
}

// ============================================================
// Cobertura nacional — agregado para /api/sefaz/cobertura
// ============================================================

export interface CoberturaItem {
  uf: string;
  nome: string;
  regiao: Regiao;
  status: StateStatus;
  tier: StateTier;
  pibPct: number;
  sistemaCreditoAcumulado?: string;
}

export interface CoberturaSummary {
  total: number;
  porStatus: Record<StateStatus, number>;
  pibCoberto: number;
  pibPlanejado: number;
  pibPendente: number;
  porRegiao: Record<Regiao, { total: number; covered: number; planned: number; pending: number; pibPct: number }>;
  porTier: Record<StateTier, number>;
}

export function listCobertura(): CoberturaItem[] {
  return ALL_UFS.map(uf => {
    const r = STATE_RULES[uf];
    return {
      uf: r.uf,
      nome: r.nome,
      regiao: r.regiao,
      status: r.status,
      tier: r.tier,
      pibPct: r.pibPct,
      sistemaCreditoAcumulado: r.sefaz.sistemaCreditoAcumulado,
    };
  });
}

export function getCoberturaSummary(): CoberturaSummary {
  const items = listCobertura();
  const porStatus = { covered: 0, planned: 0, pending: 0 } as Record<StateStatus, number>;
  const porTier = { A: 0, B: 0, C: 0 } as Record<StateTier, number>;
  const porRegiao: CoberturaSummary['porRegiao'] = {
    N:  { total: 0, covered: 0, planned: 0, pending: 0, pibPct: 0 },
    NE: { total: 0, covered: 0, planned: 0, pending: 0, pibPct: 0 },
    CO: { total: 0, covered: 0, planned: 0, pending: 0, pibPct: 0 },
    SE: { total: 0, covered: 0, planned: 0, pending: 0, pibPct: 0 },
    S:  { total: 0, covered: 0, planned: 0, pending: 0, pibPct: 0 },
  };
  let pibCoberto = 0, pibPlanejado = 0, pibPendente = 0;

  for (const it of items) {
    porStatus[it.status]++;
    porTier[it.tier]++;
    porRegiao[it.regiao].total++;
    porRegiao[it.regiao][it.status]++;
    porRegiao[it.regiao].pibPct += it.pibPct;
    if (it.status === 'covered') pibCoberto += it.pibPct;
    else if (it.status === 'planned') pibPlanejado += it.pibPct;
    else pibPendente += it.pibPct;
  }

  return {
    total: items.length,
    porStatus,
    pibCoberto: Math.round(pibCoberto * 10) / 10,
    pibPlanejado: Math.round(pibPlanejado * 10) / 10,
    pibPendente: Math.round(pibPendente * 10) / 10,
    porRegiao,
    porTier,
  };
}
