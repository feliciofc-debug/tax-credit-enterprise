# Deploy e Cron — Variáveis de ambiente

## Render (API)

Após o deploy, adicione no **Render Dashboard** → seu serviço → **Environment**:

| Variável | Valor |
|----------|-------|
| `JURISPRUDENCIA_VARREDURA_CRON_ENABLED` | `true` |

Isso ativa a varredura automática de jurisprudência **diariamente às 6h** (America/Sao_Paulo).

---

## API Conformidade Fácil (Reforma Tributária)

1. **Secret Files:** Adicione o certificado `.pfx` (e-CNPJ A1) com nome `certificado-conformidade.pfx`
2. **Environment Variables:** `CONFORMIDADE_FACIL_CERT_PASSWORD` = senha do .pfx
3. Se usou outro nome no Secret File, adicione: `CONFORMIDADE_FACIL_CERT_PATH` = `/etc/secrets/seu_arquivo.pfx`

Endpoints (admin): `/api/conformidade-facil/status`, `/class-trib`, `/cred-presumido`, `/anexos`, `/ind-oper`

---

## Vercel (Frontend)

Nenhuma variável adicional necessária para a página de Jurisprudência.
