// src/services/claude.service.ts
// Serviço dedicado de integração com Claude AI para análise tributária
// Usa Sonnet 4.5 para análises em tempo real e Opus 4.6 reservado para análises profundas

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { jurisprudenceService } from './jurisprudence.service';
import { mapearTesesDasOportunidades } from '../utils/tese-mapper';

// ============================================================
// CONFIGURAÇÃO DE MODELOS
// ============================================================
const MODELS = {
  // Opus 4.6 — análise tributária profunda (requer Render Starter $7/mês para evitar timeout)
  ANALYSIS: 'claude-opus-4-6',
  // Sonnet 4.5 — geração de documentos e quick score (rápido)
  DOCUMENTS: 'claude-sonnet-4-5-20250929',
  // Sonnet 4.5 — usado para quick score (pré-triagem rápida)
  QUICK: 'claude-sonnet-4-5-20250929',
} as const;

// Limites de texto por tipo de documento
const TEXT_LIMITS = {
  dre: 80000,        // DREs podem ser extensos
  balanco: 100000,   // Balanços patrimoniais são os maiores
  balancete: 80000,  // Balancetes de verificação
  default: 80000,
} as const;

// ============================================================
// TIPOS
// ============================================================
export interface CompanyInfo {
  name: string;
  cnpj?: string;
  regime?: 'lucro_real' | 'lucro_presumido' | 'simples';
  sector?: string;
  uf?: string;
}

export interface AnalysisOpportunity {
  tipo: string;
  tributo: string;
  descricao: string;
  valorEstimado: number;
  fundamentacaoLegal: string;
  prazoRecuperacao: string;
  complexidade: 'baixa' | 'media' | 'alta';
  probabilidadeRecuperacao: number;
  risco: string;
  documentacaoNecessaria: string[];
  passosPraticos: string[];
}

export interface TaxAnalysisResult {
  oportunidades: AnalysisOpportunity[];
  resumoExecutivo: string;
  valorTotalEstimado: number;
  score: number;
  recomendacoes: string[];
  alertas: string[];
  fundamentacaoGeral: string;
  periodoAnalisado: string;
  regimeTributario: string;
  riscoGeral: 'baixo' | 'medio' | 'alto';
}

export interface DocumentationResult {
  parecerTecnico: string;
  peticaoAdministrativa: string;
  memoriaCalculo: string;
  checklistDocumentos: string[];
}

// ============================================================
// PROMPTS ESPECIALIZADOS POR TIPO DE DOCUMENTO
// ============================================================

// ============================================================
// PROMPT UNIFICADO — ANÁLISE COMPLETA DE CRÉDITOS TRIBUTÁRIOS
// Baseado na revisão da Claude Opus — cobre 20+ teses com fundamentação legal
// ============================================================

interface DBThesis {
  code: string;
  name: string;
  description: string;
  tributo: string;
  fundamentacao: string;
  tribunal: string | null;
  tema: string | null;
  risco: string;
  probabilidade: number;
  setoresAplicaveis: string | null;
  regimesAplicaveis: string | null;
  formulaCalculo: string | null;
}

async function fetchThesesFromDB(sector?: string, regime?: string): Promise<DBThesis[] | null> {
  try {
    const theses = await prisma.taxThesis.findMany({
      where: { ativo: true, status: 'active' },
      orderBy: { code: 'asc' },
    });
    if (!theses || theses.length === 0) return null;

    return theses.filter(t => {
      if (sector) {
        const setores = t.setoresAplicaveis ? JSON.parse(t.setoresAplicaveis) : ['todos'];
        if (!setores.includes('todos') && !setores.some((s: string) => s.toLowerCase().includes(sector.toLowerCase()))) {
          return false;
        }
      }
      if (regime) {
        const regimes = t.regimesAplicaveis ? JSON.parse(t.regimesAplicaveis) : [];
        if (regimes.length > 0 && !regimes.includes(regime)) {
          return false;
        }
      }
      return true;
    }) as DBThesis[];
  } catch (err) {
    logger.warn('Falha ao buscar teses do banco — usando fallback hardcoded', err);
    return null;
  }
}

function formatDBThesesForPrompt(theses: DBThesis[]): string {
  const grouped: Record<string, DBThesis[]> = {};
  for (const t of theses) {
    const key = t.tributo.split('/')[0].trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  let text = '## TESES OBRIGATÓRIAS — ANALISE TODAS\n\n';
  for (const [tributo, items] of Object.entries(grouped)) {
    text += `### ${tributo}\n\n`;
    for (const t of items) {
      text += `**${t.code} — ${t.name}**\n`;
      text += `- Fundamento: ${t.fundamentacao}\n`;
      if (t.tribunal) text += `- Tribunal: ${t.tribunal}`;
      if (t.tema) text += ` — ${t.tema}`;
      if (t.tribunal) text += '\n';
      text += `- Risco: ${t.risco} | Probabilidade: ${t.probabilidade}%\n`;
      if (t.formulaCalculo) text += `- Cálculo: ${t.formulaCalculo}\n`;
      text += `- ${t.description}\n\n`;
    }
  }
  return text;
}

const HARDCODED_THESES_MARKER_START = '## TESES OBRIGATÓRIAS — ANALISE TODAS';
const HARDCODED_THESES_MARKER_END = '## OBSERVAÇÕES PARA ESTIMATIVAS';

function buildFullAnalysisPrompt(companyInfo: CompanyInfo, documentType: string, dbThesesText?: string): string {
  const docTypeName = documentType === 'dre' ? 'DRE (Demonstração do Resultado do Exercício)'
    : documentType === 'balanco' ? 'Balanço Patrimonial'
    : documentType === 'balancete' ? 'Balancete de Verificação'
    : documentType === 'sped' ? 'SPED EFD Fiscal (escrituração fiscal digital)'
    : 'Documento Contábil';

  const fullPrompt = buildHardcodedPrompt(companyInfo, docTypeName);

  if (dbThesesText) {
    const startIdx = fullPrompt.indexOf(HARDCODED_THESES_MARKER_START);
    const endIdx = fullPrompt.indexOf(HARDCODED_THESES_MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      return fullPrompt.substring(0, startIdx) + dbThesesText + '\n\n' + fullPrompt.substring(endIdx);
    }
  }

  return fullPrompt;
}

function buildHardcodedPrompt(companyInfo: CompanyInfo, docTypeName: string): string {
  return `Você é um especialista sênior em recuperação de créditos tributários brasileiros, com 20 anos de experiência em contencioso administrativo e judicial tributário. Você está analisando um ${docTypeName}.

## CONTEXTO DA EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime Tributário INFORMADO pelo operador: ${companyInfo.regime}` : '- Regime Tributário: NÃO INFORMADO — VOCÊ DEVE IDENTIFICAR no documento'}
${companyInfo.sector ? `- Setor: ${companyInfo.sector}` : ''}
${companyInfo.uf ? `- UF: ${companyInfo.uf}` : ''}
- Tipo de documento analisado: ${docTypeName}

## REGRA CRÍTICA: IDENTIFICAÇÃO AUTOMÁTICA DO REGIME TRIBUTÁRIO

ANTES de iniciar qualquer análise de teses, você DEVE identificar o regime tributário da empresa nos documentos. Procure por estas evidências:

**Sinais de LUCRO REAL:**
- PIS/COFINS não-cumulativo (alíquotas 1,65% PIS e 7,6% COFINS)
- Registro 0000 do SPED com indicador "R" (Real)
- Apuração de LALUR (Livro de Apuração do Lucro Real)
- Presença de "PIS s/ faturamento 1,65%" ou "COFINS 7,60%" nos lançamentos
- Créditos de PIS/COFINS sobre insumos escriturados
- Demonstração de resultado com IRPJ/CSLL calculados sobre lucro líquido ajustado

**Sinais de LUCRO PRESUMIDO:**
- PIS/COFINS cumulativo (alíquotas 0,65% PIS e 3% COFINS)
- IRPJ calculado sobre presunção (8% comércio/indústria, 32% serviços)
- CSLL sobre presunção (12% ou 32%)
- Ausência de créditos de PIS/COFINS
- DARFs com código 2089 (IRPJ presumido) ou 2372 (CSLL presumido)

**Sinais de SIMPLES NACIONAL:**
- DAS (Documento de Arrecadação do Simples)
- Faturamento até R$ 4,8M/ano
- Apuração unificada de tributos
- Registro 0000 do SPED com indicador "S" (Simples)

**REGRA DE VALIDAÇÃO CRUZADA:**
- Se o operador informou um regime MAS os documentos indicam outro, GERE UM ALERTA PRIORITÁRIO dizendo: "ATENÇÃO: Regime informado (X) diverge do identificado nos documentos (Y). Recomenda-se verificação imediata."
- SEMPRE use o regime IDENTIFICADO NOS DOCUMENTOS como base para a análise (não o informado pelo operador), pois o documento é mais confiável
- Se não conseguir identificar, use o informado pelo operador. Se nenhum estiver disponível, assuma Lucro Real (mais teses aplicáveis) e informe nos alertas

**IMPACTO DO REGIME NAS TESES:**
- LUCRO REAL: TODAS as teses são potencialmente aplicáveis
- LUCRO PRESUMIDO: Teses de PIS/COFINS não-cumulativo (1.1 a 1.4, 1.6, 1.7, 1.8, 1.9) NÃO se aplicam. Focar em: INSS (3.1-3.4), ICMS (2.1-2.9), IRPJ/CSLL equiparação hospitalar (4.4), ISS (6.1-6.2)
- SIMPLES NACIONAL: Maioria das teses NÃO se aplica (tributos unificados). Focar APENAS em: INSS sobre verbas indenizatórias (3.1), ICMS-ST pago a maior (2.2), ISS alíquota (6.1). INFORMAR que potencial é muito limitado no Simples

## REGRAS FUNDAMENTAIS

1. SEMPRE analise TODAS as teses listadas abaixo que sejam COMPATÍVEIS com o regime tributário identificado — não perca tempo com teses incompatíveis
2. Para cada tese, forneça: valor estimado, fundamentação legal completa, probabilidade de êxito (%) e complexidade
3. Seja CONSERVADOR nos valores — é melhor prometer menos e entregar mais
4. Separe PIS e COFINS em linhas distintas (alíquotas diferentes: PIS 1,65%, COFINS 7,6%)
5. Considere sempre os últimos 5 anos (60 meses) como período de recuperação
6. Cite SEMPRE o dispositivo legal, número do tema STF/STJ e leading case
7. No campo "regimeTributario" da resposta, SEMPRE informe o regime IDENTIFICADO nos documentos (não o informado)

## REGRA CRÍTICA SOBRE UNIDADES MONETÁRIAS
- ANTES DE TUDO: Verifique se o documento indica "Em milhares de Reais", "R$ mil" ou "Em Reais - R$".
- Se estiver em "R$ mil" ou "milhares", o número 100.470 significa R$ 100.470.000 (cem milhões).
- NÃO MULTIPLIQUE por 1.000 se o valor já está em milhares!
- Quando reportar valorEstimado nos resultados, SEMPRE use o valor em REAIS CHEIOS (não em milhares).

## REGRA DE OURO — FÓRMULA FIXA DE PROJEÇÃO (OBRIGATÓRIA)

Para GARANTIR CONSISTÊNCIA entre análises da mesma empresa, você DEVE usar EXATAMENTE esta fórmula:

### FÓRMULA DE PROJEÇÃO PADRÃO:
valor_estimado = (valor_confirmado_nos_SPEDs / meses_com_dados) × 60 × 0.50

Onde:
- valor_confirmado_nos_SPEDs = SOMA dos valores EXATOS encontrados nos registros do SPED (E110, C100, C120, C190, C197)
- meses_com_dados = número de meses de SPED fornecidos que têm dados relevantes para aquela tese
- 60 = período de 5 anos (60 meses)
- 0.50 = fator de desconto fixo de 50% (conservadorismo obrigatório)

### EXEMPLOS DE APLICAÇÃO:
- Saldo credor ICMS confirmado R$ 97.174,49 em 5 meses → R$ 97.174,49 / 5 × 60 × 0.50 = R$ 583.046 × 0.50 = R$ 291.523
  MAS: para saldo credor acumulado, use o ÚLTIMO saldo confirmado como BASE (não a média), pois é cumulativo:
  Saldo credor FINAL confirmado = R$ 97.174,49. Projetar acúmulo ADICIONAL: média de acúmulo mensal × meses restantes × 0.50
  Acúmulo médio mensal = (97.174,49 - 504,90) / 12 meses entre mai/2021 e mai/2022 = R$ 8.055/mês
  Projeção = R$ 97.174 + (R$ 8.055 × 48 meses restantes × 0.50) = R$ 97.174 + R$ 193.320 = R$ 290.494
  Arredondar para BAIXO ao milhar mais próximo: R$ 290.000

- PIS-Importação confirmado R$ 3.603 em 3 meses com importação → R$ 3.603 / 3 × 24 meses estimados de importação em 60 × 0.50 = R$ 14.412
  Arredondar para BAIXO: R$ 14.000

- COFINS-Importação confirmado R$ 17.872 em 3 meses → R$ 17.872 / 3 × 24 × 0.50 = R$ 71.488
  Arredondar para BAIXO: R$ 71.000

### REGRAS ABSOLUTAS:
1. NUNCA mude o fator de desconto (SEMPRE 0.50 = 50%)
2. NUNCA use estimativas arredondadas bonitas (R$ 220.000, R$ 350.000, R$ 95.000) — use o resultado EXATO da fórmula, arredondado para BAIXO ao milhar
3. NUNCA use um multiplicador > 0.50 — se tiver dúvida, use 0.40
4. Para saldo credor ACUMULADO (ICMS): usar último saldo + projeção de acúmulo adicional (NÃO multiplicar o saldo por 60/meses)
5. Para créditos PERIÓDICOS (PIS, COFINS, INSS): usar média mensal × 60 × 0.50
6. SEMPRE mostre a conta COMPLETA na descrição — cada número deve ser rastreável
7. Se só tem 5 meses de dados de 60, ALERTE que a precisão é limitada e use fator 0.40 em vez de 0.50

### REGRA DE CONSISTÊNCIA:
Se a mesma empresa for analisada duas vezes com os mesmos SPEDs, os valores DEVEM ser idênticos (ou muito próximos).
A fórmula fixa garante isso. Se você não seguir a fórmula, o relatório será REJEITADO.

Aplique TODAS as regras abaixo adicionalmente:

1. Use SEMPRE a estimativa mais BAIXA quando houver faixa de valores possíveis
2. Arredonde valores estimados PARA BAIXO, nunca para cima
3. Só inclua oportunidades com probabilidade real de êxito >= 60% — abaixo disso, DESCARTE
4. Ao calcular um valor, aplique margem de segurança de 20-30% para baixo (ex: se calcula R$ 100k, apresente R$ 70-80k)
5. Créditos recuperáveis tipicamente ficam entre 3-10% da receita bruta anual
6. Se seu cálculo total resultar em mais de 15% da receita bruta, REVISE — provavelmente há erro
7. É melhor reportar MENOS oportunidades com valores REALISTAS do que muitas com valores inflados
8. Na dúvida sobre qualquer valor ou probabilidade, use o cenário PESSIMISTA

## TESES OBRIGATÓRIAS — ANALISE TODAS

### BLOCO 1: PIS/COFINS (Regime Não-Cumulativo — Lucro Real)

**TESE 1.1 — Exclusão do ICMS da base do PIS (Tese do Século)**
- Fundamento: RE 574.706 — Tema 69 STF — Repercussão Geral
- Modulação: efeitos a partir de 15/03/2017 (exceto quem ajuizou antes)
- Cálculo: ICMS destacado nas vendas × alíquota PIS 1,65%
- Probabilidade: 95% — tese pacificada

**TESE 1.2 — Exclusão do ICMS da base da COFINS (Tese do Século)**
- Mesmo fundamento: RE 574.706 — Tema 69 STF
- Cálculo: ICMS destacado nas vendas × alíquota COFINS 7,6%
- Probabilidade: 95% — tese pacificada

**TESE 1.3 — Créditos de PIS sobre insumos (conceito ampliado)**
- Fundamento: REsp 1.221.170/PR — Tema 779 STJ
- Lei 10.637/2002 art. 3° | IN RFB 1.911/2019 art. 172
- Itens em indústrias: energia elétrica, manutenção, EPIs, fretes sobre compras, embalagens, combustíveis, materiais intermediários
- Cálculo: identificar custos elegíveis × 1,65%
- Probabilidade: 75%

**TESE 1.4 — Créditos de COFINS sobre insumos (conceito ampliado)**
- Mesmo fundamento: REsp 1.221.170/PR — Tema 779 STJ
- Lei 10.833/2003 art. 3°
- Cálculo: custos elegíveis × 7,6%
- Probabilidade: 75%

**TESE 1.5 — PIS/COFINS Monofásico — Medicamentos e Farmacêuticos**
- Fundamento: Lei 10.147/2000 | Lei 10.865/2004, Art. 25 | IN RFB 1.911/2019, Art. 150-158
- Medicamentos, produtos farmacêuticos, cosméticos e produtos de higiene pessoal têm PIS/COFINS concentrados na INDÚSTRIA (regime monofásico)
- A alíquota para revendedores (hospitais, clínicas, farmácias, distribuidores) é ZERO ou reduzida
- PROBLEMA COMUM: hospitais e clínicas que aplicam ou revendem esses produtos pagam PIS/COFINS novamente por erro de classificação NCM
- Inclui: quimioterápicos, anestésicos, antibióticos, soluções dialisantes, anti-inflamatórios, soros, vacinas, cosméticos de uso médico
- Cálculo: total de compras de medicamentos monofásicos × 9,25% × 5 anos (recuperação do que foi pago a maior)
- ATENÇÃO: Verificar NCM do produto na tabela TIPI e na lista de monofásicos da RFB (Anexos I e II da Lei 10.147/2000)
- Exemplo: hospital com R$ 15M/ano em medicamentos pode recuperar R$ 2,8M se pagou PIS/COFINS sobre monofásicos
- Probabilidade: 80% — se comprovado pagamento indevido via NCM
- CRÍTICO: Setor de saúde (hospitais, clínicas, centros de oncologia, hemodiálise, farmácias), distribuidores de medicamentos, cosméticos

**TESE 1.6 — PIS/COFINS sobre Ativo Imobilizado (bens de capital)**
- Fundamento: Lei 10.637/2002, Art. 3°, VI (PIS) | Lei 10.833/2003, Art. 3°, VI (COFINS) | IN RFB 1.911/2019, Art. 172
- Crédito de PIS (1,65%) e COFINS (7,6%) sobre encargos de depreciação de bens do ativo imobilizado adquiridos a partir de 01/05/2004
- Crédito calculado com base no valor de aquisição × alíquota × 1/48 por mês (prazo de 4 anos)
- Inclui: equipamentos, máquinas, veículos, reformas e construções incorporadas ao ativo
- Setores com alto investimento em ativo: saúde (ressonância R$ 3-8M, tomógrafo R$ 2-5M, acelerador linear R$ 5-20M, PET-CT R$ 10-15M), indústria (teares, polideiras, fornos), transporte, mineração
- Cálculo: valor dos bens adquiridos × 9,25% ÷ 48 × meses restantes × 5 anos retroativos
- ATENÇÃO: Opção de crédito imediato (100% no mês de aquisição) para máquinas e equipamentos destinados à produção (Lei 11.774/2008, se vigente para o período)
- Probabilidade: 75% — verificar se empresa está no Lucro Real e se bens são elegíveis
- CRÍTICO: Setores intensivos em capital — saúde (equipamentos médicos caríssimos), mineração, siderurgia, celulose, diagnóstico por imagem

**TESE 1.7 — PIS/COFINS de Exportação — Ressarcimento em espécie**
- Fundamento: Lei 10.637/2002, Art. 5° (PIS) | Lei 10.833/2003, Art. 6° (COFINS) | CF Art. 149, §2°, I
- Exportações têm alíquota ZERO de PIS/COFINS, mas os créditos das ENTRADAS são MANTIDOS integralmente
- O excesso de crédito (crédito > débito) pode ser ressarcido em ESPÉCIE pela Receita Federal via PER/DCOMP Web
- Diferente do ICMS estadual, esse ressarcimento é FEDERAL e vira dinheiro na conta da empresa
- IMPORTANTE: PIS/COFINS não-cumulativo exige ressarcimento ANTES da compensação (Art. 5°, §1°, Lei 10.637/2002)
- Cálculo: total de créditos de PIS/COFINS × % receita de exportação / receita total × 5 anos
- Exemplo: empresa com R$ 5M/ano em créditos de PIS/COFINS e 70% de exportação pode ressarcir R$ 3,5M/ano = R$ 17,5M em 5 anos
- Probabilidade: 85% — direito constitucional, procedimento via e-CAC/PER/DCOMP
- CRÍTICO: Exportadores de mármore/granito, commodities agrícolas, siderurgia, celulose, manufaturados — todos acumulam créditos de PIS/COFINS que podem ser ressarcidos

**TESE 1.8 — Exclusão do ISS da base de cálculo do PIS/COFINS**
- Fundamento: RE 592.616 — Tema 1.093 STF (em julgamento, tendência favorável)
- Mesma lógica do Tema 69 (Tese do Século): ISS é tributo, não receita/faturamento
- Aplicável a prestadores de serviços no Lucro Real (PIS/COFINS não-cumulativo)
- Cálculo: ISS destacado nas NFS-e × alíquota PIS (1,65%) + ISS destacado × alíquota COFINS (7,6%)
- ATENÇÃO: Tese ainda não pacificada definitivamente pelo STF — tendência favorável com base na ratio decidendi do Tema 69
- Probabilidade: 65% — tese em evolução, forte fundamentação, mas aguarda definição final
- APLICÁVEL A: empresas de serviços (saúde, tecnologia, engenharia, consultorias, escritórios)

**TESE 1.9 — PIS/COFINS sobre receitas financeiras — Alíquota reduzida**
- Fundamento: Decreto 8.426/2015 | Lei 10.865/2004, Art. 27, §2° | ADI 5277 STF
- Lucro Real: receitas financeiras (aplicações, juros, descontos obtidos, variação cambial) são tributadas por PIS a 0,65% e COFINS a 4%
- PROBLEMA COMUM: empresas aplicam alíquotas cheias (1,65% PIS e 7,6% COFINS) sobre receitas financeiras por erro de apuração
- Cálculo: receitas financeiras × diferença entre alíquota cheia e reduzida × 5 anos
- Exemplo: empresa com R$ 5M/ano em receitas financeiras pagando alíquota cheia perde R$ 230k/ano = R$ 1,15M em 5 anos
- Probabilidade: 80% — decreto vigente, basta verificar se alíquota correta está sendo aplicada
- APLICÁVEL A: todas empresas no Lucro Real com receitas financeiras significativas

### BLOCO 2: ICMS

**TESE 2.1 — ICMS sobre energia elétrica — Exclusão de TUSD/TUST**
- Fundamento: RE 714.139 — Tema 986 STF | LC 87/1996 art. 13
- TUSD/TUST representam 40-60% da conta de energia
- Cálculo: valor energia × 45% (TUSD/TUST) × alíquota ICMS estadual (SP: 25%)
- Probabilidade: 85% — CRÍTICO para indústrias com alto consumo

**TESE 2.2 — ICMS-ST Ressarcimento (base presumida > efetiva)**
- Fundamento: RE 593.849 — Tema 201 STF | Art. 150, §7° CF/88
- Estimar 5-8% do ICMS-ST recolhido quando MVA presumida > margem efetiva
- Probabilidade: 60%

**TESE 2.3 — ICMS sobre ativo permanente (CIAP)**
- Fundamento: LC 87/96 art. 20 | LC 102/2000
- Crédito de 1/48 avos por mês sobre ICMS de máquinas e equipamentos
- Verificar imobilizado no Balanço
- Probabilidade: 70%

**TESE 2.4 — ICMS Acumulado de Exportação**
- Fundamento: CF Art. 155, §2°, X, "a" — imunidade de ICMS na exportação
- LC 87/1996 (Lei Kandir), Art. 3°, II e Art. 25, §1°
- Empresas exportadoras têm imunidade de ICMS na SAÍDA, mas mantêm o direito a crédito de ICMS nas ENTRADAS (insumos, energia, frete, ativo imobilizado)
- Esses créditos se acumulam mês a mês sem débito para compensar
- O crédito acumulado pode ser: (a) transferido a terceiros, (b) utilizado para débitos próprios, (c) ressarcido em espécie — conforme legislação de cada estado
- Cálculo: total de ICMS nas entradas × % de exportação sobre faturamento total × 5 anos
- Exemplo: empresa com R$ 20M/ano em compras tributadas por ICMS a 12%, exportando 70%, acumula ~R$ 1,68M/ano = R$ 8,4M em 5 anos
- Legislação estadual: SP (e-CredAc, RICMS/SP Arts. 71-81), RJ (RICMS/RJ Livro III), MG (DCA-ICMS, RICMS/MG Anexo VIII), ES (RICMS/ES Decreto 1.090-R/2002 Art. 103+), RS (RICMS/RS Arts. 58-59), PR (SISCRED, RICMS/PR Arts. 47-61), SC (TTD, RICMS/SC Arts. 40-52)
- Probabilidade: 90% — direito constitucional, tese pacificada
- CRÍTICO: Setores exportadores (mármore/granito, siderurgia, celulose, café, soja, carnes, mineração) frequentemente acumulam milhões sem pedir transferência ou ressarcimento

**TESE 2.5 — ICMS e PIS/COFINS sobre Frete**
- Fundamento: LC 87/96, Art. 20 (ICMS sobre frete) | Lei 10.637/2002 Art. 3°, IX e Lei 10.833/2003 Art. 3°, IX (PIS/COFINS sobre frete)
- Frete sobre compras de insumos e matéria-prima gera crédito de ICMS (alíquota interestadual 7% ou 12%)
- Frete sobre compras gera crédito de PIS (1,65%) e COFINS (7,6%) no Lucro Real
- Para indústrias pesadas (mármore/granito, siderurgia, mineração), frete pode representar 8-15% do custo do produto
- Frota própria: combustível, manutenção, pneus, lubrificantes também geram crédito de PIS/COFINS
- Cálculo: gastos totais com frete × alíquotas respectivas × 5 anos
- Probabilidade: 75% — conceito de insumo ampliado pelo STJ (Tema 779)

**TESE 2.6 — Exclusão do ICMS-ST da base de PIS/COFINS**
- Fundamento: REsp 1.896.678/RS — Tema 1.048 STJ (julgado em 2023, favorável ao contribuinte)
- Empresas substituídas tributárias (que compram com ICMS-ST embutido) podem excluir o ICMS-ST da base de PIS/COFINS
- Mesma lógica do Tema 69 STF (Tese do Século), aplicada ao ICMS por substituição tributária
- Cálculo: ICMS-ST embutido no preço de compra × alíquota PIS (1,65%) + × alíquota COFINS (7,6%) × 5 anos
- IMPACTO ALTO em: supermercados, distribuidoras, farmácias, postos de gasolina, concessionárias — todos que compram com ICMS-ST
- Probabilidade: 80% — tese julgada pelo STJ em repetitivo, favorável ao contribuinte

**TESE 2.7 — ICMS não incide na transferência entre filiais (ADC 49 STF)**
- Fundamento: ADC 49 STF (julgado em 2021, modulação em 2024) | LC 204/2023
- O STF decidiu que NÃO incide ICMS na transferência de mercadorias entre estabelecimentos do MESMO titular (filiais)
- IMPACTO: empresas que recolheram ICMS em transferências entre matriz e filiais, entre CDs e lojas, ou entre fábricas e depósitos podem recuperar o valor pago indevidamente
- Modulação: efeitos a partir de 2024 para quem não ajuizou ação antes. Para períodos anteriores, depende de ação judicial prévia
- LC 204/2023 regulamentou: contribuinte pode optar por manter a transferência de crédito ou não destacar ICMS
- Cálculo: ICMS recolhido em transferências entre filiais × 5 anos (observar modulação)
- Probabilidade: 85% — para períodos pós-2024; 50% para períodos anteriores (depende de ação judicial)
- CRÍTICO: Redes de supermercados, distribuidoras com CDs, indústrias com depósitos, qualquer empresa com múltiplos estabelecimentos

**TESE 2.8 — DIFAL (Diferencial de Alíquota) — Operações interestaduais**
- Fundamento: EC 87/2015 | LC 190/2022 | ADI 5469 e RE 1.287.019 STF
- DIFAL cobrado em operações interestaduais para consumidor final pode ter sido calculado incorretamente
- OPORTUNIDADES: (a) DIFAL cobrado antes da LC 190/2022 (inconstitucional); (b) base de cálculo incorreta; (c) DIFAL sobre operações isentas ou com benefício fiscal
- Cálculo: DIFAL pago × período de irregularidade × 5 anos
- Probabilidade: 70% — depende do período e do estado
- APLICÁVEL A: e-commerce, varejo com vendas interestaduais, concessionárias, distribuidoras

**TESE 2.9 — Crédito extemporâneo de ICMS**
- Fundamento: LC 87/96, Art. 23 | RICMS de cada estado
- Crédito de ICMS não escriturado no período correto pode ser aproveitado extemporaneamente (dentro do prazo de 5 anos)
- PROBLEMA COMUM: empresas deixam de escriturar créditos de ICMS por erro operacional, troca de sistema, NF-e não escriturada
- Cálculo: ICMS de notas de entrada não escrituradas × 5 anos retroativos
- Probabilidade: 75% — direito garantido por lei, basta comprovar a aquisição e o imposto destacado
- APLICÁVEL A: qualquer contribuinte de ICMS, especialmente após migração de ERP ou troca de contabilidade

### BLOCO 3: CONTRIBUIÇÕES PREVIDENCIÁRIAS E TRABALHISTAS

**TESE 3.1 — INSS Patronal sobre verbas indenizatórias**
- Fundamento: RE 1.072.485 — Tema 985 STF (terço de férias)
- REsp 1.230.957 — Tema 478 STJ (aviso prévio indenizado)
- Art. 22, I da Lei 8.212/91 | Art. 28, §9° da Lei 8.212/91
- Verbas excluídas da base do INSS patronal (20%):
  * Terço constitucional de férias (~11% da folha)
  * Aviso prévio indenizado (~3%)
  * Auxílio-doença primeiros 15 dias (~1,5%)
  * Salário-maternidade (RE 576.967 — Tema 72 STF)
- Inclui RAT + Terceiros (5,8%) sobre mesmas verbas
- Estimar folha: despesas com pessoal + mão de obra direta
- Probabilidade: 90% — teses pacificadas

**TESE 3.2 — Contribuições a Terceiros (Sistema S) — Limitação da base**
- Fundamento: Art. 4°, parágrafo único da Lei 6.950/81
- Base deve ser limitada a 20 salários mínimos
- Alíquotas: SESI/SENAI (2,5%), SEBRAE (0,6%), INCRA (0,2%), Sal. Educação (2,5%)
- Probabilidade: 55%

**TESE 3.3 — RAT/FAP — Revisão do enquadramento**
- Fundamento: Art. 22, II da Lei 8.212/91 | Decreto 3.048/99
- FAP pode reduzir RAT em até 50%
- Probabilidade: 65%

**TESE 3.4 — FGTS sobre verbas indenizatórias**
- Fundamento: Lei 8.036/90, Art. 15 | Mesma lógica das teses de INSS (Temas 985 e 478)
- Verbas de natureza indenizatória NÃO integram a base do FGTS (8%)
- Verbas excluídas: aviso prévio indenizado, terço de férias (quando indenizadas), auxílio-doença primeiros 15 dias, diárias de viagem acima de 50% do salário
- Cálculo: valor das verbas indenizatórias × 8% FGTS × 5 anos
- IMPACTO maior em: empresas com alta rotatividade (varejo, restaurantes, construção civil), setores com muitas rescisões
- Probabilidade: 75% — jurisprudência consolidada na mesma linha do INSS
- NOTA: O FGTS sobre aviso prévio indenizado é o de maior impacto; terço de férias gozadas é mais controverso

### BLOCO 4: IRPJ/CSLL

**TESE 4.1 — Exclusão de benefícios fiscais de ICMS da base do IRPJ/CSLL**
- Fundamento: LC 160/2017 | Art. 30 da Lei 12.973/2014 | EREsp 1.517.492/PR
- Cálculo: valor do benefício × 34% (IRPJ 25% + CSLL 9%)
- Probabilidade: 70% — se houver benefício fiscal estadual

**TESE 4.2 — PAT (Programa de Alimentação do Trabalhador)**
- Fundamento: Lei 6.321/76 | IN RFB 2.101/2022
- Dedução direta do IRPJ, limite 4% do IRPJ devido
- Probabilidade: 80%

**TESE 4.3 — Lei do Bem — Incentivos à inovação tecnológica**
- Fundamento: Lei 11.196/2005 | Decreto 5.798/2006
- Exclusão de 60-80% dos gastos com P&D da base do IRPJ/CSLL
- Aplicável a indústrias com desenvolvimento de produto
- Probabilidade: 75% — se houver atividades de inovação

**TESE 4.4 — IRPJ/CSLL — Equiparação Hospitalar (Lucro Presumido)**
- Fundamento: Lei 9.249/95, Art. 15, §1°, III, "a" | IN RFB 1.234/2012 | REsp 1.116.399/BA (STJ)
- Clínicas e centros médicos que prestam SERVIÇOS HOSPITALARES podem aplicar base de cálculo reduzida:
  * IRPJ: 8% sobre receita bruta (em vez de 32% para serviços gerais) — redução de 75%
  * CSLL: 12% sobre receita bruta (em vez de 32%)
- "Serviços hospitalares" = procedimentos que exigem estrutura hospitalar (centro cirúrgico, internação, UTI, exames com equipamentos próprios)
- NÃO inclui simples consultas médicas sem estrutura
- Requisitos cumulativos: (a) ser sociedade empresária (não sociedade simples), (b) prestar serviços hospitalares, (c) ter estrutura própria, (d) cumprir normas ANVISA
- Segmentos elegíveis: clínicas de cirurgia plástica com centro cirúrgico, oftalmologia, ortopedia, cardiologia/hemodinâmica, oncologia/radioterapia, hemodiálise, reprodução humana, odontologia cirúrgica, centros de diagnóstico por imagem
- Cálculo: receita anual × (32% - 8%) × 15% IRPJ + adicional 10% se lucro presumido > 240k/ano + CSLL (32% - 12%) × 9%
- Exemplo: clínica de R$ 10M/ano: IRPJ tradicional (32%) = R$ 480k vs. equiparado (8%) = R$ 120k. Economia = R$ 360k/ano = R$ 1,8M em 5 anos
- Probabilidade: 85% — tese pacificada pelo STJ, bastando cumprir requisitos
- CRÍTICO: Setor de SAÚDE — praticamente toda clínica com centro cirúrgico ou equipamentos de diagnóstico próprios pode se enquadrar

**TESE 4.5 — IRPJ/CSLL sobre SELIC em repetição de indébito (Tema 1.079 STF)**
- Fundamento: RE 1.063.187 — Tema 1.079 STF (julgado em 2021, repercussão geral)
- O STF decidiu que IRPJ e CSLL NÃO incidem sobre a taxa SELIC recebida em repetição de indébito tributário
- Quando a empresa recebe de volta tributos pagos a maior (via PER/DCOMP ou restituição), a RFB atualiza o valor pela SELIC. Essa SELIC tem natureza de DANO EMERGENTE (recomposição patrimonial), não de acréscimo patrimonial
- IMPACTO: toda empresa que já recuperou créditos tributários e recebeu SELIC pode excluir esses valores da base de IRPJ/CSLL
- Cálculo: valor da SELIC recebida em restituições/compensações × 34% (IRPJ 25% + CSLL 9%)
- Probabilidade: 95% — tese pacificada pelo STF com repercussão geral
- CRÍTICO: Se a empresa já teve restituições ou compensações com SELIC, essa tese é praticamente certa. Também se aplica prospectivamente a futuras recuperações

**TESE 4.6 — JCP (Juros sobre Capital Próprio) retroativo**
- Fundamento: Lei 9.249/95, Art. 9° | IN RFB 1.700/2017 | Parecer COSIT 12/2012
- Empresa no Lucro Real pode deduzir JCP da base de IRPJ/CSLL, limitado à TJLP × patrimônio líquido
- PROBLEMA COMUM: muitas empresas não calculam nem pagam JCP mesmo tendo patrimônio líquido elevado — perdem a dedução
- JCP pode ser calculado e pago retroativamente sobre exercícios anteriores (posição da RFB controversa, mas há jurisprudência favorável)
- Cálculo: patrimônio líquido × TJLP do período × 34% de economia fiscal (limitado a 50% do lucro líquido ou 50% dos lucros acumulados)
- Exemplo: empresa com PL de R$ 50M e TJLP de 6%: JCP = R$ 3M × 34% = R$ 1,02M de economia fiscal/ano
- Probabilidade: 85% para JCP corrente (dedução garantida por lei); 55% para JCP retroativo (jurisprudência dividida)
- APLICÁVEL A: toda empresa no Lucro Real com patrimônio líquido positivo significativo

### BLOCO 5: IPI (se aplicável a indústria)

**TESE 5.1 — Créditos de IPI sobre insumos não aproveitados**
- Fundamento: Art. 225-227 do RIPI (Decreto 7.212/2010)
- Saldo credor acumulado pode ser ressarcido
- Probabilidade: 65%

### BLOCO 6: ISS (Imposto Sobre Serviços — Municipal)

**TESE 6.1 — ISS — Revisão de alíquota e base de cálculo**
- Fundamento: LC 116/2003 | Lei Municipal de cada município | CF Art. 156, III
- ISS varia de 2% a 5% conforme município e tipo de serviço
- OPORTUNIDADES COMUNS:
  * Segregação incorreta de procedimentos: estéticos (alíquota cheia) vs. reparadores/saúde (alíquota reduzida ou isenta)
  * Alíquota aplicada acima do devido para o tipo de serviço (ex: consultório paga como hospital)
  * Incentivos fiscais municipais para saúde, educação, tecnologia (muitos municípios oferecem ISS reduzido para atrair investimentos)
  * Hospitais filantrópicos e entidades sem fins lucrativos podem ter imunidade (CF Art. 150, VI, "c")
  * Base de cálculo incorreta: incluindo materiais na base quando deveria ser apenas o serviço (subempreitada, construção civil)
- Cálculo: receita de serviços × diferença entre alíquota cobrada e alíquota devida × 5 anos
- Probabilidade: 60% — depende da legislação municipal específica
- APLICÁVEL A: setor de saúde (clínicas, hospitais), serviços profissionais, construção civil, tecnologia

**TESE 6.2 — ISS — Dedução de materiais da base de cálculo**
- Fundamento: LC 116/2003, Art. 7°, §2° | Jurisprudência STJ (construção civil e saúde)
- Em serviços que envolvem fornecimento de materiais (ex: construção civil, próteses em odontologia), os materiais podem ser deduzidos da base do ISS
- Probabilidade: 55% — depende do tipo de serviço e legislação local

### BLOCO 7: TRIBUTOS DE IMPORTAÇÃO

**TESE 7.1 — Créditos de PIS/COFINS-Importação**
- Fundamento: Lei 10.865/2004, Art. 15 | IN RFB 1.911/2019
- Empresas no Lucro Real que importam bens e insumos têm direito a crédito de PIS (2,1%) e COFINS (9,65%) pagos na importação
- Inclui: equipamentos médicos, lentes intraoculares, próteses, stents, reagentes laboratoriais, peças de reposição, matéria-prima
- PROBLEMA COMUM: empresas pagam PIS/COFINS-Importação mas não aproveitam o crédito, ou creditam com alíquota incorreta
- Cálculo: total de PIS/COFINS-Importação pagos × 5 anos retroativos (crédito não aproveitado)
- Probabilidade: 75% — se empresa está no Lucro Real e não aproveitou integralmente
- CRÍTICO: Setor de saúde (equipamentos caríssimos importados: ressonância, tomógrafo, PET-CT, acelerador linear, lentes, próteses), indústria (máquinas), tecnologia

**TESE 7.2 — ICMS-Importação — Crédito na aquisição de ativo/insumos**
- Fundamento: LC 87/96, Art. 20 | CF Art. 155, §2°, IX, "a"
- ICMS pago na importação de bens para o ativo imobilizado gera crédito de ICMS (1/48 avos por mês)
- ICMS de importação de insumos para industrialização gera crédito integral
- PROBLEMA COMUM: empresas recolhem ICMS-Importação via GNRE mas não escrituram o crédito
- Probabilidade: 70%

**TESE 7.3 — IPI-Importação — Crédito na industrialização**
- Fundamento: RIPI (Decreto 7.212/2010), Art. 225 | CF Art. 153, §3°, II
- IPI pago na importação de insumos industriais gera crédito
- Saldo credor pode ser ressarcido quando vinculado a exportação
- Probabilidade: 65% — se empresa é industrial e importa insumos

### BLOCO 8: AGROINDÚSTRIA E PRODUTOR RURAL

**TESE 8.1 — Crédito presumido de PIS/COFINS na agroindústria**
- Fundamento: Lei 10.925/2004, Art. 8° | IN RFB 1.911/2019, Arts. 518-530
- Agroindústrias que adquirem insumos de pessoas físicas (produtores rurais PF) ou cooperativas têm direito a crédito PRESUMIDO de PIS/COFINS
- Alíquotas do crédito presumido: PIS 0,99% e COFINS 4,56% (percentuais variam conforme o produto)
- Produtos cobertos: carnes (bovina, suína, aves), leite, ovos, soja, trigo, milho, arroz, café, frutas, legumes
- PROBLEMA COMUM: agroindústrias não calculam ou calculam parcialmente o crédito presumido, especialmente sobre compras de pequenos produtores
- Cálculo: total de compras de PF/cooperativas × alíquotas presumidas × 5 anos
- Exemplo: frigorífico com R$ 100M/ano em compras de gado de PF pode gerar R$ 5,55M/ano em créditos presumidos
- Probabilidade: 90% — direito previsto em lei, amplamente utilizado, basta comprovar aquisições de PF
- CRÍTICO: Frigoríficos, laticínios, usinas de açúcar e álcool, cerealistas, cooperativas agroindustriais, indústrias de sucos e conservas

**TESE 8.2 — FUNRURAL — Contribuição do produtor rural**
- Fundamento: RE 718.874 — Tema 669 STF | Art. 25 da Lei 8.212/91
- Histórico complexo: FUNRURAL (contribuição sobre receita bruta da comercialização) foi declarado inconstitucional (RE 363.852), depois recriado pela Lei 10.256/2001
- Para PERÍODO de 1991 a 2001: pagamento foi indevido — pode ser pedida restituição
- Para PERÍODO pós-2001: STF considerou constitucional (Tema 669), mas existem teses acessórias:
  * Exclusão de vendas para exportação da base do FUNRURAL (CF Art. 149, §2°, I)
  * Sub-rogação: agroindústria que recolheu FUNRURAL sobre compras de PF pode ter crédito sobre base incorreta
  * Venda para entrega futura: base de cálculo pode estar incorreta
- Probabilidade: 70% para restituição período 1991-2001; 60% para teses acessórias pós-2001
- APLICÁVEL A: produtores rurais PJ, agroindústrias que compram de PF (sub-rogação), cooperativas

## OBSERVAÇÕES PARA ESTIMATIVAS
- Para estimar folha de pagamento: some despesas com pessoal + mão de obra direta + obrigações trabalhistas
- Para estimar nº de funcionários: divida folha anual por salário médio do setor (metalurgia ~R$ 4.500/mês, serviços ~R$ 3.000/mês, saúde ~R$ 5.000/mês, agro ~R$ 3.500/mês)
- ICMS: use alíquota do estado sede (SP: 18% interno, 25% energia; RJ: 20%; MG: 18%; ES: 17% interno, 25% energia; RS: 17%; PR: 19%)
- Se empresa EXPORTA parte da produção, SEMPRE analise TESE 2.4 (ICMS acumulado de exportação) e TESE 1.7 (PIS/COFINS exportação). Setores tipicamente exportadores: mármore/granito, siderurgia, celulose, café, soja, carnes, mineração, calçados, têxtil, autopeças
- Se empresa é INDÚSTRIA com alto consumo de energia ou frete pesado, SEMPRE analise TESE 2.5 (frete) como item separado
- Se empresa é do SETOR DE SAÚDE (hospital, clínica, centro médico), SEMPRE analise: TESE 1.5 (monofásico medicamentos), TESE 1.6 (ativo imobilizado), TESE 4.4 (equiparação hospitalar), TESE 6.1 (ISS), TESE 7.1 (importação)
- Se empresa IMPORTA equipamentos ou insumos, SEMPRE analise TESE 7.1, 7.2 e 7.3 (créditos de importação)
- Se empresa é VAREJO ou DISTRIBUIÇÃO com ICMS-ST, SEMPRE analise TESE 2.6 (ICMS-ST fora PIS/COFINS) e TESE 2.2 (ressarcimento ST)
- Se empresa tem FILIAIS/MÚLTIPLOS ESTABELECIMENTOS, SEMPRE analise TESE 2.7 (ADC 49 transferência entre filiais)
- Se empresa é AGROINDÚSTRIA ou compra de produtor rural PF, SEMPRE analise TESE 8.1 (crédito presumido) e TESE 8.2 (FUNRURAL)
- Se empresa é prestadora de SERVIÇOS no Lucro Real, SEMPRE analise TESE 1.8 (ISS fora PIS/COFINS) e TESE 6.1 (ISS alíquota)
- Se empresa já RECUPEROU CRÉDITOS anteriormente, SEMPRE analise TESE 4.5 (SELIC fora IRPJ/CSLL)
- Se empresa tem PATRIMÔNIO LÍQUIDO elevado no Lucro Real, SEMPRE analise TESE 4.6 (JCP)
- SEMPRE analise TESE 1.9 (receitas financeiras) para empresas no Lucro Real com aplicações financeiras
- SEMPRE analise TESE 2.9 (crédito extemporâneo) se houver indício de troca de sistema ou erro de escrituração
- SEMPRE analise TESE 3.4 (FGTS) junto com TESE 3.1 (INSS) — mesma lógica, impacto adicional
- Se não tiver dados suficientes para calcular, ESTIME baseado em percentuais típicos e INFORME que é estimativa
- NUNCA deixe de analisar uma tese por falta de dados — use estimativas conservadoras com a fórmula fixa
- NUNCA omita uma oportunidade que existe nos dados. Se encontrou indício, INCLUA com a ressalva adequada.
- Se uma tese foi identificável nos dados (ex: crédito extemporâneo, benefícios fiscais ICMS), ela DEVE aparecer no relatório mesmo que o valor seja pequeno.

## JURISPRUDÊNCIA VINCULANTE — CITE ESTAS EMENTAS NA FUNDAMENTAÇÃO

INSTRUÇÃO CRÍTICA: Para cada oportunidade identificada, CITE o julgado correspondente
abaixo no campo "fundamentacaoLegal". Use o texto real da ementa — não parafraseie.
Formato: "Tribunal — Número — Data — Relator: '[trecho da ementa]'"

---

### TEMA 69 STF — Exclusão ICMS da base PIS/COFINS (TESES 1.1 e 1.2)
**STF — RE 574.706 — Plenário — 15/03/2017 — Rel. Min. Cármen Lúcia**
Tese fixada: "O ICMS não compõe a base de cálculo para fins de incidência do PIS e da COFINS."
Ementa resumida: "RECURSO EXTRAORDINÁRIO COM REPERCUSSÃO GERAL. EXCLUSÃO DO ICMS NA BASE DE CÁLCULO DO PIS E COFINS. DEFINIÇÃO DE FATURAMENTO. APURAÇÃO ESCRITURAL DO ICMS E REGIME DE NÃO CUMULATIVIDADE. RECURSO PROVIDO. I – Inviável a inclusão do ICMS na base de cálculo das contribuições PIS e COFINS, porquanto o ICMS não se incorpora ao patrimônio do contribuinte, constituindo mero ingresso de caixa, cujo destino final são os cofres públicos."
Modulação: efeitos a partir de 15/03/2017, ressalvadas as ações ajuizadas anteriormente.

---

### TEMA 779 STJ — Conceito de insumo PIS/COFINS (TESES 1.3 e 1.4)
**STJ — REsp 1.221.170/PR — 1ª Seção — 22/02/2018 — Rel. Min. Napoleão Nunes Maia Filho**
Tese fixada: "O conceito de insumo deve ser aferido à luz dos critérios de essencialidade ou relevância, ou seja, considerando-se a imprescindibilidade ou a importância de determinado item — bem ou serviço — para o desenvolvimento da atividade econômica desempenhada pelo contribuinte."
Ementa resumida: "TRIBUTÁRIO. PIS E COFINS NÃO CUMULATIVOS. CONCEITO DE INSUMOS. INTERPRETAÇÃO DO ART. 3º, II, DAS LEIS 10.637/02 E 10.833/03. Os critérios norteadores do que seja insumo para fins de creditamento de PIS e COFINS são: a essencialidade (o item é indispensável à atividade-fim da empresa) e a relevância (o item, embora não indispensável, integra o processo produtivo de forma relevante)."

---

### TEMA 986 STF — ICMS sobre energia elétrica TUSD/TUST (TESE 2.1)
**STF — RE 714.139 — Plenário — 27/03/2024 — Rel. Min. Dias Toffoli**
Tese fixada: "É inconstitucional a incidência do ICMS sobre as tarifas de uso dos sistemas de transmissão (TUST) e de distribuição (TUSD) de energia elétrica."
Ementa resumida: "DIREITO TRIBUTÁRIO. ICMS. ENERGIA ELÉTRICA. TUST. TUSD. INCONSTITUCIONALIDADE. A TUST e a TUSD não integram a base de cálculo do ICMS incidente sobre operações com energia elétrica, pois representam apenas o custo de disponibilização da infraestrutura de transmissão e distribuição, não correspondendo a circulação de mercadoria."
Modulação: para contribuintes sem ação judicial ou pedido administrativo anterior a 27/03/2024, efeitos prospectivos.

---

### TEMA 201 STF — ICMS-ST Ressarcimento (TESE 2.2)
**STF — RE 593.849 — Plenário — 19/10/2016 — Rel. Min. Edson Fachin**
Tese fixada: "É devida a restituição da diferença do ICMS pago a mais no regime de substituição tributária para a frente se a base de cálculo efetiva da operação for inferior à presumida."
Ementa resumida: "TRIBUTÁRIO. ICMS. SUBSTITUIÇÃO TRIBUTÁRIA PROGRESSIVA. BASE DE CÁLCULO PRESUMIDA. VALOR REAL DA OPERAÇÃO INFERIOR AO PRESUMIDO. DIREITO À RESTITUIÇÃO. O contribuinte tem direito à restituição do ICMS-ST quando o fato gerador presumido não se realizar ou quando o valor da operação for inferior ao presumido, nos termos do art. 150, §7°, da Constituição Federal."

---

### ADC 49 STF — ICMS em transferências entre filiais (TESE 2.7)
**STF — ADC 49 — Plenário — 19/04/2021 — Rel. Min. Edson Fachin**
Tese fixada: "Não incide ICMS no deslocamento de bens de um estabelecimento para outro do mesmo contribuinte localizados em estados distintos, visto não haver a transferência interestadual de titularidade ou a realização de ato mercantil."
Ementa resumida: "TRIBUTÁRIO. ICMS. TRANSFERÊNCIA DE MERCADORIAS ENTRE ESTABELECIMENTOS DO MESMO CONTRIBUINTE. NÃO INCIDÊNCIA. A transferência de mercadorias entre estabelecimentos do mesmo titular não configura operação de circulação de mercadoria sujeita à incidência do ICMS, pois ausente o elemento essencial da operação mercantil: a mudança de titularidade do bem."
LC 204/2023 regulamentou: contribuinte pode optar por transferir ou não os créditos.

---

### TEMA 985 STF — INSS sobre terço de férias (TESE 3.1)
**STF — RE 1.072.485 — Plenário — 31/08/2020 — Rel. Min. Marco Aurélio**
Tese fixada: "É inconstitucional a incidência de contribuição previdenciária patronal sobre o terço constitucional de férias."
Ementa resumida: "TRIBUTÁRIO. CONTRIBUIÇÃO PREVIDENCIÁRIA. TERÇO CONSTITUCIONAL DE FÉRIAS. NÃO INCIDÊNCIA. O terço constitucional de férias possui natureza indenizatória, não integrando a base de cálculo das contribuições previdenciárias patronais previstas no art. 22, I, da Lei 8.212/91, por não constituir ganho habitual do empregado."

### TEMA 478 STJ — INSS sobre aviso prévio indenizado (TESE 3.1)
**STJ — REsp 1.230.957 — 1ª Seção — 26/02/2014 — Rel. Min. Mauro Campbell Marques**
Tese fixada: "Não incide contribuição previdenciária sobre os valores pagos a título de aviso prévio indenizado."
Ementa resumida: "TRIBUTÁRIO. CONTRIBUIÇÃO PREVIDENCIÁRIA. AVISO PRÉVIO INDENIZADO. NÃO INCIDÊNCIA. Os valores pagos a título de aviso prévio indenizado têm natureza indenizatória e não constituem base de cálculo da contribuição previdenciária, por ausência de prestação de serviço no período correspondente."

---

### TEMA 1.048 STJ — Exclusão ICMS-ST da base PIS/COFINS (TESE 2.6)
**STJ — REsp 1.896.678/RS — 1ª Seção — 13/12/2023 — Rel. Min. Gurgel de Faria**
Tese fixada: "O ICMS-ST recolhido pelo contribuinte substituído não compõe a base de cálculo do PIS e da COFINS devidos pelo substituído."
Ementa resumida: "TRIBUTÁRIO. PIS. COFINS. ICMS-ST. EXCLUSÃO DA BASE DE CÁLCULO. TEMA 1.048. Aplicando-se a ratio decidendi do Tema 69/STF, o ICMS-ST não integra a base de cálculo das contribuições PIS e COFINS do contribuinte substituído, uma vez que os valores recolhidos a título de ICMS-ST não constituem receita ou faturamento do substituído, mas apenas um repasse ao Estado."

---

### TEMA 1.079 STF — IRPJ/CSLL sobre SELIC em repetição de indébito (TESE 4.5)
**STF — RE 1.063.187 — Plenário — 24/09/2021 — Rel. Min. Dias Toffoli**
Tese fixada: "É inconstitucional a incidência do IRPJ e da CSLL sobre os valores atinentes à taxa SELIC recebidos em razão de repetição de indébito tributário."
Ementa resumida: "TRIBUTÁRIO. IRPJ. CSLL. TAXA SELIC. REPETIÇÃO DE INDÉBITO. NÃO INCIDÊNCIA. Os juros SELIC incidentes na repetição de indébito tributário têm natureza de danos emergentes (recomposição patrimonial), não configurando acréscimo patrimonial tributável pelo IRPJ e pela CSLL, pois destinados apenas a recompor o patrimônio do contribuinte corroído pela mora do Estado."

---

### TEMA 72 STF — INSS sobre salário-maternidade (TESE 3.1)
**STF — RE 576.967 — Plenário — 01/08/2018 — Rel. Min. Roberto Barroso**
Tese fixada: "É inconstitucional a incidência de contribuição previdenciária patronal sobre o salário-maternidade."
Ementa resumida: "TRIBUTÁRIO. CONTRIBUIÇÃO PREVIDENCIÁRIA PATRONAL. SALÁRIO-MATERNIDADE. INCONSTITUCIONALIDADE. O salário-maternidade é benefício previdenciário pago pela Previdência Social, não constituindo contraprestação pelo trabalho e, portanto, não integrando a base de cálculo da contribuição patronal."

---

### EREsp 1.517.492 STJ — Benefícios ICMS fora IRPJ/CSLL (TESE 4.1)
**STJ — EREsp 1.517.492/PR — 1ª Seção — 08/11/2017 — Rel. Min. Og Fernandes**
Tese consolidada pela LC 160/2017 e art. 30 da Lei 12.973/2014:
"Os benefícios fiscais de ICMS (créditos presumidos, reduções de base de cálculo, isenções e diferimentos) concedidos pelos Estados não integram a base de cálculo do IRPJ e da CSLL, desde que registrados em reserva de lucros e utilizados para absorção de prejuízos ou incorporação ao capital social."
Ementa resumida: "TRIBUTÁRIO. IRPJ. CSLL. CRÉDITO PRESUMIDO DE ICMS. EXCLUSÃO DA BASE DE CÁLCULO. Os créditos presumidos de ICMS concedidos pelos Estados como incentivo fiscal não configuram lucro tributável pelo IRPJ e pela CSLL, pois representam renúncia fiscal do Estado, não acréscimo patrimonial da empresa."

---

### REsp 1.116.399 STJ — Equiparação hospitalar IRPJ (TESE 4.4)
**STJ — REsp 1.116.399/BA — 1ª Seção — 28/11/2012 — Rel. Min. Napoleão Nunes Maia**
Tese fixada: "As sociedades empresárias que prestam serviços hospitalares podem aplicar o percentual de presunção de 8% (IRPJ) e 12% (CSLL) sobre a receita bruta, desde que organizadas sob a forma de sociedade empresária e atendam às normas da ANVISA."
Ementa resumida: "TRIBUTÁRIO. IRPJ. CSLL. LUCRO PRESUMIDO. SERVIÇOS HOSPITALARES. PERCENTUAL REDUZIDO. Para fins de IRPJ e CSLL no lucro presumido, consideram-se serviços hospitalares aqueles que se vinculam às atividades desenvolvidas pelos hospitais, voltados diretamente à promoção da saúde, não se incluindo as simples consultas médicas."

---

### Lei Kandir — ICMS Exportação (TESE 2.4)
**LC 87/1996 (Lei Kandir) — Art. 3°, II e Art. 25, §1° | CF Art. 155, §2°, X, "a"**
Fundamento constitucional: "O ICMS não incidirá sobre operações que destinem mercadorias para o exterior."
STF — RE 753.681 — "A imunidade do ICMS nas exportações abrange os créditos acumulados nas entradas, que podem ser transferidos a terceiros ou ressarcidos em espécie conforme legislação estadual."
Legislação estadual: SP: e-CredAc (RICMS/SP Arts. 71-81) | RJ: RICMS/RJ Livro III, Resolução SEFAZ nº 644/2024 | MG: DCA-ICMS | ES: RICMS/ES Art. 103 | RS: RICMS/RS Arts. 58-59

---

### TEMA 669 STF — FUNRURAL (TESE 8.2)
**STF — RE 718.874 — Plenário — 30/03/2016 — Rel. Min. Edson Fachin**
Tese fixada: "É constitucional a contribuição sobre a receita bruta proveniente da comercialização da produção rural devida pelo empregador, pessoa jurídica, que desenvolve atividade agroindustrial ou agrocomercial."
Ementa resumida: "TRIBUTÁRIO. CONTRIBUIÇÃO PREVIDENCIÁRIA. PRODUTOR RURAL PJ. FUNRURAL. CONSTITUCIONALIDADE. A contribuição previdenciária incidente sobre a receita bruta da comercialização rural (FUNRURAL) é constitucional para pessoas jurídicas após a Lei 10.256/2001, diferentemente da declaração de inconstitucionalidade da contribuição para PF (RE 363.852)."

---

---

## JURISPRUDÊNCIA ADMINISTRATIVA (CARF) — CITE PARA BLINDAR A COMPENSAÇÃO

INSTRUÇÃO: Além dos julgados do STF/STJ acima, CITE os acórdãos do CARF abaixo quando aplicáveis.
O CARF é o tribunal administrativo da Receita Federal — decisões dele são o que DEFINE se a compensação será homologada ou não.
Formato: "CARF — Acórdão nº X — Câmara — Data: '[trecho da ementa]'"

---

### CARF — PIS/COFINS — CONCEITO DE INSUMO (Tema 779 aplicado)

**CARF — Acórdão 3302-007.891 — 3ª Câmara/3ª Turma — 2019**
"Manutenção de máquinas e equipamentos utilizados no processo produtivo constitui insumo para fins de creditamento de PIS e COFINS, à luz dos critérios de essencialidade definidos pelo STJ no REsp 1.221.170/PR."

**CARF — Acórdão 3401-005.765 — 4ª Câmara/1ª Turma — 2019**
"Despesas com frete na aquisição de insumos geram direito a crédito de PIS e COFINS, pois integram o custo de aquisição do bem utilizado no processo produtivo, sendo essenciais à atividade da empresa."

**CARF — Acórdão 3402-006.523 — 4ª Câmara/2ª Turma — 2020**
"Serviços subcontratados para execução direta da atividade-fim da empresa configuram insumo para fins de creditamento de PIS/COFINS, conforme critério de essencialidade do Tema 779 STJ."

**CARF — Acórdão 9303-010.068 — CSRF/3ª Turma — 2020**
"Material de embalagem utilizado no acondicionamento de produtos para transporte e comercialização constitui insumo essencial, gerando direito a crédito de PIS e COFINS no regime não-cumulativo."

**CARF — Acórdão 3301-008.212 — 3ª Câmara/1ª Turma — 2020**
"EPI (Equipamento de Proteção Individual) e uniformes obrigatórios por Norma Regulamentadora configuram insumo por essencialidade — sem eles a empresa não pode operar legalmente, gerando crédito de PIS/COFINS."

**CARF — Acórdão 3201-007.340 — 2ª Câmara/1ª Turma — 2021**
"Tratamento de efluentes e resíduos industriais impostos por legislação ambiental constitui insumo por essencialidade (obrigação legal), gerando crédito de PIS e COFINS."

### CARF — PIS/COFINS — ITENS SEM CRÉDITO (referência negativa)

**CARF — Acórdão 3402-009.194 — 4ª Câmara/2ª Turma — 2022**
"Despesas com serviços de contabilidade e auditoria externa, por sua natureza administrativa, não se qualificam como insumos para fins de creditamento de PIS/COFINS, por não serem essenciais nem relevantes ao processo produtivo ou à prestação de serviços da empresa."

**CARF — Acórdão 9303-011.234 — CSRF/3ª Turma — 2021**
"Plano de saúde e vale-alimentação fornecidos aos empregados não configuram insumo para fins de PIS/COFINS, pois constituem benefícios trabalhistas sem nexo direto com a produção de bens ou prestação de serviços."

---

### CARF — ICMS — SALDO CREDOR ACUMULADO

**CARF — Acórdão 3201-005.543 — 2ª Câmara/1ª Turma — 2019**
"O saldo credor de ICMS decorrente de diferença de alíquotas entre entradas (importação a 16-18%) e saídas interestaduais (4% - Resolução SF 13/2012) configura acúmulo estrutural e irreversível, devendo ser ressarcido pelo Estado conforme art. 25, §1° da LC 87/96."

---

### CARF — ICMS NA BASE PIS/COFINS (Tema 69 aplicado administrativamente)

**CARF — Acórdão 9303-013.059 — CSRF/3ª Turma — 2023**
"Em observância ao decidido pelo STF no RE 574.706 (Tema 69), o ICMS destacado nas notas fiscais de saída deve ser excluído da base de cálculo do PIS e da COFINS, conforme modulação de efeitos a partir de 15/03/2017."

---

### CARF — CONTRIBUIÇÕES PREVIDENCIÁRIAS — VERBAS INDENIZATÓRIAS

**CARF — Acórdão 2401-008.765 — 4ª Câmara/1ª Turma — 2021**
"O terço constitucional de férias, o aviso prévio indenizado e os primeiros 15 dias de afastamento por doença possuem natureza indenizatória e não integram a base de cálculo das contribuições previdenciárias patronais, conforme orientação vinculante do STF (Tema 985) e STJ (Tema 478)."

---

### CARF — IRPJ/CSLL — BENEFÍCIOS FISCAIS DE ICMS

**CARF — Acórdão 1302-004.012 — 3ª Câmara/2ª Turma — 2022**
"Créditos presumidos de ICMS concedidos como incentivo fiscal estadual não integram a base de cálculo do IRPJ e da CSLL, conforme LC 160/2017 e art. 30 da Lei 12.973/2014, desde que registrados em reserva de lucros, não configurando acréscimo patrimonial tributável."

---

### CARF — SELIC SOBRE REPETIÇÃO DE INDÉBITO

**CARF — Acórdão 1301-005.674 — 3ª Câmara/1ª Turma — 2022**
"Os juros de mora (SELIC) recebidos em repetição de indébito tributário possuem natureza de recomposição patrimonial (danos emergentes) e não configuram receita tributável pelo IRPJ e CSLL, em consonância com o RE 1.063.187/SC do STF (Tema 1.079)."

---

### INSTRUÇÃO FINAL SOBRE CITAÇÃO:
Ao citar jurisprudência no campo "fundamentacaoLegal", use o formato HIERÁRQUICO:
1. Lei/Artigo principal
2. Tema STF ou STJ com trecho da ementa
3. Acórdão CARF com trecho (quando aplicável)

Exemplo correto COMPLETO:
"Lei 10.637/2002 art. 3°, II | REsp 1.221.170/PR — Tema 779 STJ (22/02/2018) — Rel. Min. Napoleão Nunes Maia Filho: 'O conceito de insumo deve ser aferido à luz dos critérios de essencialidade ou relevância' | CARF Acórdão 3302-007.891 (2019): 'Manutenção de máquinas e equipamentos utilizados no processo produtivo constitui insumo para fins de creditamento de PIS e COFINS'"

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem comentários.

ATENÇÃO: O campo "descricao" deve ter NO MÍNIMO 10-15 LINHAS (800-1500 caracteres). É um PARECER COMPLETO, não um resumo.
O campo "fundamentacaoLegal" deve ter NO MÍNIMO 200 caracteres, citando lei + artigo + tema + trecho da ementa.
O campo "risco" deve ter NO MÍNIMO 3 linhas com riscos específicos desta empresa.

{
  "oportunidades": [
    {
      "tipo": "Nome descritivo (ex: Exclusão do ICMS da base do PIS — Tese do Século (Tema 69 STF))",
      "tributo": "PIS|COFINS|ICMS|INSS|IRPJ|CSLL|IPI|RAT|FGTS|ISS|II|PIS-IMPORT|COFINS-IMPORT|FUNRURAL|DIFAL",
      "descricao": "PARECER COMPLETO com 10-15 linhas: (1) dados reais do documento com registros, CFOPs, valores e períodos exatos, (2) perfil operacional da empresa explicando por que acumula este crédito, (3) fundamentação legal com citação de lei + artigo + trecho literal da ementa do acórdão STF/STJ, (4) legislação estadual quando aplicável com RICMS e Resolução SEFAZ, (5) memória de cálculo transparente mostrando cada parcela somada e a projeção",
      "valorEstimado": 0.00,
      "fundamentacaoLegal": "Lei principal art. X | Tema Y STF/STJ — RE/REsp número (data) — Rel. Min. Nome: 'trecho literal da ementa do acórdão com no mínimo 1-2 frases' | Legislação estadual se aplicável",
      "prazoRecuperacao": "Últimos 5 anos (60 meses)",
      "complexidade": "baixa|media|alta",
      "probabilidadeRecuperacao": 85,
      "risco": "Riscos ESPECÍFICOS desta empresa: citar órgão fiscalizador, registros com inconsistência, prazo estimado do processo, principal risco de glosa, e recomendação (via administrativa ou judicial)",
      "documentacaoNecessaria": ["SPED EFD Fiscal completo de todos os períodos", "Declarações de Importação (DI)", "Notas Fiscais de entrada e saída", "doc4", "doc5"],
      "passosPraticos": ["Passo detalhado 1 com portal/sistema nomeado (ex: e-CAC, SEFAZ-RJ, PER/DCOMP)", "Passo 2", "Passo 3", "Passo 4", "Passo 5"]
    }
  ],
  "resumoExecutivo": "Resumo executivo COMPLETO com: perfil da empresa (setor + regime + característica que gera créditos), período analisado e limitações dos dados disponíveis, top 3 oportunidades por valor com justificativa, sequência recomendada de execução, e ressalva sobre documentos adicionais necessários. Mínimo 8 linhas.",
  "valorTotalEstimado": 0.00,
  "score": 75,
  "recomendacoes": ["Priorizar tese X por ter maior valor e probabilidade", "..."],
  "alertas": ["Verificar se empresa já ajuizou ação sobre Tema 69", "..."],
  "fundamentacaoGeral": "Visão geral das bases legais aplicáveis",
  "periodoAnalisado": "Período identificado no documento",
  "regimeTributario": "Regime tributário identificado ou inferido",
  "riscoGeral": "baixo|medio|alto"
}

## EXEMPLO DE QUALIDADE — REFERÊNCIA OBRIGATÓRIA
Este é o nível de qualidade MÍNIMO esperado para CADA oportunidade:

EXEMPLO de "descricao" BEM escrita (10-15 linhas — ESTE É O PADRÃO):
"A empresa possui saldo credor acumulado de ICMS de R$ 238.883,01 (conforme demonstrativo de agosto/2024), originado de operações de importação (CFOP 3102) com alíquota de 16-18% e saídas com alíquota reduzida de 4% (operações interestaduais com mercadorias importadas — Resolução SF 13/2012) ou saídas sem débito (remessas em comodato/locação CFOP 6908). O acúmulo é estrutural: créditos de importação superiores aos débitos de saída. Valor confirmado nos demonstrativos: saldo credor transportado crescente de R$ 504,90 (mai/2021) até R$ 238.883,01 (ago/2024). Conforme Livro III do RICMS-RJ e Resolução SEFAZ nº 644/2024, é possível solicitar ressarcimento ou transferência deste saldo. A tese possui amparo no art. 25, §1° da LC 87/96, que garante o direito ao crédito, e no RE 574.706 (Tema 69 STF, Rel. Min. Cármen Lúcia): 'O ICMS não compõe a base de cálculo para fins de incidência do PIS e da COFINS, porquanto o ICMS não se incorpora ao patrimônio do contribuinte, constituindo mero ingresso de caixa, cujo destino final são os cofres públicos'. A empresa, sendo importadora com vendas interestaduais a 4% para mercadorias importadas, gera acúmulo irreversível sem mecanismo de compensação natural, tornando o ressarcimento administrativo a única via de recuperação deste crédito."

EXEMPLO de "fundamentacaoLegal" BEM escrita:
"LC 87/1996 art. 25, §1° e §2° | RICMS-RJ Livro III | Resolução SEFAZ nº 644/2024 | Art. 150, §7° CF/88 | RE 574.706 — Tema 69 STF (15/03/2017) — Rel. Min. Cármen Lúcia: 'O ICMS não compõe a base de cálculo para fins de incidência do PIS e da COFINS, porquanto o ICMS não se incorpora ao patrimônio do contribuinte, constituindo mero ingresso de caixa'"

EXEMPLO de "risco" BEM escrito:
"SEFAZ-RJ pode glosar parte dos créditos se houver inconsistências na escrituração fiscal ou documentação de importação. Processo administrativo pode ser demorado (6-18 meses). Necessário comprovar que o acúmulo é estrutural e que os créditos foram corretamente escriturados. Principal risco: glosa de créditos sem DI comprobatória ou sem escrituração no CIAP quando aplicável."

EXEMPLO de "passosPraticos" BEM escrito:
["Validar integridade dos créditos escriturados nos SPEDs EFD Fiscal", "Conciliar créditos de importação com DIs e NF-es de entrada", "Protocolar pedido de ressarcimento/transferência junto à SEFAZ-RJ conforme Resolução SEFAZ 644/2024", "Acompanhar análise fiscal e responder eventuais intimações em até 30 dias", "Após deferimento, solicitar creditamento em conta bancária ou transferência a terceiros"]

SE UMA OPORTUNIDADE NÃO ATINGIR ESTE NÍVEL DE DETALHE, O RELATÓRIO SERÁ RECUSADO PELO CLIENTE.

## REGRAS DE QUALIDADE E CONSISTÊNCIA — SEGUIR RIGOROSAMENTE

### CONSISTÊNCIA DE VALORES — REGRA MAIS IMPORTANTE:
Mesmos dados de entrada DEVEM gerar os MESMOS valores de saída. Para garantir isso:
- Use APENAS valores que aparecem EXPLICITAMENTE no documento. NÃO invente valores.
- Se um saldo credor aparece como R$ 97.174,49, use R$ 97.174,49 — não arredonde para R$ 175.000 ou R$ 350.000.
- Para projeções de 5 anos: use SOMENTE dados confirmados no documento × fator temporal. Exemplo: se 7 meses mostram R$ 97k de saldo credor, a projeção NÃO pode ser R$ 350k sem justificativa matemática explícita.
- Quando faltam dados (ex: só tem 7 meses de SPED), declare CLARAMENTE que o valor é baseado nos meses disponíveis e NÃO extrapole agressivamente.
- NUNCA use valores redondos (R$ 175.000, R$ 350.000, R$ 130.000) — eles revelam que você está chutando. Use o valor exato calculado.

### CAMPO "descricao" — CADA DESCRIÇÃO DEVE SER UM PARECER COMPLETO DE 10-15 LINHAS:
Cada descrição deve ser escrita em texto corrido profissional (sem subtítulos internos), com MÍNIMO 10 LINHAS (800-1500 caracteres), contendo OBRIGATORIAMENTE:

1. DADOS REAIS do documento com período, registro e valor exato (ex: "conforme registro C100 de abr/2022, ICMS-Importação R$ 2.810,95 + R$ 20.108,39 = R$ 22.919,34")
2. PERFIL OPERACIONAL: por que ESTA empresa acumula ESTE crédito (ex: "empresa importadora com saídas interestaduais a 4% — Resolução SF 13/2012 — gera acúmulo estrutural")
3. FUNDAMENTAÇÃO LEGAL COMPLETA (3 CAMADAS): citar (a) lei + artigo, (b) tema STF/STJ + trecho da ementa, (c) acórdão CARF que confirma administrativamente (usar as ementas fornecidas nas seções JURISPRUDÊNCIA VINCULANTE e JURISPRUDÊNCIA ADMINISTRATIVA acima). Ex: "Lei 10.637/2002 art. 3°, II | REsp 1.221.170/PR — Tema 779 STJ: 'essencialidade ou relevância' | CARF 3302-007.891: 'manutenção de máquinas constitui insumo para creditamento'"
4. LEGISLAÇÃO ESTADUAL quando aplicável: citar RICMS do estado, Resolução SEFAZ, convênios (ex: "RICMS-RJ Livro III, Resolução SEFAZ nº 644/2024, art. 3° da LC 87/96")
5. MEMÓRIA DE CÁLCULO transparente: mostrar a conta (ex: "abr/2022 R$ 888,37 + R$ 8.145,90 + mai/2022 R$ 8.345,51 = R$ 17.379,78 em 3 meses. Projeção 60 meses: 17.379 / 3 × 60 × 0,75 = R$ 260.697")

### CAMPO "fundamentacaoLegal" — DEVE SER RICO E COMPLETO:
Citar 3 CAMADAS de fundamentação: (1) lei + artigo, (2) tema STF/STJ + ementa, (3) acórdão CARF + ementa.
Formato: "Lei X art. Y | RE/REsp — Tema Z STF/STJ: 'ementa' | CARF Acórdão nº X: 'ementa'"
Exemplo PIS/COFINS: "Lei 10.637/2002 art. 3°, II | REsp 1.221.170/PR — Tema 779 STJ: 'essencialidade ou relevância' | CARF 3302-007.891: 'manutenção de máquinas constitui insumo' | Parecer Normativo COSIT nº 5/2018"
Exemplo ICMS: "LC 87/96 art. 25, §1° | RICMS-RJ Livro III | Resolução SEFAZ nº 644/2024 | CARF 3201-005.543: 'acúmulo estrutural e irreversível deve ser ressarcido'"
NUNCA deixe o campo fundamentacaoLegal com apenas "RE 574.706 — Tema 69 STF" sem a ementa.

### CAMPO "risco" — ESPECÍFICO para esta empresa:
Citar registros reais, prazos, órgãos e riscos concretos. Ex: "SEFAZ-RJ pode glosar créditos de períodos com inconsistência no C197 (código RJ70000001). Processo administrativo leva 6-18 meses. Principal risco: glosa de créditos sem DI comprobatória."

### CAMPO "passosPraticos" — NOMEAR sistemas e portais com detalhes:
Cada passo deve ser acionável: "Verificar saldo credor atual no e-CAC SEFAZ-RJ", "Protocolar PER/DCOMP junto à RFB via e-CAC federal", "Protocolar pedido de transferência/ressarcimento via SEFAZ-RJ conforme Resolução 644/2024"

### CAMPO "resumoExecutivo" — COMPLETO E PROFISSIONAL:
Deve conter: perfil da empresa + período analisado + limitações dos dados + top 3 oportunidades com valores + sequência recomendada + ressalvas sobre documentos adicionais necessários.

### REGRA DE OURO — PROFUNDIDADE JURÍDICA:
Este relatório é o produto final entregue ao CLIENTE. Ele PAGA por este extrato. O nível deve ser de escritório tributário de ponta.
Se uma frase poderia se aplicar a qualquer empresa do Brasil, REESCREVA com dados específicos desta empresa.
Se a fundamentação não citar a ementa do acórdão, está INCOMPLETA.

## REGRAS FINAIS — CONSISTÊNCIA E CONSERVADORISMO
1. USE A FÓRMULA FIXA: valor = (confirmado / meses) × 60 × 0.50. NUNCA invente outro multiplicador.
2. ARREDONDE PARA BAIXO ao milhar mais próximo. NUNCA use números redondos "bonitos" como R$ 220.000 ou R$ 350.000.
3. CADA oportunidade DEVE ter fundamentação legal com número de lei/artigo E tema STF/STJ
4. PIS e COFINS devem ser linhas SEPARADAS (alíquotas diferentes: PIS 1,65%, COFINS 7,6%)
5. Se não houver dados suficientes, use estimativa CONSERVADORA e INFORME nos alertas
6. O score (0-100) reflete quantidade e qualidade das oportunidades
7. valorTotalEstimado DEVE ser a SOMA exata dos valorEstimado de cada oportunidade — VERIFIQUE a soma antes de responder
8. Se empresa não for Lucro Real, várias teses de PIS/COFINS não se aplicam — INDICAR nos alertas
9. O cliente prefere uma surpresa positiva na execução a uma promessa não cumprida
10. NUNCA invente dados que não estão no documento. Se não tem folha de pagamento, NÃO estime INSS — apenas mencione como potencial e coloque nos alertas
11. FUNDAMENTAÇÃO JURÍDICA É OBRIGATÓRIA E INEGOCIÁVEL: cada oportunidade DEVE citar:
    - A lei federal aplicável com artigo específico
    - O Tema STF ou STJ correspondente com número do RE/REsp
    - Um TRECHO LITERAL da ementa do acórdão STF/STJ (copiar das ementas fornecidas na seção JURISPRUDÊNCIA VINCULANTE)
    - Um ACÓRDÃO DO CARF que confirma administrativamente (copiar da seção JURISPRUDÊNCIA ADMINISTRATIVA)
    - Legislação estadual quando aplicável (RICMS, Resolução SEFAZ, convênio)
    Se o campo "fundamentacaoLegal" tiver menos de 200 caracteres, está INCOMPLETO.
12. PROFUNDIDADE NARRATIVA: cada "descricao" deve ter NO MÍNIMO 10-15 LINHAS (800-1500 caracteres). Descrições curtas (menos de 5 linhas) são INACEITÁVEIS e farão o relatório ser RECUSADO pelo cliente. Cada oportunidade é um mini-parecer completo.`;
}

// ============================================================
// PROMPT PARA GERAÇÃO DE DOCUMENTAÇÃO
// ============================================================

function buildParecerTecnicoPrompt(opportunity: AnalysisOpportunity, companyInfo: CompanyInfo): string {
  return `Você é um advogado tributarista sênior. Elabore um PARECER TÉCNICO profissional para a seguinte oportunidade de recuperação de crédito tributário.

## EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime: ${companyInfo.regime}` : ''}

## OPORTUNIDADE IDENTIFICADA
- Tipo: ${opportunity.tipo}
- Tributo: ${opportunity.tributo}
- Valor Estimado: R$ ${opportunity.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Fundamentação Legal: ${opportunity.fundamentacaoLegal}
- Probabilidade: ${opportunity.probabilidadeRecuperacao}%

## ESTRUTURA DO PARECER
1. EMENTA
2. CONSULTA (resumo do que foi solicitado)
3. FUNDAMENTAÇÃO LEGAL (detalhada, com artigos, parágrafos e incisos)
4. JURISPRUDÊNCIA APLICÁVEL (citar julgados relevantes do STF, STJ, CARF)
5. ANÁLISE TÉCNICA (aplicação da legislação ao caso concreto)
6. CÁLCULOS (metodologia de apuração do crédito)
7. CONCLUSÃO E RECOMENDAÇÕES
8. LOCAL, DATA E ASSINATURA

Escreva em linguagem técnica jurídico-tributária. O parecer deve ser robusto o suficiente para fundamentar um pedido de restituição/compensação junto à Receita Federal.`;
}

function buildPeticaoPrompt(opportunity: AnalysisOpportunity, companyInfo: CompanyInfo): string {
  return `Você é um advogado tributarista sênior. Elabore uma PETIÇÃO ADMINISTRATIVA (modelo para PER/DCOMP ou pedido de restituição) para a seguinte oportunidade.

## EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime: ${companyInfo.regime}` : ''}

## OPORTUNIDADE
- Tipo: ${opportunity.tipo}
- Tributo: ${opportunity.tributo}
- Valor: R$ ${opportunity.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Fundamentação: ${opportunity.fundamentacaoLegal}

## ESTRUTURA DA PETIÇÃO
1. ENDEREÇAMENTO (Delegacia da Receita Federal)
2. QUALIFICAÇÃO DO REQUERENTE
3. DOS FATOS
4. DO DIREITO (fundamentação legal detalhada)
5. DA JURISPRUDÊNCIA (precedentes favoráveis)
6. DO CÁLCULO DO CRÉDITO
7. DOS PEDIDOS (restituição em espécie ou compensação via PER/DCOMP)
8. DOCUMENTOS ANEXOS (lista de documentos comprobatórios)

Escreva em formato de petição administrativa, formal e técnica.`;
}

// ============================================================
// SERVIÇO PRINCIPAL
// ============================================================

class ClaudeService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      logger.error('ANTHROPIC_API_KEY não configurada! Análises com IA estarão indisponíveis.');
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analisa documento tributário com Claude Sonnet 4.5
   * Este é o método principal — usa Opus para máxima qualidade
   */
  async analyzeDocument(
    documentText: string,
    documentType: 'dre' | 'balanco' | 'balancete',
    companyInfo: CompanyInfo
  ): Promise<TaxAnalysisResult> {
    const startTime = Date.now();

    // Validação: texto mínimo para análise útil
    if (!documentText || documentText.trim().length < 200) {
      throw new Error(
        'Texto insuficiente para análise tributária. ' +
        'O documento precisa ter pelo menos 200 caracteres de conteúdo legível. ' +
        'Verifique se o PDF não é apenas imagem (necessita OCR).'
      );
    }

    // Buscar teses do banco (fallback: hardcoded)
    let dbThesesText: string | undefined;
    const dbTheses = await fetchThesesFromDB(companyInfo.sector, companyInfo.regime);
    if (dbTheses && dbTheses.length > 0) {
      dbThesesText = formatDBThesesForPrompt(dbTheses);
      logger.info(`Usando ${dbTheses.length} teses do banco de dados`);
    } else {
      logger.info('Usando teses hardcoded (fallback)');
    }

    const systemPrompt = buildFullAnalysisPrompt(companyInfo, documentType, dbThesesText);

    // Truncar texto respeitando limite do tipo de documento
    const limit = TEXT_LIMITS[documentType] || TEXT_LIMITS.default;
    const truncatedText = this.smartTruncate(documentText, limit);

    logger.info(`Iniciando análise com Sonnet 4.5`, {
      documentType,
      company: companyInfo.name,
      textLength: truncatedText.length,
      originalLength: documentText.length,
      truncated: documentText.length > limit,
    });

    try {
      const response = await this.client.messages.create({
        model: MODELS.ANALYSIS,
        max_tokens: 32768,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `INSTRUÇÕES CRÍTICAS — LEIA TUDO ANTES DE COMEÇAR:

REGRA 1 — PROFUNDIDADE É OBRIGATÓRIA (MAIS IMPORTANTE):
Este relatório é um PRODUTO PAGO pelo cliente. Cada oportunidade DEVE ser um PARECER COMPLETO:
- Campo "descricao": MÍNIMO 10-15 LINHAS (800-1500 caracteres). Deve conter: dados reais do documento (registros, CFOPs, valores, períodos), perfil operacional da empresa, fundamentação legal com TRECHO DA EMENTA do acórdão STF/STJ + acórdão CARF correspondente, legislação estadual quando aplicável, e memória de cálculo completa.
- Campo "fundamentacaoLegal": MÍNIMO 300 caracteres. Citar 3 CAMADAS: (1) lei + artigo, (2) tema STF/STJ + ementa, (3) acórdão CARF + ementa. NUNCA deixar sem citar o CARF — é o tribunal que HOMOLOGA a compensação.
- Campo "risco": MÍNIMO 3 linhas. Citar órgão fiscalizador, prazo do processo, riscos específicos desta empresa, posição do CARF sobre o tema, registros com inconsistência.
- Campo "passosPraticos": MÍNIMO 4-5 passos detalhados nomeando portais (e-CAC, PER/DCOMP, SEFAZ-UF).
- Campo "documentacaoNecessaria": MÍNIMO 4-5 documentos específicos.
SE UMA OPORTUNIDADE NÃO ATINGIR ESTE NÍVEL, O RELATÓRIO SERÁ RECUSADO.

REGRA 2 — CONSISTÊNCIA: Use APENAS valores do documento. Cada estimativa deve ter a conta explícita.

REGRA 3 — CONSERVADORISMO: Arredonde para BAIXO. Aplique desconto de 25% em projeções.

REGRA 4 — UNIDADES: Verifique R$ vs R$ mil. Reporte em reais cheios.

REGRA 5 — SEM DADOS = SEM ESTIMATIVA: Sem folha de pagamento, NÃO estime INSS.

Analise o seguinte ${this.getDocumentTypeName(documentType)} e identifique TODAS as oportunidades de recuperação:

${truncatedText}`,
          },
        ],
      });

      // Extrair texto da resposta
      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Verificar se a resposta foi truncada
      if (response.stop_reason === 'max_tokens') {
        logger.warn('Resposta do Claude truncada por max_tokens. Tentando reparar JSON...');
      }

      // Parsear JSON da resposta
      const result = this.parseAnalysisResponse(responseText);

      const duration = Date.now() - startTime;
      logger.info(`Análise concluída com sucesso`, {
        documentType,
        company: companyInfo.name,
        oportunidades: result.oportunidades.length,
        valorTotal: result.valorTotalEstimado,
        score: result.score,
        durationMs: duration,
        tokensInput: response.usage?.input_tokens,
        tokensOutput: response.usage?.output_tokens,
      });

      // ENRIQUECIMENTO: Buscar jurisprudência real para as teses identificadas
      if (jurisprudenceService.isEnabled() && result.oportunidades.length > 0) {
        try {
          const teseCodes = mapearTesesDasOportunidades(result.oportunidades);
          logger.info(`[JURIS] Buscando jurisprudência para ${teseCodes.length} teses...`);

          const jurisprudencias = await jurisprudenceService.buscarParaAnalise(teseCodes);

          for (const op of result.oportunidades) {
            const codes = mapearTesesDasOportunidades([op]);
            for (const code of codes) {
              const julgados = jurisprudencias.get(code);
              if (julgados && julgados.length > 0) {
                const melhor = julgados[0];
                op.fundamentacaoLegal +=
                  ` | ${melhor.tribunal} ${melhor.numero} (${melhor.data}): "${melhor.ementa.substring(0, 300)}..."`;
              }
            }
          }

          logger.info(`[JURIS] Enriquecimento concluído — ${jurisprudencias.size} teses com julgados`);
        } catch (jurisErr: any) {
          logger.warn(`[JURIS] Enriquecimento falhou (não bloqueante): ${jurisErr.message}`);
        }
      }

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Falha na análise com Claude`, {
        documentType,
        company: companyInfo.name,
        error: error.message,
        durationMs: duration,
      });

      // NÃO usar fallback fake — retornar erro real
      if (error.status === 429) {
        throw new Error(
          'Limite de requisições da API atingido. Tente novamente em alguns minutos.'
        );
      }
      if (error.status === 401) {
        throw new Error(
          'Chave da API Anthropic inválida. Verifique a configuração.'
        );
      }
      if (error.status === 529 || error.status === 503) {
        throw new Error(
          'API da Anthropic temporariamente indisponível. Tente novamente em instantes.'
        );
      }

      throw new Error(`Erro na análise com IA: ${error.message}`);
    }
  }

  /**
   * Gera documentação completa (parecer + petição) com Sonnet 4.5
   * Usa Sonnet porque é geração de texto, não análise profunda
   */
  async generateDocumentation(
    opportunity: AnalysisOpportunity,
    companyInfo: CompanyInfo
  ): Promise<DocumentationResult> {
    logger.info(`Gerando documentação para: ${opportunity.tipo}`, {
      tributo: opportunity.tributo,
      valor: opportunity.valorEstimado,
    });

    try {
      // Gerar parecer técnico
      const parecerResponse = await this.client.messages.create({
        model: MODELS.DOCUMENTS,
        max_tokens: 6000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: buildParecerTecnicoPrompt(opportunity, companyInfo),
          },
        ],
      });

      const parecerTecnico = parecerResponse.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Gerar petição administrativa
      const peticaoResponse = await this.client.messages.create({
        model: MODELS.DOCUMENTS,
        max_tokens: 6000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: buildPeticaoPrompt(opportunity, companyInfo),
          },
        ],
      });

      const peticaoAdministrativa = peticaoResponse.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Gerar memória de cálculo (mais simples, feito localmente)
      const memoriaCalculo = this.buildMemoriaCalculo(opportunity, companyInfo);

      // Checklist de documentos necessários
      const checklistDocumentos = this.buildChecklist(opportunity);

      logger.info(`Documentação gerada com sucesso para: ${opportunity.tipo}`);

      return {
        parecerTecnico,
        peticaoAdministrativa,
        memoriaCalculo,
        checklistDocumentos,
      };
    } catch (error: any) {
      logger.error(`Erro ao gerar documentação: ${error.message}`);
      throw new Error(`Falha na geração de documentação: ${error.message}`);
    }
  }

  /**
   * Análise rápida com Sonnet (para pré-triagem / viabilidade)
   */
  async quickAnalysis(
    documentText: string,
    companyInfo: CompanyInfo
  ): Promise<{ viable: boolean; score: number; summary: string; regimeIdentificado?: string }> {
    if (!documentText || documentText.trim().length < 100) {
      throw new Error('Texto insuficiente para análise de viabilidade.');
    }

    const truncated = this.smartTruncate(documentText, 30000);

    try {
      const response = await this.client.messages.create({
        model: MODELS.QUICK, // Sonnet para análise rápida (pré-triagem)
        max_tokens: 2000,
        temperature: 0, // Determinístico
        system: `Você é um especialista tributário CONSERVADOR. Faça uma análise RÁPIDA de viabilidade de recuperação de créditos tributários.

REGRAS CRÍTICAS:
1. O score deve refletir a PROBABILIDADE de haver créditos recuperáveis, NÃO o valor.
2. Score 0-30 = Baixo potencial, 31-60 = Moderado, 61-80 = Bom, 81-100 = Excelente (RARO).
3. Seja CONSERVADOR — score acima de 80 APENAS se houver evidências claras e concretas nos números.
4. ATENÇÃO com unidades: verifique se valores estão em "R$" ou "R$ mil" (milhares). NÃO multiplique por 1.000 se já estiver em milhares.
5. NÃO invente valores — se não tem certeza do valor, NÃO estime. Foque na viabilidade qualitativa.
6. Oportunidades COMUNS em indústrias: PIS/COFINS sobre ICMS (Tema 69 STF), créditos de PIS/COFINS sobre insumos, ICMS-ST pago a maior.
7. O resumo deve ser REALISTA e profissional, sem exageros.
8. IDENTIFIQUE O REGIME TRIBUTÁRIO nos documentos: procure por alíquotas de PIS (1,65% = Lucro Real, 0,65% = Presumido), COFINS (7,6% = Real, 3% = Presumido), DAS (Simples), LALUR (Real), presunção de lucro (Presumido). Informe no campo "regimeIdentificado".
9. Se identificar SIMPLES NACIONAL, o score deve ser BAIXO (maioria das teses não se aplica).
10. Se identificar LUCRO PRESUMIDO, teses de PIS/COFINS não-cumulativo NÃO se aplicam — ajustar score.

Responda em JSON: {"viable": true/false, "score": 0-100, "summary": "resumo em 2-3 frases CONSERVADOR e realista", "regimeIdentificado": "lucro_real|lucro_presumido|simples|nao_identificado", "mainOpportunities": ["oportunidade1", "oportunidade2"], "nextSteps": ["passo1", "passo2"]}`,
        messages: [
          {
            role: 'user',
            content: `ATENÇÃO: Verifique se os valores estão em "R$" (reais) ou "R$ mil" (milhares). Muitos documentos contábeis brasileiros usam valores em milhares.\n\nAvalie rapidamente a viabilidade de recuperação tributária para ${companyInfo.name}:\n\n${truncated}`,
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const result = JSON.parse(this.extractJSON(text));
      return {
        viable: result.viable ?? false,
        score: result.score ?? 0,
        summary: result.summary ?? 'Análise não conclusiva',
        regimeIdentificado: result.regimeIdentificado || undefined,
      };
    } catch (error: any) {
      logger.error(`Erro na análise rápida: ${error.message}`);
      throw new Error(`Falha na análise rápida: ${error.message}`);
    }
  }

  // ============================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ============================================================

  /**
   * Trunca texto de forma inteligente — preserva início e fim do documento
   * O início geralmente tem o cabeçalho da empresa e o fim tem os totais
   */
  private smartTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const headSize = Math.floor(maxLength * 0.6); // 60% do início
    const tailSize = Math.floor(maxLength * 0.35); // 35% do fim
    const separator = '\n\n[... CONTEÚDO INTERMEDIÁRIO OMITIDO POR LIMITE DE TAMANHO ...]\n\n';

    const head = text.substring(0, headSize);
    const tail = text.substring(text.length - tailSize);

    logger.info(`Texto truncado: ${text.length} → ${maxLength} chars (60% início + 35% fim)`);

    return head + separator + tail;
  }

  /**
   * Parseia a resposta JSON do Claude com tratamento robusto de erros
   */
  private parseAnalysisResponse(responseText: string): TaxAnalysisResult {
    try {
      const jsonStr = this.extractJSON(responseText);
      const parsed = JSON.parse(jsonStr);

      // Validação e normalização dos campos
      const oportunidades = Array.isArray(parsed.oportunidades)
        ? parsed.oportunidades.map((op: any) => ({
            tipo: op.tipo || 'Não especificado',
            tributo: op.tributo || 'N/A',
            descricao: op.descricao || '',
            valorEstimado: parseFloat(op.valorEstimado) || 0,
            fundamentacaoLegal: op.fundamentacaoLegal || '',
            prazoRecuperacao: op.prazoRecuperacao || 'Últimos 5 anos',
            complexidade: op.complexidade || 'media',
            probabilidadeRecuperacao: Math.min(100, Math.max(0, parseInt(op.probabilidadeRecuperacao) || 0)),
            risco: op.risco || '',
            documentacaoNecessaria: Array.isArray(op.documentacaoNecessaria) ? op.documentacaoNecessaria : [],
            passosPraticos: Array.isArray(op.passosPraticos) ? op.passosPraticos : [],
          }))
        : [];

      let valorTotalEstimado = parseFloat(parsed.valorTotalEstimado) || 0;

      // VALIDAÇÃO DE SANIDADE: recalcular o total a partir das oportunidades individuais
      const somaOportunidades = oportunidades.reduce((sum: number, op: any) => sum + (op.valorEstimado || 0), 0);
      
      // Se o total declarado difere muito da soma das oportunidades, usar a soma
      if (somaOportunidades > 0 && Math.abs(valorTotalEstimado - somaOportunidades) > somaOportunidades * 0.1) {
        logger.warn(`Valor total (${valorTotalEstimado}) difere da soma das oportunidades (${somaOportunidades}). Usando soma.`);
        valorTotalEstimado = somaOportunidades;
      }

      // VALIDAÇÃO DE SANIDADE: alertar se valores parecem em unidade errada
      // Se uma única oportunidade > R$ 50M, provavelmente há erro de unidade
      for (const op of oportunidades) {
        if (op.valorEstimado > 50_000_000) {
          logger.warn(`Oportunidade "${op.tipo}" com valor suspeito: R$ ${op.valorEstimado.toLocaleString('pt-BR')} — possível erro de unidade monetária`);
          // Adicionar alerta nos dados
          if (!parsed.alertas) parsed.alertas = [];
          parsed.alertas.push(`ATENÇÃO: O valor de R$ ${op.valorEstimado.toLocaleString('pt-BR')} para "${op.tipo}" pode conter erro de unidade. Revise manualmente.`);
        }
      }

      return {
        oportunidades,
        resumoExecutivo: parsed.resumoExecutivo || 'Análise concluída sem resumo disponível.',
        valorTotalEstimado,
        score: Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
        recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
        alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
        fundamentacaoGeral: parsed.fundamentacaoGeral || '',
        periodoAnalisado: parsed.periodoAnalisado || 'Não identificado',
        regimeTributario: parsed.regimeTributario || 'Não identificado',
        riscoGeral: parsed.riscoGeral || 'medio',
      };
    } catch (error: any) {
      logger.error('Falha ao parsear resposta do Claude:', { 
        responseStart: responseText.substring(0, 500),
        responseEnd: responseText.substring(Math.max(0, responseText.length - 200)),
        responseLength: responseText.length,
        parseError: error.message,
      });
      throw new Error(
        'A resposta da IA não pôde ser processada. Tente novamente ou envie um documento com melhor qualidade de texto.'
      );
    }
  }

  /**
   * Extrai JSON de texto que pode conter markdown ou outros caracteres
   * Lida com respostas truncadas tentando reparar JSON incompleto
   */
  private extractJSON(text: string): string {
    // Tentar parsear diretamente
    try {
      JSON.parse(text);
      return text;
    } catch {}

    // Remover blocos de código markdown (greedy match para pegar tudo)
    const jsonMatchGreedy = text.match(/```(?:json)?\s*\n?([\s\S]*)```/);
    if (jsonMatchGreedy) {
      const extracted = jsonMatchGreedy[1].trim();
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {}
      // Se falhou, tentar reparar o JSON extraído do markdown
      return this.repairTruncatedJSON(extracted);
    }

    // Se tem ``` no início mas não tem fechamento (resposta truncada)
    const markdownStart = text.match(/```(?:json)?\s*\n?([\s\S]*)/);
    if (markdownStart) {
      const extracted = markdownStart[1].trim();
      return this.repairTruncatedJSON(extracted);
    }

    // Encontrar o primeiro { e último }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const extracted = text.substring(firstBrace, lastBrace + 1);
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {}
      return this.repairTruncatedJSON(extracted);
    }

    // Último recurso: pegar tudo a partir do primeiro {
    if (firstBrace !== -1) {
      return this.repairTruncatedJSON(text.substring(firstBrace));
    }

    return text;
  }

  /**
   * Tenta reparar um JSON truncado fechando brackets/braces abertos
   */
  private repairTruncatedJSON(text: string): string {
    // Primeiro, tentar parsear como está
    try {
      JSON.parse(text);
      return text;
    } catch {}

    // Remover trailing comma e whitespace
    let repaired = text.replace(/,\s*$/, '');

    // Remover valor de string incompleto (string aberta sem fechar)
    // Ex: "descricao": "texto incompleto aqui...
    repaired = repaired.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*$/, '');

    // Contar brackets abertos
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }
    }

    // Se estamos dentro de uma string, fechar a string
    if (inString) {
      repaired += '"';
    }

    // Remover trailing comma novamente
    repaired = repaired.replace(/,\s*$/, '');

    // Fechar brackets e braces abertos
    while (openBrackets > 0) {
      repaired += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    // Tentar parsear o resultado
    try {
      JSON.parse(repaired);
      logger.info('JSON truncado reparado com sucesso');
      return repaired;
    } catch (e) {
      // Última tentativa: cortar no último objeto/array válido
      logger.warn('Tentativa de reparo de JSON falhou, tentando corte agressivo');
      return this.aggressiveJSONRepair(text);
    }
  }

  /**
   * Reparo agressivo: tenta encontrar o maior pedaço válido de JSON
   */
  private aggressiveJSONRepair(text: string): string {
    // Encontrar a última } completa e tentar fechar
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const partial = lines.slice(0, i + 1).join('\n');
      
      // Tentar fechar o JSON
      let attempt = partial.replace(/,\s*$/, '');
      
      // Contar abertos
      let braces = 0;
      let brackets = 0;
      let inStr = false;
      let esc = false;
      
      for (const char of attempt) {
        if (esc) { esc = false; continue; }
        if (char === '\\') { esc = true; continue; }
        if (char === '"') { inStr = !inStr; continue; }
        if (!inStr) {
          if (char === '{') braces++;
          if (char === '}') braces--;
          if (char === '[') brackets++;
          if (char === ']') brackets--;
        }
      }

      if (inStr) attempt += '"';
      attempt = attempt.replace(/,\s*$/, '');
      while (brackets > 0) { attempt += ']'; brackets--; }
      while (braces > 0) { attempt += '}'; braces--; }

      try {
        JSON.parse(attempt);
        logger.info(`JSON reparado agressivamente (cortou ${lines.length - i - 1} linhas do final)`);
        return attempt;
      } catch {}
    }

    return text;
  }

  /**
   * Gera memória de cálculo em texto formatado
   */
  private buildMemoriaCalculo(opportunity: AnalysisOpportunity, companyInfo: CompanyInfo): string {
    const date = new Date().toLocaleDateString('pt-BR');
    return `
MEMÓRIA DE CÁLCULO — RECUPERAÇÃO DE CRÉDITO TRIBUTÁRIO
========================================================

Data: ${date}
Empresa: ${companyInfo.name}
${companyInfo.cnpj ? `CNPJ: ${companyInfo.cnpj}` : ''}

1. TIPO DE CRÉDITO
${opportunity.tipo}

2. TRIBUTO
${opportunity.tributo}

3. FUNDAMENTAÇÃO LEGAL
${opportunity.fundamentacaoLegal}

4. VALOR ESTIMADO
R$ ${opportunity.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

5. PERÍODO DE APURAÇÃO
${opportunity.prazoRecuperacao}

6. METODOLOGIA DE CÁLCULO
${opportunity.descricao}

7. PROBABILIDADE DE ÊXITO
${opportunity.probabilidadeRecuperacao}%

8. COMPLEXIDADE
${opportunity.complexidade.toUpperCase()}

9. DOCUMENTAÇÃO NECESSÁRIA
${opportunity.documentacaoNecessaria.map((d, i) => `${i + 1}. ${d}`).join('\n')}

10. PASSOS PARA RECUPERAÇÃO
${opportunity.passosPraticos.map((p, i) => `${i + 1}. ${p}`).join('\n')}

========================================================
NOTA: Esta memória de cálculo é uma estimativa baseada em análise automatizada.
Os valores definitivos devem ser apurados por profissional contábil qualificado.
    `.trim();
  }

  /**
   * Gera checklist de documentos por tipo de tributo
   */
  private buildChecklist(opportunity: AnalysisOpportunity): string[] {
    const baseChecklist = [
      'Contrato social atualizado e consolidado',
      'Procuração (se aplicável)',
      'Comprovante de inscrição no CNPJ',
      'Certificado digital válido (e-CNPJ)',
    ];

    const tributeChecklist: Record<string, string[]> = {
      IRPJ: [
        'LALUR/e-LALUR dos períodos envolvidos',
        'ECF (Escrituração Contábil Fiscal)',
        'Livro Diário e Razão',
        'DREs do período',
        'Comprovantes de retenções na fonte',
        'DARFs pagos',
      ],
      CSLL: [
        'LALUR/e-LALUR com parte B',
        'ECF (Escrituração Contábil Fiscal)',
        'DREs do período',
        'DARFs de CSLL pagos',
      ],
      PIS: [
        'EFD-Contribuições dos períodos',
        'Notas fiscais de aquisição (insumos)',
        'Planilha de créditos por item',
        'DARFs de PIS pagos',
        'Contratos de serviço (se aplicável)',
      ],
      COFINS: [
        'EFD-Contribuições dos períodos',
        'Notas fiscais de aquisição (insumos)',
        'Planilha de créditos por item',
        'DARFs de COFINS pagos',
        'Contratos de serviço (se aplicável)',
      ],
      ICMS: [
        'EFD ICMS/IPI (SPED Fiscal)',
        'Notas fiscais de entrada e saída',
        'GIA (Guia de Informação e Apuração)',
        'CIAP (se crédito sobre ativo)',
        'Comprovantes de pagamento de ICMS',
      ],
      ISS: [
        'Notas fiscais de serviço',
        'Livro de registro de serviços',
        'Comprovantes de ISS pago',
        'Declaração de serviços do município',
      ],
    };

    const specific = tributeChecklist[opportunity.tributo] || [];
    return [...baseChecklist, ...specific, ...opportunity.documentacaoNecessaria];
  }

  /**
   * Retorna nome legível do tipo de documento
   */
  private getDocumentTypeName(type: string): string {
    const names: Record<string, string> = {
      dre: 'Demonstração do Resultado do Exercício (DRE)',
      balanco: 'Balanço Patrimonial',
      balancete: 'Balancete de Verificação',
      sped: 'SPED EFD Fiscal (escrituração fiscal digital)',
    };
    return names[type] || type;
  }
}

// Exportar instância singleton
export const claudeService = new ClaudeService();
export default claudeService;
