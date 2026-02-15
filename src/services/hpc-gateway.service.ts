// src/services/hpc-gateway.service.ts
// Gateway para o motor HPC Go+Chapel na VPS Contabo
// Envia arquivos SPED para processamento paralelo de alta performance
// Retorna dados parseados para o Claude Opus analisar juridicamente

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';

// ============================================================
// TIPOS DE RESPOSTA DO HPC
// ============================================================

export interface HPCHealthResponse {
  service: string;
  status: string;
  capabilities: string[];
  maxUploadMB: number;
  parserVersion: string;
  registros: string[];
}

export interface HPCSpedEmpresa {
  cnpj: string;
  ie: string;
  razaoSocial: string;
  uf: string;
  fantasia?: string;
}

export interface HPCSpedResumo {
  totalEntradas: number;
  totalSaidas: number;
  icmsCreditos: number;
  icmsDebitos: number;
  saldoCredor: number;
  saldoDevedor: number;
  saldoAnterior: number;
  numNfes: number;
  pisTotalCreditos?: number;
  pisTotalDebitos?: number;
  cofinsTotalCreditos?: number;
  cofinsTotalDebitos?: number;
}

export interface HPCSpedResult {
  arquivo: string;
  tipo: string;
  versao: string;
  periodo: { inicio: string; fim: string };
  empresa: HPCSpedEmpresa;
  resumo: HPCSpedResumo;
  textoConsolidado: string;
  processadoEm: number; // ms
}

export interface HPCProcessResponse {
  success: boolean;
  arquivosProcessados: number;
  tempoTotalMs: number;
  resultados: HPCSpedResult[];
  textoUnificado: string; // texto completo concatenado para enviar ao Claude
  erros?: string[];
}

// ============================================================
// SERVICO HPC GATEWAY
// ============================================================

class HPCGatewayService {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.HPC_GATEWAY_URL || 'https://api2.amzofertas.com.br/hpc';
    this.apiKey = process.env.HPC_API_KEY || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2 minutos (SPED grande pode demorar)
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    logger.info(`[HPC] Gateway inicializado: ${this.baseUrl}`);
  }

  /**
   * Verifica se o HPC esta disponivel e saudavel
   */
  async healthCheck(): Promise<HPCHealthResponse | null> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      logger.info(`[HPC] Health check OK: ${response.data.service} v${response.data.parserVersion}`);
      return response.data;
    } catch (error: any) {
      logger.warn(`[HPC] Health check FALHOU: ${error.message}`);
      return null;
    }
  }

  /**
   * Envia arquivos SPED para processamento no HPC Go+Chapel
   * Retorna dados parseados + texto consolidado para o Claude
   */
  async processSped(files: { buffer: Buffer; originalname: string; mimetype: string }[]): Promise<HPCProcessResponse> {
    const startTime = Date.now();

    logger.info(`[HPC] Enviando ${files.length} arquivo(s) para processamento`, {
      arquivos: files.map(f => f.originalname),
      tamanhoTotal: files.reduce((sum, f) => sum + f.buffer.length, 0),
    });

    try {
      // Montar FormData com os arquivos
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype || 'application/octet-stream',
        });
      }

      const response = await this.client.post('/process-sped', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-API-Key': this.apiKey,
        },
        maxContentLength: 100 * 1024 * 1024, // 100MB
        maxBodyLength: 100 * 1024 * 1024,
      });

      const elapsed = Date.now() - startTime;

      logger.info(`[HPC] Processamento concluido em ${elapsed}ms`, {
        arquivosProcessados: response.data.arquivosProcessados || files.length,
        tempoHPC: response.data.tempoTotalMs,
      });

      return {
        success: true,
        arquivosProcessados: response.data.arquivosProcessados || files.length,
        tempoTotalMs: response.data.tempoTotalMs || elapsed,
        resultados: response.data.resultados || [],
        textoUnificado: response.data.textoUnificado || '',
        erros: response.data.erros,
      };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      logger.error(`[HPC] ERRO no processamento (${elapsed}ms): ${error.message}`);

      if (error.response) {
        logger.error(`[HPC] Status: ${error.response.status}`, error.response.data);
      }

      throw new Error(`Falha no processamento HPC: ${error.message}`);
    }
  }

  /**
   * Verifica se o servico HPC esta habilitado e disponivel
   */
  isEnabled(): boolean {
    return !!process.env.HPC_GATEWAY_URL;
  }

  /**
   * Retorna info do gateway para debug
   */
  getInfo() {
    return {
      enabled: this.isEnabled(),
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
    };
  }
}

// Singleton
export const hpcGateway = new HPCGatewayService();
