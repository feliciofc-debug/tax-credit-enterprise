# Deploy e Cron — Variáveis de ambiente

## Render (API)

Após o deploy, adicione no **Render Dashboard** → seu serviço → **Environment**:

| Variável | Valor |
|----------|-------|
| `JURISPRUDENCIA_VARREDURA_CRON_ENABLED` | `true` |

Isso ativa a varredura automática de jurisprudência **diariamente às 6h** (America/Sao_Paulo).

---

## Vercel (Frontend)

Nenhuma variável adicional necessária para a página de Jurisprudência.
