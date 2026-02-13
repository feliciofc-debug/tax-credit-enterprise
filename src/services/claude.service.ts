// src/services/claude.service.ts
// Serviço dedicado de integração com Claude AI para análise tributária
// Usa Sonnet 4.5 para análises em tempo real e Opus 4.6 reservado para análises profundas

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

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

function buildFullAnalysisPrompt(companyInfo: CompanyInfo, documentType: string): string {
  const docTypeName = documentType === 'dre' ? 'DRE (Demonstração do Resultado do Exercício)'
    : documentType === 'balanco' ? 'Balanço Patrimonial'
    : documentType === 'balancete' ? 'Balancete de Verificação'
    : 'Documento Contábil';

  return `Você é um especialista sênior em recuperação de créditos tributários brasileiros, com 20 anos de experiência em contencioso administrativo e judicial tributário. Você está analisando um ${docTypeName}.

## CONTEXTO DA EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime Tributário: ${companyInfo.regime}` : '- Regime: Verificar no documento'}
${companyInfo.sector ? `- Setor: ${companyInfo.sector}` : ''}
${companyInfo.uf ? `- UF: ${companyInfo.uf}` : ''}
- Tipo de documento analisado: ${docTypeName}

## REGRAS FUNDAMENTAIS

1. SEMPRE analise TODAS as teses listadas abaixo, mesmo que os documentos não contenham dados diretos — use estimativas baseadas no setor e faturamento
2. Para cada tese, forneça: valor estimado, fundamentação legal completa, probabilidade de êxito (%) e complexidade
3. Seja CONSERVADOR nos valores — é melhor prometer menos e entregar mais
4. Separe PIS e COFINS em linhas distintas (alíquotas diferentes: PIS 1,65%, COFINS 7,6%)
5. Considere sempre os últimos 5 anos (60 meses) como período de recuperação
6. Cite SEMPRE o dispositivo legal, número do tema STF/STJ e leading case

## REGRA CRÍTICA SOBRE UNIDADES MONETÁRIAS
- ANTES DE TUDO: Verifique se o documento indica "Em milhares de Reais", "R$ mil" ou "Em Reais - R$".
- Se estiver em "R$ mil" ou "milhares", o número 100.470 significa R$ 100.470.000 (cem milhões).
- NÃO MULTIPLIQUE por 1.000 se o valor já está em milhares!
- Quando reportar valorEstimado nos resultados, SEMPRE use o valor em REAIS CHEIOS (não em milhares).

## REGRA CRÍTICA SOBRE CONSERVADORISMO
- Créditos recuperáveis tipicamente ficam entre 3-10% da receita bruta anual
- Se seu cálculo total resultar em mais de 15% da receita bruta, REVISE — provavelmente há erro
- É melhor reportar MENOS oportunidades com valores REALISTAS do que muitas com valores inflados

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

## OBSERVAÇÕES PARA ESTIMATIVAS
- Para estimar folha de pagamento: some despesas com pessoal + mão de obra direta + obrigações trabalhistas
- Para estimar nº de funcionários: divida folha anual por salário médio do setor (metalurgia ~R$ 4.500/mês, serviços ~R$ 3.000/mês, saúde ~R$ 5.000/mês)
- ICMS: use alíquota do estado sede (SP: 18% interno, 25% energia; RJ: 20%; MG: 18%; ES: 17% interno, 25% energia; RS: 17%; PR: 19%)
- Se empresa EXPORTA parte da produção, SEMPRE analise TESE 2.4 (ICMS acumulado de exportação) e TESE 1.7 (PIS/COFINS exportação). Setores tipicamente exportadores: mármore/granito, siderurgia, celulose, café, soja, carnes, mineração, calçados, têxtil, autopeças
- Se empresa é INDÚSTRIA com alto consumo de energia ou frete pesado, SEMPRE analise TESE 2.5 (frete) como item separado
- Se empresa é do SETOR DE SAÚDE (hospital, clínica, centro médico), SEMPRE analise: TESE 1.5 (monofásico medicamentos), TESE 1.6 (ativo imobilizado), TESE 4.4 (equiparação hospitalar), TESE 6.1 (ISS), TESE 7.1 (importação)
- Se empresa IMPORTA equipamentos ou insumos, SEMPRE analise TESE 7.1, 7.2 e 7.3 (créditos de importação)
- Se não tiver dados suficientes para calcular, ESTIME baseado em percentuais típicos e INFORME que é estimativa
- NUNCA deixe de analisar uma tese por falta de dados — use estimativas conservadoras

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem comentários:

{
  "oportunidades": [
    {
      "tipo": "Nome descritivo (ex: Exclusão do ICMS da base do PIS - Tema 69)",
      "tributo": "PIS|COFINS|ICMS|INSS|IRPJ|CSLL|IPI|RAT|FGTS|ISS|II|PIS-IMPORT|COFINS-IMPORT",
      "descricao": "Descrição detalhada com memória de cálculo resumida",
      "valorEstimado": 0.00,
      "fundamentacaoLegal": "Lei X art. Y | RE/REsp número — Tema Z STF/STJ",
      "prazoRecuperacao": "Últimos 5 anos (60 meses)",
      "complexidade": "baixa|media|alta",
      "probabilidadeRecuperacao": 85,
      "risco": "Principais riscos desta recuperação",
      "documentacaoNecessaria": ["doc1", "doc2"],
      "passosPraticos": ["passo1", "passo2"]
    }
  ],
  "resumoExecutivo": "Resumo executivo com visão geral, valor total e recomendações principais",
  "valorTotalEstimado": 0.00,
  "score": 75,
  "recomendacoes": ["Priorizar tese X por ter maior valor e probabilidade", "..."],
  "alertas": ["Verificar se empresa já ajuizou ação sobre Tema 69", "..."],
  "fundamentacaoGeral": "Visão geral das bases legais aplicáveis",
  "periodoAnalisado": "Período identificado no documento",
  "regimeTributario": "Regime tributário identificado ou inferido",
  "riscoGeral": "baixo|medio|alto"
}

## REGRAS FINAIS
1. Seja CONSERVADOR nos valores — é melhor prometer menos e entregar mais
2. CADA oportunidade DEVE ter fundamentação legal com número de lei/artigo E tema STF/STJ
3. PIS e COFINS devem ser linhas SEPARADAS (alíquotas diferentes)
4. Se não houver dados suficientes, use estimativa e INFORME nos alertas
5. O score (0-100) reflete quantidade e qualidade das oportunidades
6. valorTotalEstimado DEVE ser a SOMA exata dos valorEstimado de cada oportunidade
7. Se empresa não for Lucro Real, várias teses de PIS/COFINS não se aplicam — INDICAR nos alertas`;
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

    // Prompt unificado — cobre todas as teses tributárias independente do tipo de documento
    const systemPrompt = buildFullAnalysisPrompt(companyInfo, documentType);

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
        max_tokens: 16384,
        temperature: 0, // Determinístico: mesmos dados = mesmos resultados
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `ATENÇÃO SOBRE UNIDADES: Verifique CUIDADOSAMENTE se os valores do documento estão em "R$" (reais cheios) ou "R$ mil" / "em milhares de Reais". Muitos documentos contábeis usam valores em milhares — NÃO multiplique por 1.000 novamente. Se o documento diz "100.470" e está "em milhares", o valor real é R$ 100.470.000.\n\nAnalise o seguinte ${this.getDocumentTypeName(documentType)} e identifique TODAS as oportunidades de recuperação de créditos tributários:\n\n${truncatedText}`,
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
  ): Promise<{ viable: boolean; score: number; summary: string }> {
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

Responda em JSON: {"viable": true/false, "score": 0-100, "summary": "resumo em 2-3 frases CONSERVADOR e realista", "mainOpportunities": ["oportunidade1", "oportunidade2"], "nextSteps": ["passo1", "passo2"]}`,
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
    };
    return names[type] || type;
  }
}

// Exportar instância singleton
export const claudeService = new ClaudeService();
export default claudeService;
