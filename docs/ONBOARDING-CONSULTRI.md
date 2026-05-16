# Onboarding CONSULTRI — Operação de Validação

**Para:** Tadeu + equipe CONSULTRI
**Plataforma:** TaxCredit Enterprise
**Objetivo:** Operar a plataforma com clientes reais para validar o fluxo de outorga de procurações, monitoramento de conformidade e formalização de pedidos de crédito acumulado em todos os estados de presença da CONSULTRI.

---

## 1. Conceito em 60 segundos

A plataforma cobre **3 trilhas integradas**:

1. **Procuração CONSULTRI** — emissão guiada da procuração eCAC com todos os 45 poderes pré-selecionados, cadastro automático no SERPRO (modo automático) ou auto-serviço guiado (modo manual). Outorga em ~2 min ao invés de 30+ min.
2. **Conformidade contínua** — uma vez outorgada, o sistema varre Caixa Postal eCAC, Situação Fiscal (SITFIS), DCTFWeb e marca alertas em dashboard. CONSULTRI vê 1 painel para todos os clientes em vez de logar em 50 contas.
3. **Formalização de Crédito Acumulado** — para cada cliente com saldo credor, o sistema gera petição, demonstrativo, checklist de documentos por UF e envia ao protocolo certo (e-CredAc/SP, SITRAM/CE, e-Fisco/PE, SARE/GO, SIAT-e/MA, e-Docs/ES e mais 7 estados em produção).

**Cobertura nacional hoje:** 8 UFs em produção (78% PIB) + 5 UFs com regras detalhadas prontas (PE, CE, MA, ES, GO — 11% PIB) → **13 UFs prontas, 14 mapeadas para próximas ondas**.

---

## 2. Setup inicial (faz uma vez, dura para sempre)

### 2.1. Conta administradora CONSULTRI

A conta `tadeu@consultri.com.br` (ou outra que você escolher) deve ter **role = `admin`**. Para criar:

1. Acesse `/cadastro` e crie a conta normalmente (papel inicial = `user`).
2. Peça à equipe técnica para promover a conta:
   ```sql
   UPDATE "User" SET role = 'admin' WHERE email = 'tadeu@consultri.com.br';
   ```
3. Faça login. O menu deve mostrar `/admin/dashboard`, `/admin/clientes`, `/admin/producao/*`.

### 2.2. SerproConnection (uma vez)

Em `/admin/producao/integracoes` cadastrar:
- **CNPJ CONSULTRI** (procurador master)
- `consumerKey` e `consumerSecret` do contrato SERPRO (ambiente `trial` para testes, `production` quando liberar)
- Status passa para `pending` → `connected` ao primeiro health-check.

> **Dica:** se o contrato SERPRO atual ainda não suporta `AUTENTICAPROCURADOR41`, use o widget **Teste de Capability** em `/consultri/configuracoes` para descobrir em 1 clique. Se não suportar, o sistema continua operando em **modo manual** (cliente recebe link mágico e outorga sozinho em 2 min).

### 2.3. Procuradores adicionais (multi-procurador)

Em `/admin/producao/seguranca` ou via API `POST /api/consultri/procuradores`:
- `consultri-rio` (CNPJ filial RJ, se houver)
- `escritorio-tadeu-advogados` (CNPJ do escritório de advocacia)
- `bdo-paulista` (parceiro contábil)

Cada procurador pode ter um **perfil de poderes diferente** — útil para clientes que querem dar acesso restrito ao escritório (só assinar petições) e completo à CONSULTRI (operar tudo).

---

## 3. Primeiros 5 clientes (Wave 0)

Recomendo escolher 5 clientes que a CONSULTRI já conhece para validação em paralelo:

| # | Tipo | UF | Cenário ideal |
|---|------|----|---------------|
| 1 | Industrial exportadora | PE ou CE | Crédito acumulado de exportação (LC 87/96) |
| 2 | Comércio atacadista | RJ ou SP | Saldo credor de ICMS-ST |
| 3 | Distribuidora | MG | DCA-ICMS via SIARE |
| 4 | Frigorífico | MT | PAC-e/RUC-e |
| 5 | Construtora | BA ou GO | Diferimento + transferência terceiros |

Para cada cliente:

### 3.1. Cadastrar cliente
`/admin/clientes` → **Novo cliente**. Preencher CNPJ, razão social, IE, endereço completo (cidade + UF são críticos: o sistema usa para rotear automaticamente para a SEFAZ correta).

### 3.2. Emitir procuração
`/admin/clientes/[id]/procuracao` → **Emitir CONSULTRI Preset**. O sistema:
1. Carrega os 45 poderes pré-aprovados
2. Define validade (1 ano default, configurável)
3. Gera o link mágico de outorga (válido por 7 dias)
4. Envia o link por email + WhatsApp para o cliente

### 3.3. Cliente outorga
O cliente abre o link, vê:
- Identificação clara da CONSULTRI como procurador
- Lista expandível dos 45 poderes
- Botão único: **Outorgar agora**

Se o contrato SERPRO suportar `AUTENTICAPROCURADOR41`, a procuração já entra como `active` em segundos. Caso contrário, o sistema gera um **guia visual passo-a-passo** que o cliente segue no eCAC dele (screenshots reais, não texto). Tempo médio observado: **2 min**.

### 3.4. Conformidade automática
Em ~5 min após a outorga ativa, o painel `/admin/dashboard` começa a mostrar:
- **Caixa Postal**: número de mensagens não lidas
- **SITFIS**: pendências fiscais
- **DCTFWeb**: atrasos
- **Score**: 0–100 (verde > 80, amarelo 60–80, vermelho < 60)

A varredura roda automaticamente todo dia às 06h via scheduler.

### 3.5. Formalização (quando faz sentido)
Para clientes com saldo credor, em `/admin/producao/formalizacao`:
1. Selecionar cliente + UF
2. Plataforma carrega o **checklist específico daquela UF** (ex: `PE-01` a `PE-15` para Pernambuco)
3. Marcar documentos já obtidos
4. Clicar **Gerar petição** — sai o requerimento com fundamentação RICMS correta + demonstrativo + lista de anexos
5. Protocolar no portal correto (e-Fisco/SITRAM/SIAT-e/SARE/e-Docs/e-CredAc/SEI-RJ/SIARE/SISCRED/SAT/DT-e/PAC-e — sistema te diz qual)

---

## 4. Métricas para acompanhar (semanais)

| Métrica | Onde | Saudável |
|---------|------|----------|
| Procurações ativas | `/admin/dashboard` | ≥ 80% das emitidas |
| Score médio carteira | `/consultri/conformidade` | ≥ 75 |
| Tempo médio outorga | `/admin/producao/seguranca` | ≤ 5 min |
| Taxa de outorga (link enviado → ativo) | `/admin/clientes` | ≥ 70% em 48h |
| Petições geradas/protocoladas | `/admin/producao/formalizacao` | conforme pipeline |

---

## 5. Suporte e troubleshooting

| Problema | Onde olhar | Quem resolve |
|----------|-----------|--------------|
| Link mágico expirou | `/admin/clientes/[id]/procuracao` → reenviar | CONSULTRI |
| SERPRO retornando erro | `/admin/producao/integracoes` → status connection | Equipe técnica |
| Cliente não recebe email | `/admin/producao/notificacoes` → fila | Equipe técnica |
| Score caiu de repente | `/consultri/cliente/[id]/timeline` → ver causa | CONSULTRI + cliente |
| UF que ainda não está em produção | Solicitar prioridade | Equipe técnica (entra na próxima onda do StateRulesEngine) |

---

## 6. Próximas ondas (alinhado com força CONSULTRI)

**Onda 1 (já mapeada — 2-4 semanas para entrar em produção):**
PE, CE, MA, ES, GO → 5 UFs com regras completas no `state-rules.config.ts` (autoridade, RICMS, hipóteses, utilização, procuração detalhada). Faltam só os adapters de protocolo automatizado (RPA/portal).

**Onda 2 (mapeada, dados básicos):**
DF, MS, AM, PA → tier B (portal + RPA), priorizadas pelo PIB.

**Onda 3 (backlog menor):**
AL, SE, RN, PB, PI, RO, RR, AP, AC, TO → tier C (manual/upload) inicialmente, podem evoluir para B sob demanda.

> **Adicionar uma nova UF** = 1 entrada em `src/config/state-rules.config.ts` + 1 entrada em `frontend/src/data/checklists.ts`. Sem refactor de lógica.

---

## 7. Contato

- **Suporte técnico:** equipe TaxCredit Enterprise
- **Roadmap & priorização:** Tadeu (CONSULTRI) decide ordem das ondas
- **Documentação completa:** `docs/FRAMEWORK_LEGAL_SEFAZ_DCOMP.md`, `scripts/DEMO-CONSULTRI.md`

---

**Boa operação. Bora destravar crédito acumulado em escala nacional.**
