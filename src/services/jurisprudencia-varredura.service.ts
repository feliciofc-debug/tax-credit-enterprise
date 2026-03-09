// src/services/jurisprudencia-varredura.service.ts
// Varredura periódica de jurisprudência — identifica decisões recentes e cria ThesisUpdate para revisão

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

const MODEL = 'claude-sonnet-4-5-20250929';

export interface VarreduraResult {
  total: number;
  updates: Array<{
    id: string;
    type: string;
    title: string;
    tribunal: string | null;
    thesisCode: string | null;
    relevance: string;
  }>;
  summary: string;
}

/**
 * Executa varredura de jurisprudência via Claude.
 * Busca decisões recentes do STF, STJ, CARF relevantes para as teses da plataforma
 * e cria registros em ThesisUpdate para revisão do admin.
 */
export async function runJurisprudenciaVarredura(): Promise<VarreduraResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const existingTheses = await prisma.taxThesis.findMany({
    where: { ativo: true },
    select: { code: true, name: true, tributo: true, tema: true },
    orderBy: { code: 'asc' },
  });

  const thesesList = existingTheses
    .map(t => `${t.code}: ${t.name} (${t.tributo}${t.tema ? ` — ${t.tema}` : ''})`)
    .join('\n');

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Você é um especialista em direito tributário brasileiro.

Identifique as ÚLTIMAS DECISÕES e JURISPRUDÊNCIA VINCULANTE (últimos 30-60 dias) do STF, STJ e CARF relevantes para recuperação de créditos tributários.

## TESES DA PLATAFORMA:
${thesesList}

Para cada decisão/jurisprudência encontrada, forneça:
- title: Título descritivo da decisão
- description: Descrição detalhada (ementa resumida, impacto)
- type: "jurisprudence" (sempre)
- tribunal: STF | STJ | CARF | null
- source: Número do processo, tema vinculante ou lei (ex: "RE 1234567", "Tema 1.079")
- relevance: "low" | "medium" | "high" | "critical"
- thesisCode: Código da tese afetada (ex: "3.2", "1.1") ou null
- suggestedAction: Ação sugerida (ex: "Criar override em TeseJurisprudencia", "Revisar probabilidade")

Responda APENAS em JSON válido:
{
  "updates": [
    {
      "title": "...",
      "description": "...",
      "type": "jurisprudence",
      "tribunal": "...",
      "source": "...",
      "relevance": "...",
      "thesisCode": "...",
      "suggestedAction": "..."
    }
  ],
  "summary": "Resumo geral das novidades encontradas"
}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada da IA');
  }

  let parsed: { updates?: any[]; summary?: string };
  try {
    const jsonStr = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    logger.error('Resposta da IA não é JSON válido:', content.text.substring(0, 500));
    throw new Error('Resposta da IA em formato inválido');
  }

  const updates = parsed.updates || [];
  const savedUpdates: VarreduraResult['updates'] = [];

  for (const u of updates) {
    const saved = await prisma.thesisUpdate.create({
      data: {
        type: u.type || 'jurisprudence',
        title: u.title || 'Sem título',
        description: `${u.description || ''}\n\nAção sugerida: ${u.suggestedAction || 'Revisar'}`,
        source: u.source || null,
        tribunal: u.tribunal || null,
        relevance: u.relevance || 'medium',
        thesisCode: u.thesisCode || null,
      },
    });
    savedUpdates.push({
      id: saved.id,
      type: saved.type,
      title: saved.title,
      tribunal: saved.tribunal,
      thesisCode: saved.thesisCode,
      relevance: saved.relevance,
    });
  }

  logger.info(`[JURISPRUDENCIA-VARREDURA] ${savedUpdates.length} itens criados para revisão`);

  return {
    total: savedUpdates.length,
    updates: savedUpdates,
    summary: parsed.summary || `${savedUpdates.length} novidades encontradas`,
  };
}
