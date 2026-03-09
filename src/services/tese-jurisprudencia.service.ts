// src/services/tese-jurisprudencia.service.ts
// Consulta jurisprudência vinculante para ajuste de probabilidade nas teses

import { prisma } from '../utils/prisma';

export interface JurisprudenciaOverride {
  teseCodigo: string;
  temaVinculante?: string;
  tribunal?: string;
  resultado: string;
  probabilidadeMaxima?: number;
  modulacao?: string;
  notas?: string;
}

export async function getJurisprudenciaOverrides(): Promise<JurisprudenciaOverride[]> {
  const rows = await prisma.teseJurisprudencia.findMany({
    where: { ativo: true },
    orderBy: { dataJulgamento: 'desc' },
  });
  return rows.map(r => ({
    teseCodigo: r.teseCodigo,
    temaVinculante: r.temaVinculante || undefined,
    tribunal: r.tribunal || undefined,
    resultado: r.resultado,
    probabilidadeMaxima: r.probabilidadeMaxima ?? undefined,
    modulacao: r.modulacao || undefined,
    notas: r.notas || undefined,
  }));
}

export function formatOverridesForPrompt(overrides: JurisprudenciaOverride[]): string {
  if (overrides.length === 0) return '';

  const lines = [
    '',
    '## JURISPRUDENCIA VINCULANTE — AJUSTE OBRIGATORIO DE PROBABILIDADE',
    'Consulte a tabela abaixo. Se a tese tiver decisao desfavoravel, use a probabilidadeMaxima indicada.',
    '',
    ...overrides.map(o => {
      let s = `- Tese ${o.teseCodigo}: ${o.resultado}`;
      if (o.temaVinculante) s += ` (${o.temaVinculante})`;
      if (o.tribunal) s += ` — ${o.tribunal}`;
      if (o.probabilidadeMaxima != null) s += ` → probabilidade MAXIMA ${o.probabilidadeMaxima}%`;
      if (o.modulacao) s += ` | Modulacao: ${o.modulacao}`;
      return s;
    }),
    '',
  ];
  return lines.join('\n');
}
