/**
 * Sefaz Routes — Cobertura nacional e regras estaduais.
 * Consome StateRulesEngine (src/config/state-rules.config.ts).
 */

import { Router, Request, Response } from 'express';
import {
  listCobertura,
  getCoberturaSummary,
  getStateRule,
} from '../services/state-rules.service';
import { STATE_RULES } from '../config/state-rules.config';

const router = Router();

/**
 * GET /api/sefaz/cobertura
 * Lista todos os UFs com status, tier, PIB e sistema.
 */
router.get('/cobertura', (_req: Request, res: Response) => {
  const items = listCobertura();
  const summary = getCoberturaSummary();
  res.json({ summary, items });
});

/**
 * GET /api/sefaz/uf/:uf
 * Detalhe completo de uma UF (todas as regras).
 */
router.get('/uf/:uf', (req: Request, res: Response) => {
  const uf = (req.params.uf || '').toUpperCase();
  const rule = STATE_RULES[uf];
  if (!rule) return res.status(404).json({ error: 'UF nao encontrada', uf });
  res.json(rule);
});

/**
 * GET /api/sefaz/uf/:uf/resumo
 * Resumo leve (autoridade, fundamentacao, procuracao) — util para
 * UI de geracao de peticoes.
 */
router.get('/uf/:uf/resumo', (req: Request, res: Response) => {
  const r = getStateRule(req.params.uf);
  res.json({
    uf: r.uf,
    nome: r.nome,
    regiao: r.regiao,
    status: r.status,
    tier: r.tier,
    autoridade: r.sefaz.autoridadeOficial || r.sefaz.autoridade,
    orgao: r.sefaz.nomeOficial || r.sefaz.nomeOrgao,
    cadastro: r.sefaz.cadastroEstadual,
    sistema: r.sefaz.sistemaCreditoAcumulado,
    portal: r.sefaz.portalProcessos,
    procuracao: r.procuracao,
    utilizacao: r.utilizacao,
  });
});

export default router;
