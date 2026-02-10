# PROMPT DE DIAGNÓSTICO — TaxCredit Enterprise SaaS

## CONTEXTO: O QUE É O PROJETO

Plataforma SaaS de recuperação de créditos tributários com IA. Parceiros (escritórios de advocacia/contabilidade) fazem upload de documentos contábeis (DRE, Balanço, Balancete) de seus clientes, e a IA analisa e identifica oportunidades de recuperação tributária (PIS, COFINS, ICMS, IRPJ, CSLL, ISS).

## STACK TÉCNICA

### Backend (Node.js + Express + TypeScript)
- **Runtime**: Node.js 18+, TypeScript compilado para `dist/` via `tsc`
- **Framework**: Express.js com Helmet, CORS, express-rate-limit
- **ORM**: Prisma com PostgreSQL (Supabase)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **File Processing**: `pdf-parse` (PDF), `xlsx` (Excel), OCR.space API (imagens/PDFs escaneados)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Email**: Resend API (fetch direto, sem SDK)
- **Upload**: Multer com memoryStorage (buffer, não salva em disco)
- **Logs**: Winston (JSON em produção, console colorido em dev)
- **Deploy**: Render.com (free tier atualmente, migrando para Starter $7/mês)

### Frontend (Next.js)
- **Framework**: Next.js (App Router) + React + TypeScript + Tailwind CSS
- **Deploy**: Vercel
- **Domínio**: taxcreditenterprise.com
- **API Proxy**: Next.js rewrites `/api/*` → backend Render

### Infraestrutura
- **Backend URL**: https://taxcredit-api.onrender.com
- **Frontend URL**: https://taxcreditenterprise.com
- **Database**: PostgreSQL no Supabase
- **DNS**: Umbler
- **Email**: Resend (domínio verificado: send.taxcreditenterprise.com)

## ESTRUTURA DE ARQUIVOS DO BACKEND

```
src/
├── index.ts                          # Entry point Express
├── middleware/
│   ├── auth.ts                       # JWT authenticateToken middleware
│   └── errorHandler.ts               # Error handler global
├── routes/
│   ├── auth.routes.ts                # Login unificado (detecta role)
│   ├── admin.routes.ts               # Rotas admin (criar admin)
│   ├── partner.routes.ts             # CRUD parceiros
│   ├── viability.routes.ts           # ⭐ Upload docs + análise IA
│   ├── invite.routes.ts              # Convites para clientes
│   ├── contract.routes.ts            # Contratos 3 partes
│   ├── tax-credit.routes.ts          # Processos tributários
│   ├── batch.routes.ts               # Processamento em lote
│   ├── dashboard.routes.ts           # Dashboard stats
│   └── profile.routes.ts             # Perfil do usuário
├── services/
│   ├── claude.service.ts             # ⭐ Integração Claude AI
│   ├── documentProcessor.service.ts  # ⭐ Processador de documentos
│   ├── ocr-space.service.ts          # OCR.space para PDFs escaneados
│   ├── email.service.ts              # Envio de emails via Resend
│   └── tax-credit-documentation.service.ts # Geração de docs jurídicos
├── utils/
│   ├── logger.ts                     # Winston logger
│   ├── prisma.ts                     # Prisma client singleton
│   └── operator.ts                   # Platform partner para admin
└── worker.ts                         # Worker placeholder (Bull/Redis mock)
```

## FLUXO DA ANÁLISE DE VIABILIDADE (o que está falhando)

### Fluxo esperado:
1. Admin/Parceiro preenche formulário: empresa, CNPJ, regime, setor, faturamento
2. Faz upload de 1-10 PDFs (DRE, Balanço, Balancete)
3. Frontend envia POST `/api/viability/analyze` com multipart/form-data
4. Backend recebe arquivos via Multer (memoryStorage)
5. `documentProcessor.processDocument()` extrai texto de cada PDF
6. Textos são concatenados
7. `claudeService.analyzeDocument()` envia para Claude API
8. Claude retorna JSON com oportunidades tributárias
9. Resultado é salvo no banco (ViabilityAnalysis) e retornado ao frontend

### Arquivo: src/services/claude.service.ts
```typescript
const MODELS = {
  ANALYSIS: 'claude-sonnet-4-5-20250929',     // Para análise em tempo real
  DOCUMENTS: 'claude-sonnet-4-5-20250929',     // Para geração de documentos
  DEEP_ANALYSIS: 'claude-opus-4-6',            // Reservado para futuro
} as const;
```
- Usa prompts especializados por tipo (DRE, Balanço, Balancete)
- max_tokens: 16384
- Smart truncation: 60% início + 35% fim do documento
- JSON parser robusto com reparo de JSON truncado
- Sem fallback fake — retorna erro real

### Arquivo: src/services/documentProcessor.service.ts
- Detecta tipo de arquivo (PDF, Excel, Image, Text)
- PDF: tenta pdf-parse nativo, fallback para OCR.space
- Avalia qualidade do texto: high/medium/low
- Extrai metadados: CNPJ, período, nome da empresa

### Arquivo: src/routes/viability.routes.ts
- POST `/analyze`: recebe docs, processa, analisa com Claude
- Multer com memoryStorage e fileFilter (documentProcessor.isSupported)
- Cria registro ViabilityAnalysis no banco antes da análise
- Atualiza com resultado ou marca como 'failed'

## PROBLEMAS ENCONTRADOS (CRONOLOGIA)

### 1. Modelo errado (RESOLVIDO no código)
- Código original usava `claude-opus-4-5-20250929` — modelo que NÃO EXISTE
- Corrigido para `claude-sonnet-4-5-20250929` (e `claude-opus-4-6` como DEEP_ANALYSIS)
- O GitHub já tem o código correto

### 2. JSON truncado (RESOLVIDO no código)
- Opus 4.6 gerava respostas muito longas, max_tokens 8192 cortava o JSON
- Aumentado para 16384 + parser com reparo automático de JSON truncado
- O GitHub já tem o código correto

### 3. Trust proxy (RESOLVIDO no código)
- express-rate-limit lançava ValidationError no Render (proxy reverso)
- Adicionado `app.set('trust proxy', 1)` no index.ts
- O GitHub já tem o código correto

### 4. ⭐ PROBLEMA ATUAL: Deploy no Render não reflete o código do GitHub
**Este é o problema principal que precisa ser diagnosticado.**

Evidências dos logs do Render:
- Às 17:36 UTC: logs mostram `Iniciando análise com Opus 4.5` e erro `claude-opus-4-5-20250929` (código ANTIGO)
- Às 17:46 UTC: novo deploy, logs mostram `Iniciando análise com Opus 4.6` (código intermediário)
- Às 18:13 UTC: outro deploy, ainda `Opus 4.6` — mas o código no GitHub já tem `Sonnet 4.5`
- O Build Command do Render está correto: `npm install --include=dev && npx prisma generate && npm run build`
- O Start Command está correto: `npm start`
- Auto-Deploy: On Commit

Possíveis causas:
- Build cache do Render mantendo dist/ antigo
- Build falhando silenciosamente (TypeScript error?)
- O tsc compila de src/ para dist/, mas dist/ pode estar cached

### 5. Timeout do Render Free Tier
- Free tier: servidor dorme após 15min de inatividade
- Cold start: ~50 segundos
- Se análise IA leva 15-30 segundos + cold start = timeout 502
- Solução: migrar para Render Starter ($7/mês) — já decidido

### 6. Erros no console do frontend
- 500 em `/api/viability/analyze` — erro do backend
- 502 em `/api/viability/analyze` — Render cortou a conexão (timeout)
- "Erro de conexao" — frontend não consegue falar com backend

## O QUE JÁ FUNCIONA
- ✅ Login/autenticação (JWT)
- ✅ Dashboard
- ✅ Convites (email via Resend funcionando)
- ✅ Processamento de PDFs (pdf-parse extrai texto com qualidade "high")
- ✅ Domínio taxcreditenterprise.com (Vercel)
- ✅ API backend respondendo (health check OK)
- ✅ Database conectada (Supabase PostgreSQL)

## O QUE NÃO FUNCIONA
- ❌ Análise de viabilidade com IA (erro 500/502)
- ⚠️ Não confirmado se o último deploy do Render tem o código correto

## REPOSITÓRIO GITHUB
https://github.com/feliciofc-debug/tax-credit-enterprise

Branch: main
Último commit: `e7fb4cb` — "fix: add prisma generate to build command for Render compatibility"

## VARIÁVEIS DE AMBIENTE NO RENDER
- ANTHROPIC_API_KEY: configurada (chave real)
- RESEND_API_KEY: configurada
- FROM_EMAIL: TaxCredit Enterprise <noreply@send.taxcreditenterprise.com>
- FRONTEND_URL: https://taxcreditenterprise.com
- DATABASE_URL: configurada (Supabase)
- JWT_SECRET: ⚠️ log mostra warning "fraco ou não definido"
- NODE_ENV: production
- PORT: 10000

## DECISÃO: USAR OPUS 4.6 PARA ANÁLISE

O modelo de análise DEVE ser `claude-opus-4-6` (o mais inteligente). Sonnet 4.5 não é apropriado para análise tributária profunda.

O Render será atualizado para o plano Starter ($7/mês) que:
- Mantém o servidor sempre ligado (sem cold start)
- Tem timeout mais longo para requisições (suporta os ~2 minutos do Opus)
- Performance melhor

O código atual tem `claude-sonnet-4-5-20250929` como ANALYSIS (mudança temporária por causa do timeout do free tier). Precisa voltar para `claude-opus-4-6`.

## O QUE PRECISO QUE VOCÊ FAÇA

1. **Diagnosticar por que o deploy do Render não está refletindo o código mais recente do GitHub**
   - O build command está correto, mas os logs ainda mostram código antigo
   - Pode ser cache, pode ser erro no build que não aparece nos logs de runtime

2. **Verificar se há algum problema na rota de viability que cause 500 antes mesmo de chegar na IA**
   - Pode ser erro de Prisma, Multer, ou qualquer middleware

3. **Garantir que o Opus 4.6 funciona no Render Starter:**
   - Upload PDF → documentProcessor → claudeService (Opus 4.6) → resposta JSON → salvar → retornar
   - Opus leva ~2 minutos — o Render Starter suporta isso?
   - O frontend precisa de timeout mais longo no fetch?

4. **Sugerir melhorias de arquitetura se necessário:**
   - O frontend precisa mostrar loading/progress enquanto Opus processa?
   - Devemos implementar streaming da resposta?
   - Ou async processing com polling?

## CONTEXTO ADICIONAL
- O Render será Starter ($7/mês) — servidor sempre ligado, timeout mais generoso
- A plataforma é comercial — precisa funcionar de forma confiável
- O custo de IA é baixo (~R$ 5 por análise com Opus 4.6)
- O projeto usa TypeScript compilado (src/ → dist/ via tsc)
- O `dist/` está no .gitignore — Render precisa compilar via build command
