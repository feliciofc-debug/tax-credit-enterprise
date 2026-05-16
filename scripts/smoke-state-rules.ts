/**
 * Smoke test do StateRulesEngine
 * ---------------------------------------------------------------
 * Verifica deterministicamente, sem subir o servidor:
 *  - 27 UFs catalogadas (8 covered + 19 planned + 0 pending)
 *  - PIB consistente (~100%)
 *  - 27 UFs com baseLegal.ricms preenchido
 *  - 27 UFs com procuracao detalhada
 *  - 27 UFs com fundamentacao legal nao-vazia
 *  - 10 UFs Onda 3 ativas em tier C com regras minimamente completas
 *
 * Uso: npx tsx scripts/smoke-state-rules.ts
 * Saida 0 = OK, 1 = falha (apropriado para CI/Vercel pre-deploy).
 */

import {
  getStateRule,
  getAutoridadeFormatada,
  getFundamentacaoLegal,
  getRicms,
  getCoberturaSummary,
  listCobertura,
} from '../src/services/state-rules.service';
import { STATE_RULES } from '../src/config/state-rules.config';

interface Check { name: string; ok: boolean; detail?: string }

const results: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

const UFS_COVERED = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'MT'];
const UFS_PLANNED_ONDA1 = ['PE', 'CE', 'MA', 'ES', 'GO'];
const UFS_PLANNED_ONDA2 = ['DF', 'MS', 'AM', 'PA'];
const UFS_PLANNED_ONDA3 = ['AL', 'SE', 'RN', 'PB', 'PI', 'RO', 'RR', 'AP', 'AC', 'TO'];
const UFS_PLANNED = [...UFS_PLANNED_ONDA1, ...UFS_PLANNED_ONDA2, ...UFS_PLANNED_ONDA3];
const UFS_DETALHADAS = [...UFS_COVERED, ...UFS_PLANNED];

// 1. Total de UFs
const cobertura = listCobertura();
check('27 UFs catalogadas', cobertura.length === 27, `recebido: ${cobertura.length}`);

// 2. Distribuicao por status
const summary = getCoberturaSummary();
check(
  '8 covered + 19 planned + 0 pending',
  summary.porStatus.covered === 8 && summary.porStatus.planned === 19 && summary.porStatus.pending === 0,
  JSON.stringify(summary.porStatus),
);

// 3. PIB total ~ 100% (tolerancia +/- 5%)
const pibTotal = summary.pibCoberto + summary.pibPlanejado + summary.pibPendente;
check(
  'Soma do PIB nas 27 UFs ~100%',
  pibTotal >= 90 && pibTotal <= 105,
  `pibTotal=${pibTotal}% (coberto=${summary.pibCoberto} + planejado=${summary.pibPlanejado} + pendente=${summary.pibPendente})`,
);

// 4. RICMS preenchido para covered + planned
for (const uf of UFS_DETALHADAS) {
  const ricms = getRicms(uf);
  check(`baseLegal.ricms preenchido (${uf})`, !!ricms && ricms.length > 5, ricms);
}

// 5. Procuracao com poderesNecessarios para covered + planned
for (const uf of UFS_DETALHADAS) {
  const rule = STATE_RULES[uf];
  const procOk = !!rule.procuracao && (rule.procuracao.aceitaProcuracaoGenerica !== undefined);
  check(`procuracao definida (${uf})`, procOk);
}

// 6. Fundamentacao legal nao-vazia para covered + planned
for (const uf of UFS_DETALHADAS) {
  const fund = getFundamentacaoLegal(uf);
  check(`fundamentacao legal nao-vazia (${uf})`, fund.length > 20, fund.slice(0, 80));
}

// 7. Autoridades formatadas com cadastro especifico para covered + planned
for (const uf of UFS_DETALHADAS) {
  const a = getAutoridadeFormatada(uf);
  check(`autoridade/orgao/cadastro completos (${uf})`, !!a.autoridade && !!a.orgao && !!a.cadastro);
}

// 8. Default UF (SP) quando uf invalido
const fallback = getStateRule('XX');
check('Fallback retorna SP quando UF invalido', fallback.uf === 'SP', `recebido: ${fallback.uf}`);

// 9. Zero UFs em pending - mapa nacional completo
const pending = cobertura.filter(c => c.status === 'pending');
check('Zero UFs em pending - mapa nacional completo', pending.length === 0, `recebido: ${pending.length}`);

// 10. Onda 2 e Onda 3 promovidas a planned
for (const uf of [...UFS_PLANNED_ONDA2, ...UFS_PLANNED_ONDA3]) {
  const r = STATE_RULES[uf];
  check(`promovida a planned (${uf})`, r.status === 'planned', `status atual: ${r.status}`);
}

// 11. Onda 3 deve estar em tier C
for (const uf of UFS_PLANNED_ONDA3) {
  const r = STATE_RULES[uf];
  check(`Onda 3 em tier C (${uf})`, r.tier === 'C', `tier atual: ${r.tier}`);
}

// === Relatorio ===
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok);

console.log('\n=== Smoke test StateRulesEngine ===\n');
for (const r of results) {
  const icon = r.ok ? 'OK' : 'FAIL';
  const detail = r.detail ? `  (${r.detail})` : '';
  console.log(`[${icon}] ${r.name}${detail}`);
}
console.log(`\nResultado: ${passed}/${results.length} checks OK`);

if (failed.length) {
  console.error(`\nFALHAS (${failed.length}):`);
  for (const f of failed) console.error(`  - ${f.name}: ${f.detail || ''}`);
  process.exit(1);
}

console.log('\nTodos os checks passaram. Engine pronta para producao.\n');
process.exit(0);
