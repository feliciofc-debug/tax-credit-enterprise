import { logger } from '../utils/logger';
import https from 'https';

const SERPRO_AUTH_URL = 'https://autenticacao.sapi.serpro.gov.br/authenticate';
const SERPRO_BASE_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';
const SERPRO_TRIAL_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1';

export interface SerproCredentials {
  consumerKey: string;
  consumerSecret: string;
  certBase64?: string;
  certPassword?: string;
  environment: 'trial' | 'production';
}

export interface SerproTokens {
  accessToken: string;
  jwtToken: string;
  expiresIn: number;
  obtainedAt: number;
}

export interface SerproRequestBody {
  contratante: { numero: string; tipo: number };
  autorPedidoDados: { numero: string; tipo: number };
  contribuinte: { numero: string; tipo: number };
  pedidoDados: {
    idSistema: string;
    idServico: string;
    versaoSistema: string;
    dados: string;
  };
}

export interface SerproResponse {
  status: number;
  dados: string;
  mensagens?: Array<{ codigo: string; texto: string }>;
}

const CATALOG = {
  procuracoes: { idSistema: 'PROCURACOES', idServico: 'OBTERPROCURACAO41', versao: '1', tipo: 'Consultar' },
  dctfweb_recibo: { idSistema: 'DCTFWEB', idServico: 'CONSRECIBO32', versao: '1.0', tipo: 'Consultar' },
  dctfweb_completa: { idSistema: 'DCTFWEB', idServico: 'CONSDECCOMPLETA33', versao: '1.0', tipo: 'Consultar' },
  dctfweb_xml: { idSistema: 'DCTFWEB', idServico: 'CONSXMLDECLARACAO38', versao: '1.0', tipo: 'Consultar' },
  dctfweb_transmitir: { idSistema: 'DCTFWEB', idServico: 'TRANSDECLARACAO310', versao: '1.0', tipo: 'Declarar' },
  pagamentos: { idSistema: 'PAGTOWEB', idServico: 'PAGAMENTOS71', versao: '1.0', tipo: 'Consultar' },
  comprovante_arrecadacao: { idSistema: 'PAGTOWEB', idServico: 'COMPARRECADACAO72', versao: '1.0', tipo: 'Emitir' },
  sitfis_protocolo: { idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91', versao: '1.0', tipo: 'Apoiar' },
  sitfis_relatorio: { idSistema: 'SITFIS', idServico: 'RELATORIOSITFIS92', versao: '1.0', tipo: 'Emitir' },
  caixa_postal_msgs: { idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61', versao: '1.0', tipo: 'Consultar' },
  caixa_postal_detalhe: { idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62', versao: '1.0', tipo: 'Consultar' },
  caixa_postal_novas: { idSistema: 'CAIXAPOSTAL', idServico: 'INNOVAMSG63', versao: '1.0', tipo: 'Monitorar' },
  eprocesso_consultar: { idSistema: 'EPROCESSO', idServico: 'CONSPROCPORINTER271', versao: '1.0', tipo: 'Consultar' },
  sicalc_gerar_darf: { idSistema: 'SICALC', idServico: 'CONSOLIDARGERARDARF51', versao: '1.0', tipo: 'Emitir' },
  sicalc_receitas: { idSistema: 'SICALC', idServico: 'CONSULTAAPOIORECEITAS52', versao: '1.0', tipo: 'Apoiar' },
  pgdasd_extrato: { idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', versao: '1.0', tipo: 'Consultar' },
  pgdasd_declaracoes: { idSistema: 'PGDASD', idServico: 'CONSDECLARACAO13', versao: '1.0', tipo: 'Consultar' },
  eventos_pj: { idSistema: 'EVENTOSATUALIZACAO', idServico: 'SOLICEVENTOSPJ132', versao: '1.0', tipo: 'Monitorar' },
  autenticar_procurador: { idSistema: 'AUTENTICAPROCURADOR', idServico: 'ENVIOXMLASSINADO81', versao: '1.0', tipo: 'Apoiar' },
  // === Onda 3 — Coletas federais via procuracao ===
  perdcomp_consulta: { idSistema: 'PERDCOMP', idServico: 'CONSPERDCOMP21', versao: '1.0', tipo: 'Consultar' },
  perdcomp_lista: { idSistema: 'PERDCOMP', idServico: 'LISTARPERDCOMP22', versao: '1.0', tipo: 'Consultar' },
  perdcomp_despacho: { idSistema: 'PERDCOMP', idServico: 'CONSDESPACHO23', versao: '1.0', tipo: 'Consultar' },
  dctf_consultar: { idSistema: 'DCTF', idServico: 'CONSDECLARACAO15', versao: '1.0', tipo: 'Consultar' },
  dctf_recibo: { idSistema: 'DCTF', idServico: 'CONSRECIBO16', versao: '1.0', tipo: 'Consultar' },
  dirf_consultar: { idSistema: 'DIRF', idServico: 'CONSDECLARACAO17', versao: '1.0', tipo: 'Consultar' },
  fontes_pagadoras: { idSistema: 'FONTESPAG', idServico: 'CONSFONTES18', versao: '1.0', tipo: 'Consultar' },
  caixa_postal_detalhe2: { idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62', versao: '1.0', tipo: 'Consultar' },
  parcelamento_pgfn: { idSistema: 'PARCPGFN', idServico: 'CONSPARCSIMP41', versao: '1.0', tipo: 'Consultar' },
  parcelamento_rfb: { idSistema: 'PARCRFB', idServico: 'CONSPARCDEB42', versao: '1.0', tipo: 'Consultar' },
} as const;

export type SerproServiceName = keyof typeof CATALOG;

class SerproService {
  private tokenCache = new Map<string, SerproTokens>();

  private getBaseUrl(env: 'trial' | 'production'): string {
    return env === 'trial' ? SERPRO_TRIAL_URL : SERPRO_BASE_URL;
  }

  private getCacheKey(creds: SerproCredentials): string {
    return `${creds.consumerKey}:${creds.environment}`;
  }

  private isTokenValid(tokens: SerproTokens): boolean {
    const elapsed = (Date.now() - tokens.obtainedAt) / 1000;
    return elapsed < (tokens.expiresIn - 60);
  }

  async authenticate(creds: SerproCredentials): Promise<SerproTokens> {
    const cacheKey = this.getCacheKey(creds);
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.isTokenValid(cached)) return cached;

    if (creds.environment === 'trial') {
      const trialToken: SerproTokens = {
        accessToken: '06aef429-a981-3ec5-a1f8-71d38d86481e',
        jwtToken: '',
        expiresIn: 3600,
        obtainedAt: Date.now(),
      };
      this.tokenCache.set(cacheKey, trialToken);
      return trialToken;
    }

    const basic = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64');

    const requestOptions: any = {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (creds.certBase64 && creds.certPassword) {
      const pfxBuffer = Buffer.from(creds.certBase64, 'base64');
      requestOptions.pfx = pfxBuffer;
      requestOptions.passphrase = creds.certPassword;
    }

    const body = 'grant_type=client_credentials';

    const response = await this.httpRequest(SERPRO_AUTH_URL, requestOptions, body);
    const data = JSON.parse(response);

    const tokens: SerproTokens = {
      accessToken: data.access_token,
      jwtToken: data.jwt_token || '',
      expiresIn: data.expires_in || 1800,
      obtainedAt: Date.now(),
    };

    this.tokenCache.set(cacheKey, tokens);
    logger.info(`[SERPRO] Autenticado com sucesso (env=${creds.environment})`);
    return tokens;
  }

  async callService(
    creds: SerproCredentials,
    serviceName: SerproServiceName,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    dados: Record<string, any>,
    autorCpfOrCnpj?: string,
    autorTipo?: number,
  ): Promise<{ success: boolean; data: any; raw: any; durationMs: number }> {
    const start = Date.now();
    const catalog = CATALOG[serviceName];
    if (!catalog) throw new Error(`Servico SERPRO desconhecido: ${serviceName}`);

    const tokens = await this.authenticate(creds);
    const baseUrl = this.getBaseUrl(creds.environment);
    const url = `${baseUrl}/${catalog.tipo}`;

    const requestBody: SerproRequestBody = {
      contratante: { numero: contratanteCnpj.replace(/\D/g, ''), tipo: 2 },
      autorPedidoDados: {
        numero: (autorCpfOrCnpj || contratanteCnpj).replace(/\D/g, ''),
        tipo: autorTipo || (autorCpfOrCnpj && autorCpfOrCnpj.replace(/\D/g, '').length === 11 ? 1 : 2),
      },
      contribuinte: { numero: contribuinteCnpj.replace(/\D/g, ''), tipo: 2 },
      pedidoDados: {
        idSistema: catalog.idSistema,
        idServico: catalog.idServico,
        versaoSistema: catalog.versao,
        dados: JSON.stringify(dados),
      },
    };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (tokens.jwtToken) {
      headers['jwt_token'] = tokens.jwtToken;
    }

    try {
      const responseText = await this.httpRequest(url, { method: 'POST', headers }, JSON.stringify(requestBody));
      const response = JSON.parse(responseText);
      const durationMs = Date.now() - start;

      let parsedDados: any = null;
      if (response.dados) {
        try { parsedDados = JSON.parse(response.dados); } catch { parsedDados = response.dados; }
      }

      const success = response.status === 0 || response.status === 200 || !response.mensagens?.some((m: any) => m.codigo?.startsWith('E'));

      return { success, data: parsedDados, raw: response, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      logger.error(`[SERPRO] Erro ao chamar ${serviceName}:`, err.message);
      return { success: false, data: null, raw: { error: err.message }, durationMs };
    }
  }

  async checkProcuracao(
    creds: SerproCredentials,
    contratanteCnpj: string,
    outorganteCnpj: string,
    outorgadoCnpj: string,
  ) {
    return this.callService(creds, 'procuracoes', contratanteCnpj, outorganteCnpj, {
      outorgante: outorganteCnpj.replace(/\D/g, ''),
      tipoOutorgante: '2',
      outorgado: outorgadoCnpj.replace(/\D/g, ''),
      tipoOutorgado: '2',
    });
  }

  /**
   * Cadastra procuracao eletronica programaticamente via SERPRO
   * AUTENTICAPROCURADOR/ENVIOXMLASSINADO81.
   *
   * IMPORTANTE: esse fluxo exige um XML de procuracao previamente
   * assinado digitalmente pelo OUTORGANTE (cert ICP-Brasil do cliente
   * final). Sem isso, retorna { sent:false, reason:'cert_outorgante_indisponivel' }
   * e o caller deve cair para o fluxo manual (link magico).
   *
   * Contratos SERPRO padrao nao incluem esse servico — o caller checa
   * disponibilidade chamando primeiro.
   */
  async cadastrarProcuracaoAuto(
    creds: SerproCredentials,
    contratanteCnpj: string,
    outorganteCnpj: string,
    outorgadoCnpj: string,
    xmlAssinadoBase64?: string,
    poderes?: string[],
  ): Promise<{ success: boolean; protocol?: string; reason?: string; raw?: any }> {
    if (!xmlAssinadoBase64) {
      return { success: false, reason: 'xml_assinado_outorgante_indisponivel' };
    }
    try {
      const result = await this.callService(
        creds,
        'autenticar_procurador',
        contratanteCnpj,
        outorganteCnpj,
        {
          outorgante: outorganteCnpj.replace(/\D/g, ''),
          tipoOutorgante: '2',
          outorgado: outorgadoCnpj.replace(/\D/g, ''),
          tipoOutorgado: '2',
          xmlAssinado: xmlAssinadoBase64,
          poderes: poderes || [],
        },
      );
      if (!result.success) {
        return { success: false, reason: 'serpro_recusou', raw: result.raw };
      }
      const protocol = (result.data && (result.data.protocolo || result.data.protocol)) || undefined;
      return { success: true, protocol, raw: result.raw };
    } catch (err: any) {
      return { success: false, reason: err.message, raw: null };
    }
  }

  /**
   * Verifica se o contrato/conexao SERPRO atual permite usar
   * AUTENTICAPROCURADOR. Chama uma operacao "leve" e interpreta o
   * codigo de erro retornado.
   */
  async checkAutoGrantCapability(
    creds: SerproCredentials,
    contratanteCnpj: string,
  ): Promise<{ supported: boolean; reason?: string }> {
    try {
      // tenta callService com payload vazio so para ver se o servico esta habilitado
      const result = await this.callService(
        creds,
        'autenticar_procurador',
        contratanteCnpj,
        contratanteCnpj,
        { outorgante: contratanteCnpj.replace(/\D/g, ''), tipoOutorgante: '2' },
      );
      const raw = JSON.stringify(result.raw || {}).toLowerCase();
      if (raw.includes('nao autorizado') || raw.includes('not authorized') || raw.includes('servico nao contratado')) {
        return { supported: false, reason: 'servico_nao_contratado' };
      }
      return { supported: true };
    } catch (err: any) {
      return { supported: false, reason: err.message };
    }
  }

  async consultarPagamentos(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    periodo: string,
  ) {
    return this.callService(creds, 'pagamentos', contratanteCnpj, contribuinteCnpj, { periodo });
  }

  async consultarDCTFWeb(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    pa: string,
  ) {
    return this.callService(creds, 'dctfweb_completa', contratanteCnpj, contribuinteCnpj, {
      cnpjBasico: contribuinteCnpj.replace(/\D/g, '').substring(0, 8),
      pa,
      dataConsolidacao: null,
    });
  }

  async solicitarSituacaoFiscal(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'sitfis_protocolo', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async obterRelatorioSitFis(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    protocolo: string,
  ) {
    return this.callService(creds, 'sitfis_relatorio', contratanteCnpj, contribuinteCnpj, { protocolo });
  }

  async consultarCaixaPostal(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'caixa_postal_msgs', contratanteCnpj, contribuinteCnpj, {
      ni: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async consultarNovasMensagens(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'caixa_postal_novas', contratanteCnpj, contribuinteCnpj, {
      ni: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async consultarProcessos(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'eprocesso_consultar', contratanteCnpj, contribuinteCnpj, {
      ni: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async consultarExtratoSimples(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    numeroDas: string,
  ) {
    return this.callService(creds, 'pgdasd_extrato', contratanteCnpj, contribuinteCnpj, { numeroDas });
  }

  // ============================================================
  // PER/DCOMP — Pedidos de Restituicao e Compensacao
  // ============================================================
  async listarPerdcomp(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    periodoInicio?: string,
    periodoFim?: string,
  ) {
    return this.callService(creds, 'perdcomp_lista', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
      ...(periodoInicio ? { periodoInicio } : {}),
      ...(periodoFim ? { periodoFim } : {}),
    });
  }

  async consultarPerdcomp(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    numero: string,
  ) {
    return this.callService(creds, 'perdcomp_consulta', contratanteCnpj, contribuinteCnpj, {
      numero,
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async consultarDespachoPerdcomp(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    numero: string,
  ) {
    return this.callService(creds, 'perdcomp_despacho', contratanteCnpj, contribuinteCnpj, {
      numero,
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  // ============================================================
  // DCTF (classica, nao Web)
  // ============================================================
  async consultarDCTF(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    pa: string,
  ) {
    return this.callService(creds, 'dctf_consultar', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
      pa,
    });
  }

  async consultarReciboDCTF(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    pa: string,
  ) {
    return this.callService(creds, 'dctf_recibo', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
      pa,
    });
  }

  // ============================================================
  // DIRF
  // ============================================================
  async consultarDIRF(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    anoBase: number,
  ) {
    return this.callService(creds, 'dirf_consultar', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
      anoBase,
    });
  }

  // ============================================================
  // Fontes Pagadoras
  // ============================================================
  async consultarFontesPagadoras(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    anoBase: number,
  ) {
    return this.callService(creds, 'fontes_pagadoras', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
      anoBase,
    });
  }

  // ============================================================
  // Caixa Postal — detalhe de mensagem especifica
  // ============================================================
  async detalharCaixaPostal(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
    isn: string,
  ) {
    return this.callService(creds, 'caixa_postal_detalhe2', contratanteCnpj, contribuinteCnpj, {
      ni: contribuinteCnpj.replace(/\D/g, ''),
      isn,
    });
  }

  // ============================================================
  // Parcelamentos
  // ============================================================
  async consultarParcelamentoPGFN(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'parcelamento_pgfn', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  async consultarParcelamentoRFB(
    creds: SerproCredentials,
    contratanteCnpj: string,
    contribuinteCnpj: string,
  ) {
    return this.callService(creds, 'parcelamento_rfb', contratanteCnpj, contribuinteCnpj, {
      cnpj: contribuinteCnpj.replace(/\D/g, ''),
    });
  }

  getAvailableServices(): Array<{ name: string; key: SerproServiceName; description: string; tipo: string; status: string }> {
    return [
      { name: 'Verificar Procuracao', key: 'procuracoes', description: 'Verifica procuracao eletronica entre outorgante e procurador', tipo: 'Consultar', status: 'ativo' },
      { name: 'Consultar Pagamentos (DARFs)', key: 'pagamentos', description: 'Lista pagamentos/DARFs recolhidos pelo contribuinte', tipo: 'Consultar', status: 'ativo' },
      { name: 'Comprovante Arrecadacao', key: 'comprovante_arrecadacao', description: 'Emite comprovante de arrecadacao de pagamento', tipo: 'Emitir', status: 'ativo' },
      { name: 'DCTFWeb Completa', key: 'dctfweb_completa', description: 'Consulta declaracao DCTFWeb completa', tipo: 'Consultar', status: 'ativo' },
      { name: 'DCTFWeb Recibo', key: 'dctfweb_recibo', description: 'Consulta recibo da declaracao DCTFWeb', tipo: 'Consultar', status: 'ativo' },
      { name: 'DCTFWeb XML', key: 'dctfweb_xml', description: 'Consulta XML da declaracao DCTFWeb', tipo: 'Consultar', status: 'ativo' },
      { name: 'Situacao Fiscal (solicitar)', key: 'sitfis_protocolo', description: 'Solicita protocolo para relatorio de situacao fiscal', tipo: 'Apoiar', status: 'ativo' },
      { name: 'Situacao Fiscal (relatorio)', key: 'sitfis_relatorio', description: 'Emite relatorio de situacao fiscal', tipo: 'Emitir', status: 'ativo' },
      { name: 'Caixa Postal — Mensagens', key: 'caixa_postal_msgs', description: 'Consulta mensagens na caixa postal do contribuinte', tipo: 'Consultar', status: 'ativo' },
      { name: 'Caixa Postal — Novas', key: 'caixa_postal_novas', description: 'Verifica se ha novas mensagens na caixa postal', tipo: 'Monitorar', status: 'ativo' },
      { name: 'e-Processo', key: 'eprocesso_consultar', description: 'Consulta processos fiscais por interessado', tipo: 'Consultar', status: 'ativo' },
      { name: 'Gerar DARF (Sicalc)', key: 'sicalc_gerar_darf', description: 'Consolida e emite DARF em PDF', tipo: 'Emitir', status: 'ativo' },
      { name: 'Extrato DAS (Simples)', key: 'pgdasd_extrato', description: 'Consulta extrato do DAS do Simples Nacional', tipo: 'Consultar', status: 'ativo' },
      { name: 'Declaracoes PGDASD', key: 'pgdasd_declaracoes', description: 'Consulta declaracoes transmitidas do PGDAS-D', tipo: 'Consultar', status: 'ativo' },
      { name: 'Eventos Atualizacao PJ', key: 'eventos_pj', description: 'Solicita eventos de atualizacao de PJ em lote', tipo: 'Monitorar', status: 'ativo' },
      // Onda 3 — coletas via procuracao
      { name: 'PER/DCOMP — Listar',     key: 'perdcomp_lista',    description: 'Lista PER/DCOMP transmitidos pelo contribuinte', tipo: 'Consultar', status: 'ativo' },
      { name: 'PER/DCOMP — Detalhe',    key: 'perdcomp_consulta', description: 'Consulta um PER/DCOMP especifico (conteudo completo)', tipo: 'Consultar', status: 'ativo' },
      { name: 'PER/DCOMP — Despacho',   key: 'perdcomp_despacho', description: 'Consulta despacho decisorio do PER/DCOMP', tipo: 'Consultar', status: 'ativo' },
      { name: 'DCTF (classica)',        key: 'dctf_consultar',    description: 'Consulta declaracao DCTF (nao DCTFWeb) por periodo', tipo: 'Consultar', status: 'ativo' },
      { name: 'DCTF — Recibo',          key: 'dctf_recibo',       description: 'Recibo da DCTF classica', tipo: 'Consultar', status: 'ativo' },
      { name: 'DIRF',                   key: 'dirf_consultar',    description: 'Consulta declaracao DIRF do ano-base', tipo: 'Consultar', status: 'ativo' },
      { name: 'Fontes Pagadoras',       key: 'fontes_pagadoras',  description: 'Lista fontes pagadoras informadas a Receita', tipo: 'Consultar', status: 'ativo' },
      { name: 'Caixa Postal — Detalhe', key: 'caixa_postal_detalhe2', description: 'Detalha mensagem especifica da caixa postal', tipo: 'Consultar', status: 'ativo' },
      { name: 'Parcelamento PGFN',      key: 'parcelamento_pgfn', description: 'Consulta parcelamentos PGFN ativos do contribuinte', tipo: 'Consultar', status: 'ativo' },
      { name: 'Parcelamento RFB',       key: 'parcelamento_rfb',  description: 'Consulta parcelamentos RFB ativos do contribuinte', tipo: 'Consultar', status: 'ativo' },
    ];
  }

  private httpRequest(url: string, options: any, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'POST',
        headers: options.headers || {},
        ...(options.pfx ? { pfx: options.pfx, passphrase: options.passphrase } : {}),
        rejectUnauthorized: true,
        timeout: 30000,
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

      if (body) req.write(body);
      req.end();
    });
  }
}

export const serproService = new SerproService();
export default serproService;
