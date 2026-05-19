# Pull Request: hpc-integration → main

**Repositorio:** https://github.com/feliciofc-debug/tax-credit-enterprise
**Branch origem:** `hpc-integration`
**Branch destino:** `main`
**Total:** 16 commits

## Como abrir o PR

1. Clique no link de **Compare & Pull Request**:
   👉 https://github.com/feliciofc-debug/tax-credit-enterprise/compare/main...hpc-integration?expand=1

2. **Titulo sugerido:**
   ```
   StateRulesEngine + CONSULTRI + Shield: 27/27 UFs cobertas, deck atualizado, seguranca defensiva
   ```

3. **Descricao do PR** (cole o conteudo abaixo, ja formatado em markdown):

---

## Summary

Esta PR consolida 3 frentes que ficaram prontas em paralelo na branch `hpc-integration` e devem entrar juntas em `main`:

### 1. StateRulesEngine — cobertura nacional 27/27 UFs

- Engine canonico em `src/config/state-rules.config.ts` que substitui mapas hardcoded espalhados pelo backend (formalization, demonstrativo, compliance, procuration).
- **8 UFs em producao** (covered, tier A/B): SP, RJ, MG, RS, PR, SC, BA, MT — ~74% PIB
- **5 UFs Onda 1** (planned, tier B): PE, CE, MA, ES, GO — Nordeste forte da Consultri + ES/GO — +11% PIB
- **4 UFs Onda 2** (planned, tier B): DF, MS, AM, PA — inclui regimes especiais ZFM (AM), agroindustria (MS), exportacao mineral (PA) — +9% PIB
- **10 UFs Onda 3** (planned, tier C): AL, SE, RN, PB, PI, RO, RR, AP, AC, TO — template manual padronizado, RICMS local correto, protocolo presencial / e-mail institucional — +6% PIB
- **Resultado:** 27/27 UFs com regras ativas (~99.8% PIB), zero estado em "pendente". Adicionar nova UF = 1 entrada JSON, sem refactor.

### 2. CONSULTRI — plataforma de procuracoes em escala

- Schema + 5 migracoes (preset, automacao, hibrido, multi-procurador, notificacoes in-app)
- Backend completo (services + routes + scheduler + webhook SERPRO)
- Frontend (10 paginas + deck institucional + landing publica)
- Roteiro de demo + screenshots prontos para Tadeu
- Seed com 14 clientes ficticios cobrindo 12 UFs para demo multi-regional

### 3. Shield — seguranca defensiva

- Persistencia de eventos no banco + relatorio de ataques
- Forensic classification + escalation detector + auto-lockdown
- Defensive deception (honeypot ativo + canary tokens + tarpit)

### 4. UI/UX — pagina de cobertura nacional

- `/admin/sefaz/cobertura` ganhou **mapa do Brasil em tile-cartograma** (estilo FT/Bloomberg) — cada UF como bloco posicionado conforme geografia, colorido por status.
- Click no UF abre painel detalhado (autoridade, RICMS, sistema, procuracao).
- Mantem visao por regiao + tabela detalhada como visualizacoes alternativas.

### 5. Servicos enriquecidos

- `compliance.service` agora usa `hipoteses`, `utilizacao.limites` e `prazos` do engine para gerar pareceres ICMS contextualizados por UF (vs texto generico).
- `formalization.service` injeta hipoteses tipicas + modalidades de utilizacao + limites + prazos decadenciais nas peticoes geradas — output passa a ser juridicamente robusto, sem precisar de templates por estado.

## Test plan

- [x] `npx tsc --noEmit` zero erro (backend + frontend)
- [x] `npx tsx scripts/smoke-state-rules.ts` → **137/137 checks OK**
- [x] PIB total das 27 UFs = 99.8% (consistencia validada)
- [x] Zero lint errors (ReadLints em todos os arquivos modificados)
- [ ] Smoke manual: subir backend + frontend, verificar `/admin/sefaz/cobertura` (mapa de tiles + click)
- [ ] Smoke manual: rodar `npm run seed:consultri` em ambiente limpo e validar 14 clientes em 12 UFs
- [ ] Validar peticao gerada para PE, CE, MA usando `/admin/producao/formalizacao` (deve trazer hipoteses + limites + prazos do estado correto)
- [ ] Tadeu/Consultri valida fluxo completo com cliente real (Wave 0 — 5 clientes, conforme `docs/ONBOARDING-CONSULTRI.md`)

## Observacoes

- Branch `hpc-integration` foi mantida para historico - nao deletar imediatamente apos merge.
- Documentos de apoio: `docs/ONBOARDING-CONSULTRI.md`, `scripts/DEMO-CONSULTRI.md`, `docs/FRAMEWORK_LEGAL_SEFAZ_DCOMP.md`.
- Smoke test `scripts/smoke-state-rules.ts` pode entrar em CI pre-deploy (exit 0/1 padronizado).

---

## Commits incluidos (mais recentes primeiro)

```
7c19ed6 feat(ui): mapa do Brasil em tile-cartograma na pagina de cobertura SEFAZ
90e84ef feat(services): peticoes e alertas usam campos ricos do StateRulesEngine
00604f9 feat(sefaz): Onda 3 - 27/27 UFs com regras ativas no engine
10967d7 chore(consultri): atualiza deck, seed, smoke e onboarding com numeros da Onda 2
c040db6 feat(sefaz): Onda 2 do StateRulesEngine - DF, MS, AM, PA promovidas
ba2c32c chore: smoke test do StateRulesEngine + onboarding Consultri
39c3da4 feat(formalizacao): checklists das 4 UFs Nordeste/CO + seed multi-regional
34007bc feat(sefaz): regras detalhadas das 5 UFs planejadas (PE, CE, MA, ES, GO)
bc449d2 feat(sefaz): StateRulesEngine + mapa nacional de cobertura (27 UFs)
e60c7eb CONSULTRI: roteiro de demo + screenshots para apresentacao ao Tadeu
2f3489e CONSULTRI: scripts demo (seed) + build-pdf + deck HTML standalone
6b0f82c CONSULTRI: frontend completo (deck + 10 paginas + landing publica)
6d16e5f CONSULTRI: backend completo (services + routes + scheduler + webhook)
efd7676 CONSULTRI: schema + 5 migracoes (preset, automacao, hibrido, multi-procurador, notif in-app)
bd8ddf9 Shield: defensive deception (honeypot ativo + canary tokens + tarpit)
798907d Shield: forensic classification + escalation detector + auto-lockdown
```
