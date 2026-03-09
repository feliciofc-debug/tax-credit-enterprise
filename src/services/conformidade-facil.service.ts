// src/services/conformidade-facil.service.ts
// API Conformidade Fácil — Receita Federal (Reforma Tributária IBS/CBS)
// Autenticação: mTLS com certificado digital ICP-Brasil (e-CNPJ A1)

import fs from 'fs';
import path from 'path';
import https from 'https';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const BASE_URL = 'https://cff.svrs.rs.gov.br/api/v1/consultas';

interface ConformidadeFacilConfig {
  certPath: string;
  passphrase: string;
}

export interface ClassTribItem {
  codigo?: string;
  nome?: string;
  [key: string]: unknown;
}

export interface ConformidadeFacilResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  disabled?: boolean;
}

export class ConformidadeFacilService {
  private client: AxiosInstance | null = null;
  private config: ConformidadeFacilConfig | null = null;
  private initDone = false;

  constructor() {
    // Lazy init — não executa na carga do módulo (evita crash no startup)
  }

  private init(): void {
    if (this.initDone) return;
    this.initDone = true;
    const passphrase = process.env.CONFORMIDADE_FACIL_CERT_PASSWORD;
    const certPathEnv = process.env.CONFORMIDADE_FACIL_CERT_PATH;

    if (!passphrase || passphrase === '') {
      logger.info('[ConformidadeFácil] Certificado não configurado (CONFORMIDADE_FACIL_CERT_PASSWORD ausente)');
      return;
    }

    // Render: /etc/secrets/<filename> | Local: app root
    // Se usou outro nome no Render, defina CONFORMIDADE_FACIL_CERT_PATH
    const possiblePaths = [
      certPathEnv,
      '/etc/secrets/certificado-conformidade.pfx',
      path.join(process.cwd(), 'certificado-conformidade.pfx'),
    ].filter(Boolean) as string[];

    let certPath: string | null = null;
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          certPath = p;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!certPath) {
      logger.warn('[ConformidadeFácil] Arquivo .pfx não encontrado. Tente: /etc/secrets/certificado-conformidade.pfx ou CONFORMIDADE_FACIL_CERT_PATH');
      return;
    }

    try {
      const pfx = fs.readFileSync(certPath);
      const agent = new https.Agent({
        pfx,
        passphrase,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      });

      this.client = axios.create({
        baseURL: BASE_URL,
        httpsAgent: agent,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      });

      this.config = { certPath, passphrase };
      logger.info('[ConformidadeFácil] Certificado carregado — API disponível');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ConformidadeFácil] Erro ao carregar certificado:', msg);
    }
  }

  isAvailable(): boolean {
    this.init();
    return this.client !== null;
  }

  /**
   * Consulta tabela CST / cClassTrib (Classificação Tributária)
   * Filtros opcionais: codigoCST, nomeCST
   */
  async consultarClassTrib(
    codigoCST?: string,
    nomeCST?: string
  ): Promise<ConformidadeFacilResult<ClassTribItem[]>> {
    this.init();
    if (!this.client) {
      return { success: false, disabled: true, error: 'API Conformidade Fácil não configurada (certificado ausente)' };
    }

    try {
      const params: Record<string, string> = {};
      if (codigoCST) params.codigoCST = codigoCST;
      if (nomeCST) params.nomeCST = nomeCST;

      const response = await this.client.get<ClassTribItem[]>('/classTrib', { params });
      return { success: true, data: response.data ?? [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ConformidadeFácil] Erro ao consultar classTrib:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Consulta Crédito Presumido
   */
  async consultarCredPresumido(): Promise<ConformidadeFacilResult<unknown>> {
    this.init();
    if (!this.client) {
      return { success: false, disabled: true, error: 'API Conformidade Fácil não configurada' };
    }

    try {
      const response = await this.client.get('/credPresumido');
      return { success: true, data: response.data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ConformidadeFácil] Erro ao consultar credPresumido:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Consulta Anexos
   */
  async consultarAnexos(): Promise<ConformidadeFacilResult<unknown>> {
    this.init();
    if (!this.client) {
      return { success: false, disabled: true, error: 'API Conformidade Fácil não configurada' };
    }

    try {
      const response = await this.client.get('/anexos');
      return { success: true, data: response.data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ConformidadeFácil] Erro ao consultar anexos:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Consulta Indicadores dos Locais de Operação
   */
  async consultarIndOper(): Promise<ConformidadeFacilResult<unknown>> {
    this.init();
    if (!this.client) {
      return { success: false, disabled: true, error: 'API Conformidade Fácil não configurada' };
    }

    try {
      const response = await this.client.get('/indOper');
      return { success: true, data: response.data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[ConformidadeFácil] Erro ao consultar indOper:', msg);
      return { success: false, error: msg };
    }
  }
}

export const conformidadeFacilService = new ConformidadeFacilService();
export default conformidadeFacilService;
