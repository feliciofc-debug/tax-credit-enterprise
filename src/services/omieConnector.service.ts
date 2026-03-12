import axios from 'axios';
import { logger } from '../utils/logger';

const OMIE_BASE = 'https://app.omie.com.br/api/v1';

export interface OmieConfig {
  appKey: string;
  appSecret: string;
}

export interface OmieNFe {
  nNF: string;
  serie: string;
  dEmi: string;
  cnpjEmit: string;
  nomeEmit: string;
  valorTotal: number;
  itens: OmieNFeItem[];
}

export interface OmieNFeItem {
  cProd: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  vProd: number;
  vICMSST: number;
  CSOSN: string;
}

async function omieCall(endpoint: string, method: string, params: any, config: OmieConfig): Promise<any> {
  const url = `${OMIE_BASE}${endpoint}`;
  const body = {
    call: method,
    app_key: config.appKey,
    app_secret: config.appSecret,
    param: [params],
  };

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  return response.data;
}

export class OmieConnector {
  private config: OmieConfig;

  constructor(config: OmieConfig) {
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; empresa?: string; error?: string }> {
    try {
      const data = await omieCall('/geral/empresas/', 'ListarEmpresas', {
        pagina: 1,
        registros_por_pagina: 1,
      }, this.config);
      const empresa = data?.empresas_cadastro?.[0]?.razao_social || 'Conectado';
      return { success: true, empresa };
    } catch (err: any) {
      logger.error('[Omie] Teste de conexão falhou:', err.message);
      return { success: false, error: err.response?.data?.faultstring || err.message };
    }
  }

  async fetchNFes(params: { pagina?: number; dtInicio?: string; dtFim?: string } = {}): Promise<{ nfes: OmieNFe[]; totalPages: number }> {
    try {
      const reqParams: any = {
        pagina: params.pagina || 1,
        registros_por_pagina: 50,
        apenas_importado_api: 'N',
      };

      if (params.dtInicio) reqParams.filtrar_por_data_de = params.dtInicio;
      if (params.dtFim) reqParams.filtrar_por_data_ate = params.dtFim;

      const data = await omieCall('/produtos/nfconsultar/', 'ListarNF', reqParams, this.config);

      const totalPages = data?.total_de_paginas || 1;
      const rawNfes = data?.nfCadastro || [];

      const nfes: OmieNFe[] = rawNfes.map((nf: any) => ({
        nNF: nf.cabecalho?.nNF || '',
        serie: nf.cabecalho?.serie || '',
        dEmi: nf.cabecalho?.dEmi || '',
        cnpjEmit: nf.cabecalho?.cnpj_emitente || '',
        nomeEmit: nf.cabecalho?.nome_emitente || '',
        valorTotal: parseFloat(nf.cabecalho?.vNF || '0'),
        itens: (nf.det || []).map((det: any) => ({
          cProd: det.prod?.cProd || '',
          xProd: det.prod?.xProd || '',
          NCM: det.prod?.NCM || '',
          CFOP: det.prod?.CFOP || '',
          vProd: parseFloat(det.prod?.vProd || '0'),
          vICMSST: parseFloat(det.imposto?.ICMS?.vICMSST || '0'),
          CSOSN: det.imposto?.ICMS?.CSOSN || '',
        })),
      }));

      return { nfes, totalPages };
    } catch (err: any) {
      logger.error('[Omie] Erro ao buscar NFes:', err.message);
      throw new Error(`Omie API: ${err.response?.data?.faultstring || err.message}`);
    }
  }

  async fetchAllNFes(dtInicio?: string, dtFim?: string): Promise<OmieNFe[]> {
    const allNfes: OmieNFe[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.fetchNFes({ pagina: page, dtInicio, dtFim });
      allNfes.push(...result.nfes);
      totalPages = result.totalPages;
      page++;
    } while (page <= totalPages && page <= 100);

    logger.info(`[Omie] Fetched ${allNfes.length} NFes (${totalPages} pages)`);
    return allNfes;
  }

  toNFeItems(nfes: OmieNFe[]): { items: import('./simplesRecovery.service').NFeItem[]; totalNfes: number } {
    const items: import('./simplesRecovery.service').NFeItem[] = [];

    for (const nfe of nfes) {
      const competencia = nfe.dEmi ? nfe.dEmi.substring(3) : undefined; // DD/MM/YYYY -> MM/YYYY
      for (const item of nfe.itens) {
        if (item.NCM && item.vProd > 0) {
          items.push({
            ncm: item.NCM,
            descricao: item.xProd,
            cfop: item.CFOP,
            csosn: item.CSOSN,
            valorProduto: item.vProd,
            valorIcmsSt: item.vICMSST,
            competencia,
          });
        }
      }
    }

    return { items, totalNfes: nfes.length };
  }
}
