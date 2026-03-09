# Como rodar a migração — Guia passo a passo

Você tem **duas opções**. A **Opção 1** é mais simples (só copiar e colar no Supabase).

---

## OPÇÃO 1 — Pelo Supabase (mais fácil)

### Passo 1: Abrir o Supabase

1. Acesse: **https://supabase.com/dashboard**
2. Faça login na sua conta
3. Clique no **projeto** da TaxCredit (o que você usa para essa plataforma)

### Passo 2: Abrir o SQL Editor

1. No menu da esquerda, clique em **"SQL Editor"**
2. Clique no botão **"New query"** (Nova consulta)

### Passo 3: Colar o código

**Migração 1 — TeseJurisprudencia** (se ainda não rodou):
1. Abra: `prisma\migrations\20260224_add_tese_jurisprudencia\migration.sql`

**Migração 2 — ViabilityAnalysis** (se o dashboard der HTTP 500):
1. Cole e execute no Supabase:
   ```sql
   ALTER TABLE "ViabilityAnalysis" ADD COLUMN IF NOT EXISTS "authorizedByNames" TEXT;
   ALTER TABLE "ViabilityAnalysis" ADD COLUMN IF NOT EXISTS "authorizedByCargos" TEXT;
   ALTER TABLE "ViabilityAnalysis" ADD COLUMN IF NOT EXISTS "interviewData" TEXT;
   ALTER TABLE "ViabilityAnalysis" ADD COLUMN IF NOT EXISTS "dataSources" TEXT;
   ```

2. Para a migração 1, abra o arquivo no seu computador:
   ```
   C:\Users\usuario\tax-credit-enterprise\prisma\migrations\20260224_add_tese_jurisprudencia\migration.sql
   ```
2. Ou abra esse arquivo no Cursor (Ctrl+P, digite `migration.sql`)
3. Selecione **todo** o conteúdo (Ctrl+A)
4. Copie (Ctrl+C)
5. Volte ao Supabase, no campo de texto grande
6. Cole o código (Ctrl+V)

### Passo 4: Executar

1. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
2. Se aparecer "Success" ou algo como "Query executed successfully", está pronto

---

## OPÇÃO 2 — Pelo terminal (com .env configurado)

### Passo 1: Pegar as URLs do Supabase

1. Acesse: **https://supabase.com/dashboard**
2. Clique no seu projeto
3. Vá em **Settings** (ícone de engrenagem) → **Database**
4. Role até **"Connection string"**
5. Escolha **"URI"** e copie a URL (algo como `postgresql://postgres.xxx:senha@...`)
6. Para **DIRECT_URL**, use a mesma URL mas troque a porta `6543` por `5432` (se tiver pooler)

### Passo 2: Colar no arquivo .env

1. Abra o arquivo `.env` na pasta do projeto (em `C:\Users\usuario\tax-credit-enterprise`)
2. Encontre as linhas:
   ```
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."
   ```
3. Substitua pelos valores que você copiou do Supabase (com a senha correta)

### Passo 3: Rodar no terminal

1. No Cursor, abra o terminal: **Ctrl + `** (tecla ao lado do 1)
2. Digite exatamente:
   ```
   node node_modules\prisma\build\index.js migrate deploy
   ```
3. Pressione Enter
4. Se aparecer "Applied migration...", está pronto

---

## Se der erro

- **"relation already exists"** → A tabela já existe, pode ignorar
- **"Can't reach database"** → Verifique se DATABASE_URL e DIRECT_URL estão corretos no .env
- **"permission denied"** → A conta do Supabase pode não ter permissão; use a Opção 1

---

## Link direto do Supabase

- Dashboard: https://supabase.com/dashboard
- Documentação de conexão: https://supabase.com/docs/guides/database/connecting-to-postgres
