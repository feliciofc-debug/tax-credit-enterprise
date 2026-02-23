// src/services/jurisprudence.service.ts
// Busca jurisprudência em tempo real via JUIT API
// STF + STJ + 5 TRFs + 27 TJs — 70M decisões atualizadas diariamente

import axios from 'axios';
import { logger } from '../utils/logger';

const TESE_QUERIES: Record<string, string> = {
  // PIS/COFINS
  'TESE_1.1': 'exclusão ICMS base cálculo PIS Tema 69 RE 574706',
  'TESE_1.2': 'exclusão ICMS base cálculo COFINS Tema 69 RE 574706',
  'TESE_1.3': 'crédito PIS insumos conceito ampliado Tema 779 REsp 1221170',
  'TESE_1.4': 'crédito COFINS insumos conceito ampliado Tema 779',
  'TESE_1.5': 'PIS COFINS monofásico medicamentos farmacêuticos Lei 10147',
  'TESE_1.6': 'crédito PIS COFINS ativo imobilizado depreciação Lei 10637',
  'TESE_1.7': 'PIS COFINS exportação ressarcimento espécie saldo credor',
  'TESE_1.8': 'exclusão ISS base cálculo PIS COFINS RE 592616 Tema 1093',
  'TESE_1.9': 'PIS COFINS receitas financeiras alíquota reduzida Decreto 8426',
  // ICMS
  'TESE_2.1': 'ICMS energia elétrica TUSD TUST exclusão base Tema 986 RE 714139',
  'TESE_2.2': 'ICMS substituição tributária ressarcimento base presumida RE 593849',
  'TESE_2.3': 'ICMS ativo permanente CIAP crédito 1/48 LC 87',
  'TESE_2.4': 'ICMS acumulado exportação imunidade saldo credor LC 87 Lei Kandir',
  'TESE_2.6': 'exclusão ICMS-ST base PIS COFINS REsp 1896678 Tema 1048',
  'TESE_2.7': 'ICMS transferência entre filiais ADC 49 LC 204 2023',
  // INSS
  'TESE_3.1': 'INSS patronal verbas indenizatórias terço férias aviso prévio Tema 985',
  'TESE_3.2': 'contribuições terceiros sistema S limitação 20 salários mínimos Lei 6950',
  'TESE_3.4': 'FGTS verbas indenizatórias aviso prévio terço férias',
  // IRPJ/CSLL
  'TESE_4.1': 'benefícios fiscais ICMS exclusão base IRPJ CSLL LC 160 2017 EREsp 1517492',
  'TESE_4.4': 'equiparação hospitalar IRPJ CSLL lucro presumido 8% serviços hospitalares',
  'TESE_4.5': 'IRPJ CSLL SELIC repetição indébito tributário Tema 1079 RE 1063187',
  'TESE_4.6': 'JCP juros sobre capital próprio dedução IRPJ CSLL Lei 9249',
  // IPI
  'TESE_5.1': 'IPI saldo credor acumulado exportação ressarcimento RIPI',
  // Importação
  'TESE_7.1': 'PIS COFINS importação crédito Lei 10865 equipamentos insumos',
  'TESE_7.2': 'ICMS importação crédito ativo imobilizado insumos LC 87',
};

export interface JurisprudenciaResult {
  tribunal: string;
  numero: string;
  data: string;
  ementa: string;
  relator?: string;
  tema?: string;
}

export interface JurisprudenciaContexto {
  teseCode: string;
  julgados: JurisprudenciaResult[];
  textoFormatado: string;
}

class JurisprudenceService {
  private apiKey: string;
  private baseUrl = 'https://api.juit.dev/jurisprudence';
  private cache: Map<string, { data: JurisprudenciaResult[]; timestamp: number }> = new Map();
  private CACHE_TTL = 24 * 60 * 60 * 1000;

  constructor() {
    this.apiKey = process.env.JUIT_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[JURIS] JUIT_API_KEY não configurada — jurisprudência em tempo real indisponível');
    }
  }

  async buscarPorTese(teseCode: string): Promise<JurisprudenciaResult[]> {
    if (!this.apiKey) return [];

    const query = TESE_QUERIES[teseCode];
    if (!query) return [];

    const cached = this.cache.get(teseCode);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info(`[JURIS] Cache hit: ${teseCode}`);
      return cached.data;
    }

    try {
      const response = await axios.get(this.baseUrl, {
        timeout: 8000,
        headers: { Authorization: `Bearer ${this.apiKey}` },
        params: {
          query,
          search_on: 'ementa',
          tribunal: 'STF,STJ',
          sort_by_field: ['score', 'date'],
          sort_by_direction: ['desc', 'desc'],
          size: 3,
        },
      });

      const hits = response.data?.hits?.hits || response.data?.results || [];

      const results: JurisprudenciaResult[] = hits
        .slice(0, 3)
        .map((hit: any) => {
          const src = hit._source || hit;
          return {
            tribunal: src.tribunal || src.court || 'N/D',
            numero: src.numero_unico || src.process_number || 'N/D',
            data: src.data_julgamento || src.date || 'N/D',
            ementa: (src.ementa || src.headnote || '').substring(0, 800),
            relator: src.relator || src.rapporteur || undefined,
            tema: src.tema || undefined,
          };
        })
        .filter((r: JurisprudenciaResult) => r.ementa.length > 50);

      this.cache.set(teseCode, { data: results, timestamp: Date.now() });
      logger.info(`[JURIS] Tese ${teseCode}: ${results.length} julgados encontrados`);
      return results;

    } catch (error: any) {
      logger.warn(`[JURIS] Falha ao buscar ${teseCode}: ${error.message}`);
      return [];
    }
  }

  async buscarParaAnalise(teseCodes: string[]): Promise<Map<string, JurisprudenciaResult[]>> {
    const resultado = new Map<string, JurisprudenciaResult[]>();

    if (!this.apiKey || teseCodes.length === 0) return resultado;

    const BATCH_SIZE = 3;
    for (let i = 0; i < teseCodes.length; i += BATCH_SIZE) {
      const lote = teseCodes.slice(i, i + BATCH_SIZE);
      const promises = lote.map(async (code) => {
        const julgados = await this.buscarPorTese(code);
        resultado.set(code, julgados);
      });
      await Promise.all(promises);
    }

    return resultado;
  }

  formatarParaPrompt(jurisprudencias: Map<string, JurisprudenciaResult[]>): string {
    if (jurisprudencias.size === 0) return '';

    const linhas: string[] = ['## JURISPRUDÊNCIA REAL — USE ESTAS EMENTAS NA FUNDAMENTAÇÃO\n'];
    linhas.push('Os seguintes acórdãos foram recuperados em tempo real do STF/STJ.\n');
    linhas.push('CITE-OS diretamente na fundamentacaoLegal de cada oportunidade correspondente.\n\n');

    for (const [teseCode, julgados] of jurisprudencias.entries()) {
      if (julgados.length === 0) continue;

      linhas.push(`### ${teseCode}\n`);
      julgados.forEach((j, idx) => {
        linhas.push(`**Julgado ${idx + 1}:** ${j.tribunal} — ${j.numero} — ${j.data}`);
        if (j.relator) linhas.push(`Relator: ${j.relator}`);
        linhas.push(`Ementa: "${j.ementa}"`);
        linhas.push('');
      });
    }

    return linhas.join('\n');
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }
}

export const jurisprudenceService = new JurisprudenceService();
export default jurisprudenceService;
