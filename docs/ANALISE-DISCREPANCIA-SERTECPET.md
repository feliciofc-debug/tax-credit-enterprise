# Análise da Discrepância — SERTECPET (Extrato 14 vs 15)

## Resumo

As duas análises usaram **SPEDs de períodos diferentes**. Por isso os valores divergem.

---

## Comparativo

| Item | Extrato HPC 14 (05/03) | Extrato 15 (09/03) |
|------|------------------------|---------------------|
| **Total** | R$ 508.000 | R$ 908.000 |
| **Score** | 58 | 62 |
| **Períodos SPED** | mai/2021, jul/2021, ago/2021, mar/2022, abr/2022, mai/2022 | mai/2021, out/2021, mar/2022, abr/2022, **ago/2023, ago/2024** |
| **Saldo credor ICMS (dado)** | R$ 97.174 (mai/2022) | R$ 238.883 (ago/2024) |
| **Saldo credor ICMS (projeção)** | R$ 290.000 | R$ 303.000 |
| **PIS-Importação** | R$ 17.000 | R$ 74.000 |
| **COFINS-Importação** | R$ 82.000 | R$ 351.000 |
| **Tese do Século (PIS+COFINS)** | — | R$ 11.000 |
| **IRPJ RJ70000001** | R$ 55.000 | R$ 52.000 |
| **SELIC (CSLL)** | R$ 19.000 | R$ 42.000 |
| **ICMS CIAP** | R$ 24.000 | R$ 77.000 |
| **Crédito extemporâneo** | R$ 21.000 | — |

---

## Causa raiz

### 1. Períodos diferentes

- **Extrato 14:** dados até **mai/2022** (último mês com saldo R$ 97.174).
- **Extrato 15:** dados até **ago/2024** (último mês com saldo R$ 238.883).

O saldo credor de ICMS cresceu de R$ 97k para R$ 238k entre mai/2022 e ago/2024.

### 2. PIS/COFINS-Importação

- **Extrato 14:** 4 meses com importação (abr/2022, mai/2022, jul/2021, ago/2021) — total R$ 5.712 (PIS) e R$ 27.588 (COFINS).
- **Extrato 15:** 3 meses com importação (abr/2022, **ago/2023**, **ago/2024**) — total R$ 23.376 (PIS) e R$ 109.922 (COFINS).

O Extrato 15 inclui **ago/2024**, com NF 60 de R$ 1.138.883 e COFINS-Importação de R$ 79.151 — operação grande que o Extrato 14 não viu.

### 3. Tese do Século (Tema 69)

- **Extrato 14:** não identificou saídas tributadas com ICMS destacado nos mesmos moldes.
- **Extrato 15:** identificou mai/2021 e ago/2023 com ICMS destacado (R$ 2.000 PIS + R$ 9.000 COFINS).

---

## Conclusão

A diferença **não é erro de cálculo**, e sim **consequência dos dados de entrada**:

- Extrato 15 usa SPEDs mais recentes (ago/2023, ago/2024).
- Extrato 14 usa SPEDs até mai/2022.

Com dados diferentes, os resultados esperados são diferentes.

---

## Recomendações

1. **Para o cliente:** usar o **Extrato 15** como referência, pois reflete o cenário mais atual (até ago/2024).
2. **Para a plataforma:** deixar explícito no extrato quais períodos de SPED foram analisados e qual o último mês com saldo credor.
3. **Consistência:** ao subir os mesmos SPEDs, os valores devem ser próximos. A variação aqui ocorre porque os conjuntos de SPEDs são distintos.

---

## Correção implementada (fev/2025)

O cliente confirmou que **foi o mesmo ZIP**, sem alteração. O sistema foi ajustado para garantir **processamento determinístico**:

1. **ZIP único** → passa a usar `zipProcessor` (mesma lógica da rota de viabilidade), garantindo que todos os SPEDs sejam analisados na mesma ordem.
2. **Ordenação por período** → SPEDs são ordenados por período (mais recentes primeiro) antes do envio ao HPC ou fallback, evitando que o limite de 120k caracteres exclua períodos recentes de forma inconsistente.
3. **Resultado** → o mesmo ZIP passa a gerar o mesmo conjunto de períodos e valores em análises repetidas.
