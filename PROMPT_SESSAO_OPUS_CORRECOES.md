# SESSÃO DE ANÁLISE — Correções Aplicadas na Plataforma TaxCredit Enterprise

**Data:** 10/02/2026  
**Contexto:** Sessão de trabalho para corrigir problemas identificados na análise de viabilidade tributária com IA.

---

## RESUMO DA SITUAÇÃO

A plataforma TaxCredit Enterprise está em produção em `taxcreditenterprise.com` (Vercel) com API em `taxcredit-api.onrender.com` (Render). O sistema usa Claude AI para análise de documentos contábeis (DRE, Balanço, Balancete) e identificação de oportunidades de recuperação de créditos tributários.

### PROBLEMAS ENCONTRADOS E CORRIGIDOS

---

### PROBLEMA 1: Modelo Claude Opus 4.5 não existia (404)

**Erro:** O código usava `claude-opus-4-5-20250929` que retornava 404 — esse model ID não existe.

**Correção:** Atualizado para `claude-opus-4-6` (modelo correto e mais recente).

**Estado atual:**
```typescript
const MODELS = {
  ANALYSIS: 'claude-opus-4-6',           // Análise tributária profunda
  DOCUMENTS: 'claude-sonnet-4-5-20250929', // Geração de documentos
  QUICK: 'claude-sonnet-4-5-20250929',     // Quick score (pré-triagem)
};
```

---

### PROBLEMA 2: Análises com valores absurdamente inflados

**O que aconteceu:** A IA foi testada com documentos da MetalForte Indústria (empresa real de teste) e produziu 3 análises com valores completamente diferentes e irreais:

| Análise | Score | Crédito Estimado | Problema |
|---------|-------|-----------------|----------|
| 1ª | 82 | R$ 24.820.000 | ~25% da receita — ABSURDO |
| 2ª | 82 | R$ 9.640.000 | Razoável, mas inconsistente |
| 3ª | 72 | R$ 8.245.570 | Mais realista |

**Dados reais da empresa (2024):**
- Receita Bruta: R$ 100.470.000 (o DRE e Balanço estão "Em milhares de Reais - R$ mil")
- Balancete está "Em Reais - R$" (valores cheios)
- Lucro Líquido: R$ 2.717.880
- ICMS sobre vendas: R$ 16.580.000
- PIS: R$ 1.657.000 / COFINS: R$ 7.634.000
- Crédito realista estimado (PIS/COFINS sobre ICMS, Tema 69 STF, 5 anos): **~R$ 7-8M máximo**

**Causa raiz identificada:**
1. **Confusão de unidades monetárias** — Balancete em "R$" e DRE/Balanço em "R$ mil". A IA multiplicava valores já convertidos.
2. **Falta de determinismo** — Sem `temperature: 0`, mesmos dados geravam resultados completamente diferentes.
3. **Prompts sem guardrails** — Não havia regras de conservadorismo nem validação de sanidade.

**Correções aplicadas:**

1. **`temperature: 0`** em TODAS as chamadas ao Claude — garante resultados determinísticos.

2. **Aviso explícito sobre unidades** adicionado em TODOS os prompts e na mensagem do usuário:
```
ATENÇÃO SOBRE UNIDADES: Verifique CUIDADOSAMENTE se os valores estão em "R$" (reais cheios) 
ou "R$ mil" / "em milhares de Reais". NÃO multiplique por 1.000 novamente.
```

3. **Regras de conservadorismo** nos 3 prompts (DRE, Balanço, Balancete):
```
- Créditos recuperáveis RARAMENTE ultrapassam 5-10% da receita bruta
- Para empresa com receita de R$ 100M, crédito REALISTA: R$ 2M-8M
- Se cálculo > 15% da receita bruta, REVISE — provavelmente erro de unidade
- Somente incluir oportunidades com fundamentação legal SÓLIDA
```

4. **Validação de sanidade** no parseamento da resposta JSON:
- Recalcula o total a partir da soma das oportunidades individuais (evita total inventado)
- Alerta se oportunidade individual > R$ 50M (provável erro de unidade)
- Logs de warning para valores suspeitos

5. **Quick score (Sonnet 4.5)** com prompt muito mais conservador:
- NÃO estima valores monetários
- Score focado em probabilidade qualitativa, não em valor
- Escala mais rígida: >80 apenas com evidências claras

---

### PROBLEMA 3: Crash no frontend (client-side exception)

**O que aconteceu:** A página `/admin/producao/viabilidade` dava "Application error: a client-side exception has occurred."

**Causa:** O quick score retorna `{score, summary, viable, nextSteps}` mas o frontend tentava acessar `result.opportunities.length` e `result.risks.length` que não existiam — causando TypeError.

**Correção:** Todos os campos opcionais agora usam optional chaining (`?.length || 0`) e a interface TypeScript foi atualizada para aceitar campos opcionais.

---

### PROBLEMA 4: Render Free Tier + Opus 4.6

**Situação:** Opus 4.6 leva ~2 minutos para análise profunda. Render free tier tem timeout de 30s.

**Solução acordada:** Upgrade para Render Starter ($7/mês) que tem timeout de 5 minutos.

**Arquitetura de modelos:**
- **Quick Score (gratuito para parceiro):** Sonnet 4.5 — rápido (~5s), retorna score + resumo, SEM valores monetários
- **Análise Completa (requer pagamento + contrato):** Opus 4.6 — profundo (~2min), retorna oportunidades detalhadas com valores

---

## ARQUITETURA ATUAL DOS FLUXOS

### Fluxo 1: Quick Score (Parceiro faz livremente)
```
Parceiro → Upload DRE/Balanço/Balancete → Sonnet 4.5 → Score (0-100) + Resumo
Sem custo. Sem contrato. Apenas triagem rápida.
```

### Fluxo 2: Consulta Completa (Requer 4 condições)
```
1. Contrato 3 partes assinado (parceiro + plataforma + cliente)
2. Taxa de adesão paga (R$ 2.000)
3. Documentos enviados pelo CLIENTE na plataforma
4. Contrato assinado pelo CLIENTE

Opus 4.6 → Análise profunda → Oportunidades + Valores + Fundamentação Legal + Parecer
```

---

## PERGUNTAS PARA ANÁLISE

1. **Os prompts estão suficientemente conservadores?** Os guardrails de 5-10% da receita bruta são realistas para a maioria das empresas?

2. **A validação de sanidade no parse é robusta o suficiente?** Existe algum edge case que pode passar valores inflados?

3. **O split de modelos (Sonnet para quick, Opus para full) faz sentido?** Ou deveria usar Opus para tudo?

4. **Há alguma melhoria nos prompts tributários?** Os prompts de DRE, Balanço e Balancete cobrem todas as oportunidades comuns (Tema 69, insumos PIS/COFINS, ICMS-ST, CIAP, etc.)?

---

## ARQUIVOS MODIFICADOS NESTA SESSÃO

| Arquivo | O que mudou |
|---------|------------|
| `src/services/claude.service.ts` | Modelo → Opus 4.6, temperature 0, prompts conservadores, validação de sanidade |
| `frontend/src/app/(admin)/admin/producao/viabilidade/page.tsx` | Fix crash: campos opcionais, nextSteps |
| `frontend/src/app/(admin)/admin/dashboard/page.tsx` | estimatedCredit null-safe |
| `frontend/src/app/(partner)/parceiro/viabilidade/page.tsx` | estimatedCredit null-safe |
