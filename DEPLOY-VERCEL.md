# Deploy no Vercel — Configuração obrigatória

O frontend Next.js está na pasta `frontend/`. **O deploy falha se o Root Directory não estiver correto.**

## Correção do deploy que falha

1. Acesse **vercel.com** → seu projeto (hpc.taxcreditenterprise.com)
2. Vá em **Settings** → **General**
3. Em **Root Directory**, clique em **Edit**
4. Digite: `frontend`
5. Clique em **Save**
6. Vá em **Deployments** → **Redeploy** no último deploy

## Variáveis de ambiente

Em **Settings** → **Environment Variables**:

- `NEXT_PUBLIC_API_URL` = URL da API (ex: `https://taxcredit-api.onrender.com`)
