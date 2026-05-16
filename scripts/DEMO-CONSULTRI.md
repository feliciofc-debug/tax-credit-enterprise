# Roteiro de Demo CONSULTRI

Guia executivo para demonstrar a plataforma ao Tadeu (CONSULTRI) e gerar screenshots para envio assíncrono.

---

## 0. Pré-requisitos (5 min, uma vez só)

### 0.1. Subir o banco de dados

**Opção A — Docker (recomendada)**
```bash
docker run -d --name tax-pg \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=taxcredit \
  -p 5432:5432 \
  postgres:16
```

**Opção B — PostgreSQL nativo Windows**

Instalar PostgreSQL 16+, criar database `taxcredit`, usuário `postgres`, senha `password`. Confirmar que `.env` tem:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/taxcredit"
```

### 0.2. Aplicar as 5 migrações CONSULTRI

```bash
npx prisma migrate deploy
npx prisma generate
```

### 0.3. Popular dados de demonstração

```bash
npm run seed:consultri
```

O seed cria:
- 10 clientes fictícios (Alfa → Kappa) em cenários variados (active, expiring 30d, expiring 7d, partial, pending, not_found, risk_caixa, risk_sitfis)
- Procurações vinculadas em todos os estados de `serproStatus`
- Audit logs simulados (created → invite_sent → serpro_active)
- Snapshots de conformidade (scores 25-95)
- Notificações de exemplo (alguns lidos, alguns críticos não-lidos)
- 1 SerproConnection dummy (modo trial)
- ProcuradorEntity "CONSULTRI Holding" como procurador padrão

### 0.4. Subir backend + frontend

```bash
# Terminal 1
npm run dev

# Terminal 2
cd frontend && npm run dev
```

Acessar `http://localhost:3000`.

---

## 1. Roteiro de Apresentação (15-20 min com Tadeu)

### Sequência sugerida — narrativa do "Antes vs Depois"

#### 🎬 Abertura: o problema (2 min)
**URL:** `http://localhost:3000/consultri`
**Slide:** 14a (Capa CONSULTRI)

> "Tadeu, o que você me mandou era um PDF de 8 passos manuais que cada cliente seu tem que fazer para outorgar a procuração eletrônica. Vou te mostrar o que a gente construiu pra essa dor — comecei sábado de manhã, são umas 15 horas de trabalho focado."

**Avançar slides 14b → 14n** (Page Down ou seta direita) — usar como narrativa de fundo enquanto navega nas telas reais.

---

#### 🎬 Bloco 1: Carteira inteira na sua mão (3 min)
**URL:** `http://localhost:3000/consultri/carteira`

**O que mostrar:**
- Stats no topo (total, ativas, parciais, pendentes, vencendo)
- Filtro por procurador no dropdown
- Cada linha: cliente + status SERPRO + dias até vencer + última verificação
- Botão "Verificar SERPRO" em qualquer linha
- Botão "📊 Coleta" leva pra coleta federal daquele cliente
- "+ Nova procuração" usa CONSULTRI_PRESET com 45 poderes pré-configurados

📸 **Screenshot 1:** Carteira inteira com 10 clientes em estados diferentes.

---

#### 🎬 Bloco 2: Detalhe do cliente + modo híbrido (3 min)
**URL:** Clicar em qualquer cliente → `/consultri/cliente/[id]/procuracao`

**O que mostrar:**
- Status SERPRO + validade + última check
- **Checklist visual de poderes** (45 concedidos / 0 faltando ou parcial)
- **Bloco "Modo Híbrido"** com 2 cards: Auto SERPRO vs Convite Manual
- Botões: 🗓️ Timeline, 📊 Coleta Federal, 📄 Relatório PDF, 📨 Enviar convite, Renew

📸 **Screenshot 2:** Página de detalhe com modo híbrido.

---

#### 🎬 Bloco 3: Convite mágico (cliente sem painel) (2 min)
Clicar em "📨 Enviar convite" → modal → preencher email/telefone → enviar.

**URL pública (que o cliente final recebe):** `http://localhost:3000/outorga/[token]`

**O que mostrar:**
- Wizard de 8 passos guiados (espelha o PDF da CONSULTRI)
- Procurador CNPJ destacado pra copiar
- Checklist dos 45 poderes
- Botão "Concluído" notifica a plataforma → poll detecta em 15min

📸 **Screenshot 3:** Landing pública pro cliente final.

---

#### 🎬 Bloco 4: Coleta Federal em 1 tela (3 min)
**URL:** `/consultri/cliente/[id]/coleta`

**O que mostrar:**
- 7 tabs: PER/DCOMP, DCTF, DIRF, Fontes Pagadoras, Parcelamentos, Caixa Postal, 🔬 Análise Cruzada
- Cada tab consome um endpoint SERPRO real (Integra Contador)
- **Demonstrar Análise Cruzada DIRF × Fontes:**
  - Clicar em "Rodar análise cruzada"
  - Score de risco 0-100 colorido (verde/amarelo/vermelho)
  - Lista de divergências classificadas por severidade
  - Sugestões de teses tributárias automáticas

📸 **Screenshot 4:** Aba de Análise Cruzada com divergências e teses.

---

#### 🎬 Bloco 5: Conformidade da Carteira (2 min)
**URL:** `/consultri/conformidade`

**O que mostrar:**
- Stats: total monitorados, clientes com mensagem nova, com pendência fiscal, score médio
- Top 5 em risco (menor score primeiro)
- Tabela completa com filtros + ordenação
- Botão "Coletar agora" dispara o job manualmente
- Filtro por procurador (multi-procurador em ação)

📸 **Screenshot 5:** Conformidade com Top 5 e alertas.

---

#### 🎬 Bloco 6: Timeline consolidada do cliente (2 min)
**URL:** `/consultri/cliente/[id]/timeline`

**O que mostrar:**
- Linha do tempo unificada: procurações + audits + convites + notificações + snapshots
- Cores por severidade (info/warning/critical)
- Filtros: Tudo / Críticos / Auditoria / Notificações
- Deep-link em cada evento

📸 **Screenshot 6:** Timeline cronológica.

---

#### 🎬 Bloco 7: Métricas comerciais + Executive PDF (3 min)
**URL:** `/consultri/metricas`

**O que mostrar:**
- 4 KPI hero cards: Taxa de Ativação, Tempo Médio Outorga, Conclusão Convites, Vencendo 30d
- Distribuição por modo de outorga (gráfico de barras)
- Funil de convites (4 etapas)
- Notificações 24h por canal
- Engajamento Caixa Postal
- **Clicar em "📄 Executive PDF"** → abre relatório consolidado da carteira inteira em nova aba
- Ctrl+P → "Salvar como PDF" → entregar pro Tadeu

📸 **Screenshot 7:** Dashboard de métricas.
📸 **Screenshot 8:** Executive Summary PDF aberto.

---

#### 🎬 Bloco 8: Hub de Notificações (1 min)
**URL:** `/consultri/notificacoes`

**O que mostrar:**
- Bell icon no header com badge vermelho (pulsando se tiver crítico)
- Lista completa: e-mail, WhatsApp, in-app, webhook
- Filtros: não-lidas / críticas / por canal
- Marca como lida individual ou em lote

📸 **Screenshot 9:** Hub central.

---

#### 🎬 Bloco 9: Configuração da operação (2 min)
**URL:** `/consultri/configuracoes`

**O que mostrar:**
- Upload do certificado A1 da CONSULTRI (PFX + senha)
- Consumer Key/Secret SERPRO
- **Capability Widget:** botão "Testar capability AUTENTICAPROCURADOR" → mostra ✓ DISPONÍVEL ou ✗ INDISPONÍVEL
- 4 botões de jobs manuais: poll SERPRO, alertas, conformidade, **renovação preventiva híbrida**
- Log em tempo real de cada execução

📸 **Screenshot 10:** Configurações.

---

#### 🎬 Bloco 10: Multi-procurador (1 min)
**URL:** `/consultri/procuradores`

**O que mostrar:**
- CRUD: cadastrar Holding, Filial, parceiros
- Cor visual por procurador
- Contador de procurações vinculadas
- Soft-delete preserva auditoria

📸 **Screenshot 11:** Multi-procurador.

---

## 2. Script de fala curta (para mandar áudio pro Tadeu)

> "Tadeu, montei uma plataforma completa pro que você me mandou. O cliente da Consultri agora pode receber um link mágico, em 8 passos guiados outorga a procuração com os 45 poderes exatos do seu PDF. A plataforma verifica via SERPRO a cada 15 minutos se ficou ativa, manda alerta 60/30/7 dias antes de vencer, e 60 dias antes do vencimento já cria a renovação automática — tentando programaticamente via SERPRO se você tiver o contrato AUTENTICAPROCURADOR, ou disparando convite manual se não. Tudo com timeline visual, hub central de notificações, dashboard de conformidade da carteira inteira, e métricas comerciais. Bônus: tem um detector de teses tributárias que cruza DIRF declarada com Fontes Pagadoras de terceiros e gera relatório de divergências em PDF. Cada cliente tem um relatório consolidado em PDF que você pode entregar. Multi-procurador permite atender via Holding e Filial separadamente. Bora marcar uma call pra você ver?"

---

## 3. URLs em ordem para screenshots rápidos

```
1.  http://localhost:3000/consultri                                      → deck (slide 14a)
2.  http://localhost:3000/consultri/carteira                             → carteira completa
3.  http://localhost:3000/consultri/cliente/<id-procuracao>/procuracao   → detalhe
4.  http://localhost:3000/outorga/<token>                                → landing pública
5.  http://localhost:3000/consultri/cliente/<id-procuracao>/coleta       → coleta + análise
6.  http://localhost:3000/consultri/conformidade                         → dashboard
7.  http://localhost:3000/consultri/cliente/<id-procuracao>/timeline     → timeline
8.  http://localhost:3000/consultri/metricas                             → métricas
9.  http://localhost:3000/api/consultri/executive-summary                → Executive PDF (Ctrl+P)
10. http://localhost:3000/consultri/notificacoes                         → hub
11. http://localhost:3000/consultri/configuracoes                        → config
12. http://localhost:3000/consultri/procuradores                         → multi-proc
```

> Após o `seed:consultri` o terminal imprime os IDs das procurações criadas — use o primeiro pra navegar nos detalhes.

---

## 4. Dicas para screenshots de alto impacto

- **Resolução:** 1440x900 ou maior, navegador limpo (sem extensões visíveis)
- **Sequência narrativa:** primeiro carteira (visão macro), depois drill-down em 1 cliente
- **Demonstrar movimento:** GIF curto do bell icon piscando quando chega notificação
- **Destacar números:** rolar o seed pra ter dados realistas (não vazios)
- **PDFs em destaque:** o Executive Summary é o que mais impressiona em apresentação executiva — abra ele em modo "Apresentação" do navegador
