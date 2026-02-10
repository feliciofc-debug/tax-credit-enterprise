// src/services/claude.service.ts
// Serviço dedicado de integração com Claude AI para análise tributária
// Usa Opus 4.6 para análises profundas e Sonnet 4.5 para tarefas leves

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

// ============================================================
// CONFIGURAÇÃO DE MODELOS
// ============================================================
const MODELS = {
  // Opus 4.6 — o mais inteligente, análise tributária complexa
  ANALYSIS: 'claude-opus-4-6',
  // Sonnet 4.5 — geração de documentos, tarefas mais simples
  DOCUMENTS: 'claude-sonnet-4-5-20250929',
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

function buildDREPrompt(companyInfo: CompanyInfo): string {
  return `Você é um especialista sênior em recuperação de créditos tributários brasileiros com mais de 20 anos de experiência. Você está analisando uma DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE).

## CONTEXTO DA EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime Tributário: ${companyInfo.regime}` : '- Regime: Verificar no documento'}
${companyInfo.sector ? `- Setor: ${companyInfo.sector}` : ''}
${companyInfo.uf ? `- UF: ${companyInfo.uf}` : ''}

## O QUE ANALISAR NA DRE

### IRPJ e CSLL
- Verifique a base de cálculo do IRPJ e CSLL
- Identifique despesas indedutíveis que podem ter sido deduzidas indevidamente
- Verifique se há créditos de prejuízo fiscal acumulado (limitado a 30% do lucro real)
- Analise se há pagamento a maior de IRPJ/CSLL por erro de cálculo
- Verifique a aplicação correta de alíquotas (IRPJ 15% + adicional 10%, CSLL 9%)
- Identifique incentivos fiscais não utilizados (PAT, Lei do Bem, Lei Rouanet)

### PIS e COFINS
- Verifique se a empresa está no regime cumulativo ou não-cumulativo
- No regime não-cumulativo: identifique insumos que geram crédito (Lei 10.637/2002 e 10.833/2003)
- Verifique se há créditos sobre: energia elétrica, aluguéis, depreciação, fretes, armazenagem
- Analise se há créditos sobre insumos de acordo com o conceito ampliado do STJ (REsp 1.221.170)
- Identifique receitas com alíquota zero ou isentas que podem ter sido tributadas
- Verifique a exclusão do ICMS da base de cálculo do PIS/COFINS (Tema 69 STF)

### ICMS
- Identifique créditos de ICMS sobre insumos, ativo permanente (CIAP)
- Verifique substituição tributária (ICMS-ST) pago a maior
- Analise diferencial de alíquotas (DIFAL) pago indevidamente
- Identifique créditos acumulados de ICMS por exportação

### ISS
- Verifique se há ISS pago sobre serviços não tributáveis
- Identifique ISS pago em duplicidade
- Analise se a base de cálculo está correta (deduções permitidas)

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem comentários:

{
  "oportunidades": [
    {
      "tipo": "Nome descritivo da oportunidade",
      "tributo": "IRPJ|CSLL|PIS|COFINS|ICMS|ISS",
      "descricao": "Descrição detalhada da oportunidade identificada",
      "valorEstimado": 0.00,
      "fundamentacaoLegal": "Legislação aplicável com artigos específicos",
      "prazoRecuperacao": "Período recuperável (ex: últimos 5 anos)",
      "complexidade": "baixa|media|alta",
      "probabilidadeRecuperacao": 85,
      "risco": "Principais riscos desta recuperação",
      "documentacaoNecessaria": ["doc1", "doc2"],
      "passosPraticos": ["passo1", "passo2"]
    }
  ],
  "resumoExecutivo": "Resumo executivo da análise com principais conclusões",
  "valorTotalEstimado": 0.00,
  "score": 75,
  "recomendacoes": ["recomendação 1", "recomendação 2"],
  "alertas": ["alerta 1 se houver"],
  "fundamentacaoGeral": "Visão geral das bases legais aplicáveis",
  "periodoAnalisado": "Período identificado no documento",
  "regimeTributario": "Regime tributário identificado ou inferido",
  "riscoGeral": "baixo|medio|alto"
}

## REGRAS IMPORTANTES
1. Seja CONSERVADOR nos valores — é melhor subestimar do que superestimar
2. Só inclua oportunidades que tenha embasamento legal sólido
3. Se não conseguir identificar valores específicos, use estimativas baseadas em percentuais padrão do setor
4. Se o documento não contiver informações suficientes para algum tributo, NÃO invente — indique nos alertas
5. O score deve refletir a qualidade e quantidade de oportunidades encontradas (0-100)
6. Cada oportunidade DEVE ter fundamentação legal específica com número de lei/artigo
7. Se não houver oportunidades reais, retorne array vazio com score baixo — NUNCA invente dados`;
}

function buildBalancoPrompt(companyInfo: CompanyInfo): string {
  return `Você é um especialista sênior em recuperação de créditos tributários brasileiros com mais de 20 anos de experiência. Você está analisando um BALANÇO PATRIMONIAL.

## CONTEXTO DA EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime Tributário: ${companyInfo.regime}` : '- Regime: Verificar no documento'}
${companyInfo.sector ? `- Setor: ${companyInfo.sector}` : ''}

## O QUE ANALISAR NO BALANÇO PATRIMONIAL

### ATIVO
- **Impostos a recuperar**: Verifique saldos de IRPJ, CSLL, PIS, COFINS, ICMS a recuperar que podem estar "esquecidos"
- **ICMS sobre ativo permanente (CIAP)**: Créditos de ICMS sobre aquisição de bens do ativo imobilizado (1/48 avos por mês)
- **Créditos de PIS/COFINS sobre depreciação**: No regime não-cumulativo, verificar créditos sobre depreciação do ativo
- **Tributos pagos antecipadamente**: Identificar pagamentos a maior registrados no ativo
- **Estoques**: Verificar se há créditos de ICMS, PIS, COFINS sobre estoques não apropriados

### PASSIVO
- **Provisões tributárias excessivas**: Provisões de IRPJ/CSLL acima do devido
- **Parcelamentos**: Verificar se há tributos parcelados que poderiam ser compensados
- **Tributos a pagar com base de cálculo incorreta**: ICMS-ST, ISS, PIS/COFINS provisionados a maior
- **Contingências tributárias**: Depósitos judiciais que podem ser levantados

### PATRIMÔNIO LÍQUIDO
- **Prejuízos acumulados**: Prejuízos fiscais que podem ser compensados (30% do lucro real)
- **Reservas**: Verificar incentivos fiscais registrados em reservas

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE em JSON válido (mesmo formato da análise de DRE):

{
  "oportunidades": [
    {
      "tipo": "Nome descritivo da oportunidade",
      "tributo": "IRPJ|CSLL|PIS|COFINS|ICMS|ISS",
      "descricao": "Descrição detalhada",
      "valorEstimado": 0.00,
      "fundamentacaoLegal": "Legislação aplicável",
      "prazoRecuperacao": "Período recuperável",
      "complexidade": "baixa|media|alta",
      "probabilidadeRecuperacao": 85,
      "risco": "Principais riscos",
      "documentacaoNecessaria": ["doc1", "doc2"],
      "passosPraticos": ["passo1", "passo2"]
    }
  ],
  "resumoExecutivo": "Resumo executivo",
  "valorTotalEstimado": 0.00,
  "score": 75,
  "recomendacoes": ["rec1"],
  "alertas": ["alerta1"],
  "fundamentacaoGeral": "Bases legais",
  "periodoAnalisado": "Período do balanço",
  "regimeTributario": "Regime identificado",
  "riscoGeral": "baixo|medio|alto"
}

## REGRAS IMPORTANTES
1. Foque nos SALDOS — o balanço mostra posições, não movimentações
2. Créditos registrados no ativo que não foram utilizados são oportunidades prioritárias
3. Compare proporções de tributos a pagar vs. tributos a recuperar para identificar anomalias
4. Seja CONSERVADOR nos valores estimados
5. Se não houver oportunidades reais, retorne array vazio — NUNCA invente dados`;
}

function buildBalancetePrompt(companyInfo: CompanyInfo): string {
  return `Você é um especialista sênior em recuperação de créditos tributários brasileiros com mais de 20 anos de experiência. Você está analisando um BALANCETE DE VERIFICAÇÃO.

## CONTEXTO DA EMPRESA
- Razão Social: ${companyInfo.name}
${companyInfo.cnpj ? `- CNPJ: ${companyInfo.cnpj}` : ''}
${companyInfo.regime ? `- Regime Tributário: ${companyInfo.regime}` : '- Regime: Verificar no documento'}
${companyInfo.sector ? `- Setor: ${companyInfo.sector}` : ''}

## O QUE ANALISAR NO BALANCETE DE VERIFICAÇÃO

O balancete mostra TODAS as contas com seus saldos e movimentações. É o documento mais detalhado.

### CONTAS TRIBUTÁRIAS (grupo 1.1.5 / 1.1.8 / 2.1.3)
- Analise cada conta de imposto a recuperar: saldos acumulados podem indicar créditos não compensados
- Verifique contas de ICMS a recuperar (1.1.5.xx) — saldos crescentes indicam créditos acumulados
- Verifique contas de PIS/COFINS a recuperar — compare com o faturamento
- Identifique IRPJ/CSLL pagos por estimativa que excedem o devido

### CONTAS DE DESPESAS TRIBUTÁRIAS (grupo 3.x)
- Compare despesas com tributos entre períodos para identificar anomalias
- Verifique se despesas com PIS/COFINS são compatíveis com as alíquotas corretas
- Identifique se há despesas com multas/juros por pagamento indevido

### CONTAS DE RECEITA (grupo 3.1)
- Verifique se receitas isentas/NT estão sendo tributadas indevidamente
- Analise receitas de exportação (imunes de PIS/COFINS/ICMS)

### CRUZAMENTOS IMPORTANTES
- Débito de tributos vs. créditos: proporção incomum indica problema
- Saldos de períodos anteriores não compensados
- Contas com saldo invertido (natureza incorreta)

## FORMATO DE RESPOSTA
Responda EXCLUSIVAMENTE em JSON válido (mesmo formato padrão):

{
  "oportunidades": [
    {
      "tipo": "Nome descritivo da oportunidade",
      "tributo": "IRPJ|CSLL|PIS|COFINS|ICMS|ISS",
      "descricao": "Descrição detalhada",
      "valorEstimado": 0.00,
      "fundamentacaoLegal": "Legislação aplicável",
      "prazoRecuperacao": "Período recuperável",
      "complexidade": "baixa|media|alta",
      "probabilidadeRecuperacao": 85,
      "risco": "Principais riscos",
      "documentacaoNecessaria": ["doc1", "doc2"],
      "passosPraticos": ["passo1", "passo2"]
    }
  ],
  "resumoExecutivo": "Resumo executivo",
  "valorTotalEstimado": 0.00,
  "score": 75,
  "recomendacoes": ["rec1"],
  "alertas": ["alerta1"],
  "fundamentacaoGeral": "Bases legais",
  "periodoAnalisado": "Período do balancete",
  "regimeTributario": "Regime identificado",
  "riscoGeral": "baixo|medio|alto"
}

## REGRAS IMPORTANTES
1. O balancete é o MAIS DETALHADO — explore ao máximo as contas analíticas
2. Saldos acumulados em contas de tributos a recuperar são as oportunidades mais óbvias
3. Compare movimentações de débito e crédito para identificar inconsistências
4. Seja CONSERVADOR nos valores estimados
5. Se não houver oportunidades reais, retorne array vazio — NUNCA invente dados`;
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
   * Analisa documento tributário com Claude Opus 4.6
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

    // Selecionar prompt especializado por tipo de documento
    let systemPrompt: string;
    switch (documentType) {
      case 'dre':
        systemPrompt = buildDREPrompt(companyInfo);
        break;
      case 'balanco':
        systemPrompt = buildBalancoPrompt(companyInfo);
        break;
      case 'balancete':
        systemPrompt = buildBalancetePrompt(companyInfo);
        break;
      default:
        systemPrompt = buildDREPrompt(companyInfo);
    }

    // Truncar texto respeitando limite do tipo de documento
    const limit = TEXT_LIMITS[documentType] || TEXT_LIMITS.default;
    const truncatedText = this.smartTruncate(documentText, limit);

    logger.info(`Iniciando análise com Opus 4.6`, {
      documentType,
      company: companyInfo.name,
      textLength: truncatedText.length,
      originalLength: documentText.length,
      truncated: documentText.length > limit,
    });

    try {
      const response = await this.client.messages.create({
        model: MODELS.ANALYSIS,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analise o seguinte ${this.getDocumentTypeName(documentType)} e identifique TODAS as oportunidades de recuperação de créditos tributários:\n\n${truncatedText}`,
          },
        ],
      });

      // Extrair texto da resposta
      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

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
        model: MODELS.DOCUMENTS, // Sonnet para análise rápida
        max_tokens: 2000,
        system: `Você é um especialista tributário. Faça uma análise RÁPIDA de viabilidade de recuperação de créditos tributários. Responda em JSON: {"viable": true/false, "score": 0-100, "summary": "resumo em 2-3 frases", "mainOpportunities": ["oportunidade1", "oportunidade2"]}`,
        messages: [
          {
            role: 'user',
            content: `Avalie rapidamente a viabilidade de recuperação tributária para ${companyInfo.name}:\n\n${truncated}`,
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
      return {
        oportunidades: Array.isArray(parsed.oportunidades)
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
          : [],
        resumoExecutivo: parsed.resumoExecutivo || 'Análise concluída sem resumo disponível.',
        valorTotalEstimado: parseFloat(parsed.valorTotalEstimado) || 0,
        score: Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
        recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
        alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
        fundamentacaoGeral: parsed.fundamentacaoGeral || '',
        periodoAnalisado: parsed.periodoAnalisado || 'Não identificado',
        regimeTributario: parsed.regimeTributario || 'Não identificado',
        riscoGeral: parsed.riscoGeral || 'medio',
      };
    } catch (error) {
      logger.error('Falha ao parsear resposta do Claude:', { responseText: responseText.substring(0, 500) });
      throw new Error(
        'A resposta da IA não pôde ser processada. Tente novamente ou envie um documento com melhor qualidade de texto.'
      );
    }
  }

  /**
   * Extrai JSON de texto que pode conter markdown ou outros caracteres
   */
  private extractJSON(text: string): string {
    // Tentar parsear diretamente
    try {
      JSON.parse(text);
      return text;
    } catch {}

    // Remover blocos de código markdown
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) return jsonMatch[1].trim();

    // Encontrar o primeiro { e último }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
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
