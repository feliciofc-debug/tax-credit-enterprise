// ============================================================
// TAXCREDIT ENTERPRISE — ZIP UPLOAD + SPED EFD PARSER
// ============================================================
// Aceita: .zip (extrai automaticamente), .pdf, .txt (SPED), .xlsx
// Classifica: SPED, NFe, Demonstrativos, Contratos
// Deduplicação inteligente por nome/período
// Parser de SPED EFD com registros 0000, C100, C190, E110, E111
// ============================================================

import AdmZip from 'adm-zip';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import path from 'path';
import { logger } from '../utils/logger';

// ============================================================
// TIPOS
// ============================================================

export interface ProcessedDocument {
  tipo: 'sped' | 'pdf' | 'excel' | 'txt' | 'docx' | 'desconhecido';
  nome: string;
  conteudo: string;
  tamanho: number;
  paginas?: number;
  linhas?: number;
}

export interface SpedDocument extends ProcessedDocument {
  tipo: 'sped';
  /** 'efd-icms' | 'efd-contribuicoes' | 'ecf' | 'ecd' | 'unknown' */
  tipoSped?: string;
  versao: string;
  periodo: { inicio: string; fim: string };
  empresa: string;
  cnpj: string;
  ie: string;
  uf: string;
  fantasia?: string;
  resumo: SpedResumo;
  efdContrib?: EfdContribData;
  ecf?: EcfData;
  ecd?: EcdData;
}

export interface CfopBreakdown {
  cfop: string;
  vlOpr: number;
  vlPis: number;
  vlCofins: number;
}

/** Uma operação individual (C190) para extrato detalhado por operação */
export interface OperacaoExtrato {
  cfop: string;
  vlOpr: number;
  vlPis: number;
  vlCofins: number;
}

interface SpedResumo {
  totalEntradas: number;
  totalSaidas: number;
  icmsCreditos: number;
  icmsDebitos: number;
  saldoCredor: number;
  saldoDevedor: number;
  saldoAnterior: number;
  numNfes: number;
  operacoes: SpedOperacao[];
  cfopBreakdown?: CfopBreakdown[];
  /** Operações individuais (uma por C190) para extrato detalhado */
  operacoesExtrato?: OperacaoExtrato[];
}

interface SpedOperacao {
  tipo: 'ENTRADA' | 'SAÍDA';
  nf: string;
  valor: number;
  bcIcms: number;
  icms: number;
  pis: number;
  cofins: number;
}

/** EFD Contribuições — PIS/COFINS reais */
export interface EfdContribData {
  tipo: 'efd-contribuicoes';
  empresa: string;
  cnpj: string;
  periodo: { inicio: string; fim: string };
  /** M200 — Apuração PIS */
  pisTotalCredito: number;
  pisTotalDebito: number;
  pisSaldoCredor: number;
  /** M600 — Apuração COFINS */
  cofinsTotalCredito: number;
  cofinsTotalDebito: number;
  cofinsSaldoCredor: number;
  /** M100/M500 — Créditos detalhados */
  creditosPis: Array<{ cstPis: string; vlCredito: number; descricao: string }>;
  creditosCofins: Array<{ cstCofins: string; vlCredito: number; descricao: string }>;
  /** F100 — Demais créditos */
  demaisCreditos: Array<{ natureza: string; vlOpr: number; vlPis: number; vlCofins: number }>;
  textoFormatado: string;
}

/** ECF — IRPJ/CSLL */
export interface EcfData {
  tipo: 'ecf';
  empresa: string;
  cnpj: string;
  periodo: { inicio: string; fim: string };
  formaApuracao: string;
  /** N620 — IRPJ */
  irpjBaseCalculo: number;
  irpjDevido: number;
  irpjRetido: number;
  irpjAPagar: number;
  /** N630 — CSLL */
  csllBaseCalculo: number;
  csllDevido: number;
  csllRetido: number;
  csllAPagar: number;
  /** M300 — LALUR Parte A */
  lucroPrejuizoContabil: number;
  adicoes: number;
  exclusoes: number;
  lucroReal: number;
  textoFormatado: string;
}

/** Conta contábil do plano de contas (I050) */
export interface ContaContabil {
  codigo: string;
  descricao: string;
  /** COD_NAT: 01=Ativo, 02=Passivo, 03=PL, 04=Receita, 05=Despesa/Custo, 09=Outros */
  natureza: string;
  /** 'A' = Analítica (detail), 'S' = Sintética (group) */
  indCta: string;
  nivel: number;
  contaSuperior: string;
}

/** Movimento de uma conta em um período (I155) */
export interface MovimentoConta {
  codCta: string;
  descricao: string;
  natureza: string;
  ano: number;
  dtIni: string;
  dtFin: string;
  vlDeb: number;
  vlCred: number;
  vlSldIni: number;
  vlSldFin: number;
  indDcFin: string;
}

/** Agregação anual de uma conta */
export interface ContaAnual {
  codCta: string;
  descricao: string;
  natureza: string;
  anos: Array<{
    ano: number;
    baseCalculo: number;
    vlPis: number;
    vlCofins: number;
    totalCreditos: number;
  }>;
  totalBase: number;
  totalPis: number;
  totalCofins: number;
  totalCreditos: number;
}

/** ECD — Escrituração Contábil Digital */
export interface EcdData {
  tipo: 'ecd';
  empresa: string;
  cnpj: string;
  periodo: { inicio: string; fim: string };
  /** I050 — Plano de contas */
  planoContas: ContaContabil[];
  /** I155 — Saldos periódicos (balancete) */
  saldos: Array<{ conta: string; descricao: string; saldoInicial: number; debitos: number; creditos: number; saldoFinal: number }>;
  /** Movimentos detalhados por conta + período */
  movimentosDetalhados: MovimentoConta[];
  totalAtivo: number;
  totalPassivo: number;
  receitaBruta: number;
  textoFormatado: string;
}

export interface ZipProcessResult {
  empresa: { nome: string; cnpj: string; ie: string; uf: string; fantasia: string } | null;
  documentos: ProcessedDocument[];
  speds: SpedDocument[];
  efdContribs: EfdContribData[];
  ecfs: EcfData[];
  ecds: EcdData[];
  nfes: ProcessedDocument[];
  demonstrativos: ProcessedDocument[];
  contratos: ProcessedDocument[];
  outros: ProcessedDocument[];
  resumo: {
    totalArquivos: number;
    processados: number;
    ignorados: number;
    erros: string[];
    tiposEncontrados: string[];
  };
}

// ============================================================
// 1. PROCESSADOR PRINCIPAL
// ============================================================

class ZipProcessorService {
  /**
   * Processa qualquer arquivo: ZIP, PDF, TXT/SPED, Excel
   * Se for ZIP, extrai e processa cada arquivo interno
   */
  async processUpload(fileBuffer: Buffer, originalName: string, mimeType?: string): Promise<ZipProcessResult> {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.zip' || mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
      return await this.processZipFile(fileBuffer, originalName);
    }

    // Arquivo individual — encapsular em resultado ZIP-like
    const result = this.createEmptyResult();
    try {
      const docs = await this.processSingleFile(fileBuffer, originalName, ext);
      for (const doc of docs) {
        this.classifyDocument(doc, result);
        result.resumo.processados++;
      }
    } catch (err: any) {
      result.resumo.erros.push(`${originalName}: ${err.message}`);
    }
    result.resumo.totalArquivos = 1;
    return result;
  }

  /**
   * Extrai ZIP e processa cada arquivo relevante
   */
  async processZipFile(zipBuffer: Buffer, zipName: string): Promise<ZipProcessResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const result = this.createEmptyResult();
    const processedNames = new Set<string>();

    logger.info(`Processando ZIP: ${zipName} com ${entries.length} entradas`);

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const basename = path.basename(entry.entryName);
      const ext = path.extname(basename).toLowerCase();
      result.resumo.totalArquivos++;

      // Ignorar arquivos desnecessários
      if (['.rec', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico'].includes(ext)) {
        result.resumo.ignorados++;
        continue;
      }

      // Ignorar arquivos > 5MB
      if (entry.header.size > 5 * 1024 * 1024) {
        result.resumo.ignorados++;
        result.resumo.erros.push(`${basename}: arquivo muito grande (${(entry.header.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      // Deduplicar
      const dedupKey = this.getDedupKey(basename, ext);
      if (processedNames.has(dedupKey)) {
        result.resumo.ignorados++;
        continue;
      }
      processedNames.add(dedupKey);

      // Processar
      try {
        const buffer = entry.getData();
        const docs = await this.processSingleFile(buffer, basename, ext);
        for (const doc of docs) {
          this.classifyDocument(doc, result);
          result.resumo.processados++;
        }
      } catch (err: any) {
        result.resumo.erros.push(`${basename}: ${err.message}`);
      }
    }

    // Extrair dados da empresa dos SPEDs
    if (result.speds.length > 0) {
      const firstSped = result.speds[0] as SpedDocument;
      result.empresa = {
        nome: firstSped.empresa,
        cnpj: firstSped.cnpj,
        ie: firstSped.ie,
        uf: firstSped.uf,
        fantasia: firstSped.fantasia || '',
      };
    }

    result.resumo.tiposEncontrados = [...new Set(result.documentos.map(d => d.tipo))];

    logger.info(`ZIP processado: ${result.resumo.processados} de ${result.resumo.totalArquivos} arquivos`, {
      speds: result.speds.length,
      demonstrativos: result.demonstrativos.length,
      nfes: result.nfes.length,
    });

    return result;
  }

  /**
   * Processa arquivo individual
   */
  async processSingleFile(buffer: Buffer, filename: string, ext?: string): Promise<ProcessedDocument[]> {
    if (!ext) ext = path.extname(filename).toLowerCase();

    switch (ext) {
      case '.pdf':
        return [await this.processPdf(buffer, filename)];
      case '.txt':
        return [this.processTxt(buffer, filename)];
      case '.xlsx':
      case '.xls':
      case '.csv':
        return [this.processExcel(buffer, filename)];
      default:
        return [{ tipo: 'desconhecido', nome: filename, conteudo: '', tamanho: buffer.length }];
    }
  }

  // ============================================================
  // 2. PROCESSADORES POR TIPO
  // ============================================================

  private async processPdf(buffer: Buffer, filename: string): Promise<ProcessedDocument> {
    try {
      const data = await pdfParse(buffer);
      return {
        tipo: 'pdf',
        nome: filename,
        conteudo: data.text || '',
        paginas: data.numpages,
        tamanho: buffer.length,
      };
    } catch (err: any) {
      return {
        tipo: 'pdf',
        nome: filename,
        conteudo: `[Erro ao extrair PDF: ${err.message}]`,
        paginas: 0,
        tamanho: buffer.length,
      };
    }
  }

  private processTxt(buffer: Buffer, filename: string): ProcessedDocument | SpedDocument {
    // SPEDs usam ISO-8859-1 (latin1)
    const content = buffer.toString('latin1');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Verificar se é SPED (começa com |0000|)
    if (lines.length > 0 && lines[0].startsWith('|0000|')) {
      return this.parseSped(lines, filename, buffer.length);
    }

    return {
      tipo: 'txt',
      nome: filename,
      conteudo: content.substring(0, 50000),
      tamanho: buffer.length,
      linhas: lines.length,
    };
  }

  private processExcel(buffer: Buffer, filename: string): ProcessedDocument {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const texts: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        texts.push(`\n=== PLANILHA: ${sheetName} ===\n`);
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        for (const row of data) {
          if (Array.isArray(row)) {
            const rowText = row.map(cell => String(cell ?? '').trim()).filter(c => c.length > 0).join(' | ');
            if (rowText.length > 0) texts.push(rowText);
          }
        }
      }

      return {
        tipo: 'excel',
        nome: filename,
        conteudo: texts.join('\n'),
        tamanho: buffer.length,
      };
    } catch (err: any) {
      return {
        tipo: 'excel',
        nome: filename,
        conteudo: `[Erro ao processar Excel: ${err.message}]`,
        tamanho: buffer.length,
      };
    }
  }

  // ============================================================
  // 3. SPED EFD PARSER
  // ============================================================

  private parseSped(lines: string[], filename: string, fileSize: number): SpedDocument {
    const sped: SpedDocument = {
      tipo: 'sped',
      nome: filename,
      conteudo: '',
      tamanho: fileSize,
      versao: '',
      periodo: { inicio: '', fim: '' },
      empresa: '',
      cnpj: '',
      ie: '',
      uf: '',
      resumo: {
        totalEntradas: 0,
        totalSaidas: 0,
        icmsCreditos: 0,
        icmsDebitos: 0,
        saldoCredor: 0,
        saldoDevedor: 0,
        saldoAnterior: 0,
        numNfes: 0,
        operacoes: [],
      },
    };

    // Registros relevantes para extrair
    const c190Records: string[][] = [];
    const e111Records: string[][] = [];
    const e116Records: string[][] = [];
    const p0150Records: string[][] = [];

    // Para demonstrativo e extrato por operação: C100→C190 (distribuir PIS/COFINS por CFOP)
    let lastC100Pis = 0;
    let lastC100Cofins = 0;
    const c190Temp: { cfop: string; vlOpr: number }[] = [];
    const cfopMap = new Map<string, { vlOpr: number; vlPis: number; vlCofins: number }>();
    const operacoesExtrato: OperacaoExtrato[] = [];

    const PIS_RATE = 0.0165;
    const COFINS_RATE = 0.0760;

    const flushC190ToCfop = () => {
      if (c190Temp.length === 0) return;
      const totalOpr = c190Temp.reduce((s, x) => s + x.vlOpr, 0);
      if (totalOpr <= 0) return;
      const hasC100PisCofins = lastC100Pis > 0 || lastC100Cofins > 0;
      for (const r of c190Temp) {
        let vlPis: number;
        let vlCofins: number;
        if (hasC100PisCofins) {
          const frac = r.vlOpr / totalOpr;
          vlPis = lastC100Pis * frac;
          vlCofins = lastC100Cofins * frac;
        } else {
          vlPis = r.vlOpr * PIS_RATE;
          vlCofins = r.vlOpr * COFINS_RATE;
        }
        const existing = cfopMap.get(r.cfop) || { vlOpr: 0, vlPis: 0, vlCofins: 0 };
        existing.vlOpr += r.vlOpr;
        existing.vlPis += vlPis;
        existing.vlCofins += vlCofins;
        cfopMap.set(r.cfop, existing);
        operacoesExtrato.push({ cfop: r.cfop, vlOpr: r.vlOpr, vlPis, vlCofins });
      }
      c190Temp.length = 0;
    };

    for (const line of lines) {
      const fields = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (!fields[0]) continue;
      const regType = fields[0];

      switch (regType) {
        case '0000':
          sped.versao = fields[1] || '';
          sped.periodo.inicio = this.formatDate(fields[3] || '');
          sped.periodo.fim = this.formatDate(fields[4] || '');
          sped.empresa = fields[5] || '';
          sped.cnpj = this.formatCnpj(fields[6] || '');
          sped.uf = fields[8] || '';
          sped.ie = fields[9] || '';
          break;

        case '0005':
          sped.fantasia = fields[1] || '';
          break;

        case '0150':
          p0150Records.push(fields);
          break;

        case 'C100': {
          flushC190ToCfop();
          const indOper = fields[1]; // 0=entrada, 1=saida
          const numDoc = fields[7] || '';
          const vlDoc = this.parseDecimal(fields[11]);
          const vlBcIcms = this.parseDecimal(fields[20]);
          const vlIcms = this.parseDecimal(fields[21]);
          const vlPis = this.parseDecimal(fields[25]);
          const vlCofins = this.parseDecimal(fields[26]);
          lastC100Pis = vlPis;
          lastC100Cofins = vlCofins;

          if (vlDoc > 0) {
            sped.resumo.numNfes++;
            sped.resumo.operacoes.push({
              tipo: indOper === '0' ? 'ENTRADA' : 'SAÍDA',
              nf: numDoc,
              valor: vlDoc,
              bcIcms: vlBcIcms,
              icms: vlIcms,
              pis: vlPis,
              cofins: vlCofins,
            });
            if (indOper === '0') {
              sped.resumo.totalEntradas += vlDoc;
            } else {
              sped.resumo.totalSaidas += vlDoc;
            }
          }
          break;
        }

        case 'C190': {
          c190Records.push(fields);
          const cfop = fields[2] || '';
          const vlOpr = this.parseDecimal(fields[4] || '');
          if (cfop && vlOpr > 0) c190Temp.push({ cfop, vlOpr });
          break;
        }

        case 'E110':
          sped.resumo.icmsDebitos = this.parseDecimal(fields[1]);
          sped.resumo.icmsCreditos = this.parseDecimal(fields[5]);
          sped.resumo.saldoAnterior = this.parseDecimal(fields[9]);
          sped.resumo.saldoDevedor = this.parseDecimal(fields[12]);
          sped.resumo.saldoCredor = this.parseDecimal(fields[13]);
          break;

        case 'E111':
          e111Records.push(fields);
          break;

        case 'E116':
          e116Records.push(fields);
          break;
      }
    }
    flushC190ToCfop();

    if (cfopMap.size > 0) {
      sped.resumo.cfopBreakdown = Array.from(cfopMap.entries())
        .map(([cfop, v]) => ({ cfop, vlOpr: v.vlOpr, vlPis: v.vlPis, vlCofins: v.vlCofins }))
        .filter(x => x.vlOpr > 0 || x.vlPis > 0 || x.vlCofins > 0);
    }
    if (operacoesExtrato.length > 0) {
      sped.resumo.operacoesExtrato = operacoesExtrato.filter(x => x.vlOpr > 0 || x.vlPis > 0 || x.vlCofins > 0);
    }

    // Montar texto formatado para o Claude
    sped.conteudo = this.formatSpedForClaude(sped, c190Records, e111Records, e116Records, p0150Records);

    // Detect SPED sub-type and parse extra data
    const spedType = this.detectSpedType(lines);
    sped.tipoSped = spedType;

    if (spedType === 'efd-contribuicoes') {
      sped.efdContrib = this.parseEfdContribuicoes(lines, sped);
      sped.conteudo += '\n' + sped.efdContrib.textoFormatado;
      logger.info(`EFD Contribuições parsed: ${sped.empresa} | PIS crédito: R$ ${sped.efdContrib.pisTotalCredito.toLocaleString('pt-BR')} | COFINS crédito: R$ ${sped.efdContrib.cofinsTotalCredito.toLocaleString('pt-BR')}`);
    } else if (spedType === 'ecf') {
      sped.ecf = this.parseEcf(lines, sped);
      sped.conteudo += '\n' + sped.ecf.textoFormatado;
      logger.info(`ECF parsed: ${sped.empresa} | IRPJ: R$ ${sped.ecf.irpjDevido.toLocaleString('pt-BR')} | CSLL: R$ ${sped.ecf.csllDevido.toLocaleString('pt-BR')}`);
    } else if (spedType === 'ecd') {
      sped.ecd = this.parseEcd(lines, sped);
      sped.conteudo += '\n' + sped.ecd.textoFormatado;
      logger.info(`ECD parsed: ${sped.empresa} | ${sped.ecd.saldos.length} contas | Receita bruta: R$ ${sped.ecd.receitaBruta.toLocaleString('pt-BR')}`);
    } else {
      logger.info(`SPED EFD ICMS/IPI parsed: ${sped.empresa} | ${sped.periodo.inicio}-${sped.periodo.fim} | ${sped.resumo.numNfes} NFes | Saldo credor: R$ ${sped.resumo.saldoCredor.toLocaleString('pt-BR')}`);
    }

    return sped;
  }

  /**
   * Detect SPED type by scanning for characteristic registers
   */
  private detectSpedType(lines: string[]): string {
    let hasM = false, hasN = false, hasI050 = false, hasC100 = false, hasE110 = false;
    const sample = lines.slice(0, Math.min(lines.length, 5000));
    for (const line of sample) {
      const reg = line.split('|')[1] || '';
      if (reg === 'M100' || reg === 'M200' || reg === 'M500' || reg === 'M600') hasM = true;
      if (reg === 'N620' || reg === 'N630' || reg === 'N660') hasN = true;
      if (reg === 'I050' || reg === 'I155' || reg === 'I150') hasI050 = true;
      if (reg === 'C100') hasC100 = true;
      if (reg === 'E110') hasE110 = true;
    }
    if (hasM) return 'efd-contribuicoes';
    if (hasN) return 'ecf';
    if (hasI050 && !hasC100 && !hasE110) return 'ecd';
    return 'efd-icms';
  }

  // ============================================================
  // 3b. EFD CONTRIBUIÇÕES PARSER (PIS/COFINS)
  // ============================================================

  private parseEfdContribuicoes(lines: string[], sped: SpedDocument): EfdContribData {
    const data: EfdContribData = {
      tipo: 'efd-contribuicoes',
      empresa: sped.empresa,
      cnpj: sped.cnpj,
      periodo: { ...sped.periodo },
      pisTotalCredito: 0, pisTotalDebito: 0, pisSaldoCredor: 0,
      cofinsTotalCredito: 0, cofinsTotalDebito: 0, cofinsSaldoCredor: 0,
      creditosPis: [], creditosCofins: [], demaisCreditos: [],
      textoFormatado: '',
    };

    for (const line of lines) {
      const fields = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (!fields[0]) continue;
      const reg = fields[0];

      switch (reg) {
        case 'M100': {
          // Crédito PIS: COD_CRED | IND_CRED_ORI | VL_BC_PIS | ALIQ_PIS | ... | VL_CRED
          const cst = fields[1] || '';
          const vlCredito = this.parseDecimal(fields[7] || fields[6]);
          if (vlCredito > 0) {
            data.creditosPis.push({ cstPis: cst, vlCredito, descricao: `CST ${cst}` });
          }
          break;
        }
        case 'M200': {
          // Apuração PIS: VL_TOT_CONT_NC_PER | VL_TOT_CRED_DESC | ... | VL_CONT_PER
          data.pisTotalDebito += this.parseDecimal(fields[1]);
          data.pisTotalCredito += this.parseDecimal(fields[5] || fields[4] || fields[3]);
          data.pisSaldoCredor += this.parseDecimal(fields[9] || fields[8]);
          break;
        }
        case 'M500': {
          // Crédito COFINS: similar to M100
          const cst = fields[1] || '';
          const vlCredito = this.parseDecimal(fields[7] || fields[6]);
          if (vlCredito > 0) {
            data.creditosCofins.push({ cstCofins: cst, vlCredito, descricao: `CST ${cst}` });
          }
          break;
        }
        case 'M600': {
          // Apuração COFINS: similar to M200
          data.cofinsTotalDebito += this.parseDecimal(fields[1]);
          data.cofinsTotalCredito += this.parseDecimal(fields[5] || fields[4] || fields[3]);
          data.cofinsSaldoCredor += this.parseDecimal(fields[9] || fields[8]);
          break;
        }
        case 'F100': {
          // Demais documentos geradores de crédito
          const vlOpr = this.parseDecimal(fields[7] || fields[6]);
          const vlPis = this.parseDecimal(fields[9] || fields[8]);
          const vlCofins = this.parseDecimal(fields[11] || fields[10]);
          if (vlPis > 0 || vlCofins > 0) {
            data.demaisCreditos.push({ natureza: fields[2] || 'Outros', vlOpr, vlPis, vlCofins });
          }
          break;
        }
      }
    }

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    data.textoFormatado = `
=== EFD CONTRIBUIÇÕES (PIS/COFINS) ===
Empresa: ${data.empresa} | CNPJ: ${sped.cnpj}
Período: ${data.periodo.inicio} a ${data.periodo.fim}

--- APURAÇÃO PIS ---
Débitos (contribuição): R$ ${fmt(data.pisTotalDebito)}
Créditos descontados: R$ ${fmt(data.pisTotalCredito)}
Saldo credor: R$ ${fmt(data.pisSaldoCredor)}

--- APURAÇÃO COFINS ---
Débitos (contribuição): R$ ${fmt(data.cofinsTotalDebito)}
Créditos descontados: R$ ${fmt(data.cofinsTotalCredito)}
Saldo credor: R$ ${fmt(data.cofinsSaldoCredor)}

--- CRÉDITOS PIS DETALHADOS (${data.creditosPis.length}) ---
${data.creditosPis.slice(0, 20).map(c => `CST ${c.cstPis}: R$ ${fmt(c.vlCredito)}`).join('\n')}

--- CRÉDITOS COFINS DETALHADOS (${data.creditosCofins.length}) ---
${data.creditosCofins.slice(0, 20).map(c => `CST ${c.cstCofins}: R$ ${fmt(c.vlCredito)}`).join('\n')}

--- DEMAIS CRÉDITOS F100 (${data.demaisCreditos.length}) ---
${data.demaisCreditos.slice(0, 20).map(c => `${c.natureza}: PIS R$ ${fmt(c.vlPis)} | COFINS R$ ${fmt(c.vlCofins)}`).join('\n')}
`.trim();

    return data;
  }

  // ============================================================
  // 3c. ECF PARSER (IRPJ/CSLL)
  // ============================================================

  private parseEcf(lines: string[], sped: SpedDocument): EcfData {
    const data: EcfData = {
      tipo: 'ecf',
      empresa: sped.empresa,
      cnpj: sped.cnpj,
      periodo: { ...sped.periodo },
      formaApuracao: '',
      irpjBaseCalculo: 0, irpjDevido: 0, irpjRetido: 0, irpjAPagar: 0,
      csllBaseCalculo: 0, csllDevido: 0, csllRetido: 0, csllAPagar: 0,
      lucroPrejuizoContabil: 0, adicoes: 0, exclusoes: 0, lucroReal: 0,
      textoFormatado: '',
    };

    for (const line of lines) {
      const fields = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (!fields[0]) continue;
      const reg = fields[0];

      switch (reg) {
        case '0010': {
          // Parâmetros: FORMA_APUR | COD_QUALIF_PJ
          data.formaApuracao = fields[4] || fields[3] || fields[2] || '';
          break;
        }
        case 'N620': {
          // Cálculo IRPJ: vários campos de base, adições, exclusões
          // N620 layout: IND_PER | ... multiple value fields
          const values = fields.slice(1).map(f => this.parseDecimal(f));
          if (values.length >= 10) {
            data.irpjBaseCalculo = Math.max(data.irpjBaseCalculo, values[9] || 0);
          }
          if (values.length >= 15) {
            data.irpjDevido = Math.max(data.irpjDevido, values[14] || values[13] || 0);
          }
          break;
        }
        case 'N630': {
          // Cálculo CSLL: similar a N620
          const values = fields.slice(1).map(f => this.parseDecimal(f));
          if (values.length >= 10) {
            data.csllBaseCalculo = Math.max(data.csllBaseCalculo, values[9] || 0);
          }
          if (values.length >= 15) {
            data.csllDevido = Math.max(data.csllDevido, values[14] || values[13] || 0);
          }
          break;
        }
        case 'N660': {
          // IRPJ retido e a pagar
          const values = fields.slice(1).map(f => this.parseDecimal(f));
          if (values.length >= 3) {
            data.irpjRetido = Math.max(data.irpjRetido, values[0] || 0);
            data.irpjAPagar = Math.max(data.irpjAPagar, values[2] || values[1] || 0);
          }
          break;
        }
        case 'M300': {
          // LALUR Parte A: IND_LAN | ... | VL_LAN
          const vlLan = this.parseDecimal(fields[fields.length - 1]);
          const tipo = (fields[1] || '').toUpperCase();
          if (tipo === 'A') data.adicoes += vlLan;
          else if (tipo === 'E') data.exclusoes += vlLan;
          break;
        }
        case 'L200': {
          // DRE — Demonstração do Resultado: IND_AJ | SLD_FIN
          const sldFin = this.parseDecimal(fields[fields.length - 1]);
          if (sldFin !== 0 && data.lucroPrejuizoContabil === 0) {
            data.lucroPrejuizoContabil = sldFin;
          }
          break;
        }
      }
    }

    data.lucroReal = data.lucroPrejuizoContabil + data.adicoes - data.exclusoes;

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    data.textoFormatado = `
=== ECF — ESCRITURAÇÃO CONTÁBIL FISCAL ===
Empresa: ${data.empresa} | CNPJ: ${sped.cnpj}
Período: ${data.periodo.inicio} a ${data.periodo.fim}
Forma de Apuração: ${data.formaApuracao || 'N/D'}

--- IRPJ ---
Base de cálculo: R$ ${fmt(data.irpjBaseCalculo)}
IRPJ devido: R$ ${fmt(data.irpjDevido)}
IRPJ retido: R$ ${fmt(data.irpjRetido)}
IRPJ a pagar: R$ ${fmt(data.irpjAPagar)}

--- CSLL ---
Base de cálculo: R$ ${fmt(data.csllBaseCalculo)}
CSLL devida: R$ ${fmt(data.csllDevido)}
CSLL retida: R$ ${fmt(data.csllRetido)}
CSLL a pagar: R$ ${fmt(data.csllAPagar)}

--- LALUR (Lucro Real) ---
Lucro/Prejuízo contábil: R$ ${fmt(data.lucroPrejuizoContabil)}
Adições: R$ ${fmt(data.adicoes)}
Exclusões: R$ ${fmt(data.exclusoes)}
Lucro Real: R$ ${fmt(data.lucroReal)}
`.trim();

    return data;
  }

  // ============================================================
  // 3d. ECD PARSER (Escrituração Contábil Digital)
  // ============================================================

  private parseEcd(lines: string[], sped: SpedDocument): EcdData {
    const data: EcdData = {
      tipo: 'ecd',
      empresa: sped.empresa,
      cnpj: sped.cnpj,
      periodo: { ...sped.periodo },
      planoContas: [],
      saldos: [],
      movimentosDetalhados: [],
      totalAtivo: 0,
      totalPassivo: 0,
      receitaBruta: 0,
      textoFormatado: '',
    };

    // Maps for cross-referencing
    const contasMap = new Map<string, ContaContabil>();
    let currentPeriodDtIni = '';
    let currentPeriodDtFin = '';
    let currentPeriodAno = 0;

    for (const line of lines) {
      const fields = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (!fields[0]) continue;
      const reg = fields[0];

      switch (reg) {
        case 'I050': {
          // I050: DT_ALT | COD_NAT | IND_CTA | NIVEL | COD_CTA | COD_CTA_SUP | CTA
          const codigo = fields[5] || fields[4] || '';
          const descricao = fields[7] || fields[6] || '';
          const natureza = fields[2] || '';
          const indCta = (fields[3] || 'A').toUpperCase();
          const nivel = parseInt(fields[4] || '0', 10) || 0;
          const contaSuperior = fields[6] || fields[5] || '';

          if (codigo) {
            const conta: ContaContabil = { codigo, descricao, natureza, indCta, nivel, contaSuperior };
            contasMap.set(codigo, conta);
            data.planoContas.push(conta);
          }
          break;
        }
        case 'I150': {
          // I150: DT_INI | DT_FIN — defines the period for subsequent I155 records
          currentPeriodDtIni = fields[1] || '';
          currentPeriodDtFin = fields[2] || '';
          // Extract year from DT_FIN (DDMMYYYY)
          if (currentPeriodDtFin.length === 8) {
            currentPeriodAno = parseInt(currentPeriodDtFin.substring(4, 8), 10);
          } else if (currentPeriodDtIni.length === 8) {
            currentPeriodAno = parseInt(currentPeriodDtIni.substring(4, 8), 10);
          }
          break;
        }
        case 'I155': {
          // I155: COD_CTA | COD_CCUS | VL_SLD_INI | IND_DC_INI | VL_DEB | VL_CRED | VL_SLD_FIN | IND_DC_FIN
          const codCta = fields[1] || '';
          const vlSldIni = this.parseDecimal(fields[3]);
          const vlDeb = this.parseDecimal(fields[5]);
          const vlCred = this.parseDecimal(fields[6]);
          const vlSldFin = this.parseDecimal(fields[7]);
          const indDcFin = fields[8] || '';
          const contaInfo = contasMap.get(codCta);
          const descricao = contaInfo?.descricao || codCta;
          const natureza = contaInfo?.natureza || '';

          // Only store analítica (detail) accounts with actual movement
          if ((vlDeb > 0 || vlCred > 0) && contaInfo?.indCta !== 'S') {
            data.movimentosDetalhados.push({
              codCta,
              descricao,
              natureza,
              ano: currentPeriodAno,
              dtIni: currentPeriodDtIni,
              dtFin: currentPeriodDtFin,
              vlDeb,
              vlCred,
              vlSldIni,
              vlSldFin,
              indDcFin,
            });
          }

          if (vlSldFin > 0 || vlDeb > 0 || vlCred > 0) {
            data.saldos.push({ conta: codCta, descricao, saldoInicial: vlSldIni, debitos: vlDeb, creditos: vlCred, saldoFinal: vlSldFin });
          }

          const descLower = descricao.toLowerCase();
          if (descLower.includes('ativo') && !descLower.includes('passivo') && vlSldFin > data.totalAtivo) {
            data.totalAtivo = vlSldFin;
          }
          if (descLower.includes('passivo') && vlSldFin > data.totalPassivo) {
            data.totalPassivo = vlSldFin;
          }
          if ((descLower.includes('receita bruta') || descLower.includes('receita operacional')) && vlSldFin > data.receitaBruta) {
            data.receitaBruta = vlSldFin;
          }
          break;
        }
      }
    }

    // Aggregate movimentos by account + year for summary
    const contaAnoMap = new Map<string, Map<number, { vlDeb: number; vlCred: number }>>();
    for (const mov of data.movimentosDetalhados) {
      if (!contaAnoMap.has(mov.codCta)) contaAnoMap.set(mov.codCta, new Map());
      const anoMap = contaAnoMap.get(mov.codCta)!;
      if (!anoMap.has(mov.ano)) anoMap.set(mov.ano, { vlDeb: 0, vlCred: 0 });
      const entry = anoMap.get(mov.ano)!;
      entry.vlDeb += mov.vlDeb;
      entry.vlCred += mov.vlCred;
    }

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const uniqueAccounts = new Set(data.movimentosDetalhados.map(m => m.codCta));
    const despesaContas = data.movimentosDetalhados.filter(m => m.natureza === '04' || m.natureza === '05');
    const uniqueDespesas = new Set(despesaContas.map(m => m.codCta));

    data.textoFormatado = `
=== ECD — ESCRITURAÇÃO CONTÁBIL DIGITAL ===
Empresa: ${data.empresa} | CNPJ: ${sped.cnpj}
Período: ${data.periodo.inicio} a ${data.periodo.fim}
Plano de contas: ${data.planoContas.length} contas
Contas com movimento: ${uniqueAccounts.size}
Contas de despesa/custo: ${uniqueDespesas.size}
Movimentos detalhados: ${data.movimentosDetalhados.length} registros

--- INDICADORES ---
Total Ativo: R$ ${fmt(data.totalAtivo)}
Total Passivo: R$ ${fmt(data.totalPassivo)}
Receita Bruta: R$ ${fmt(data.receitaBruta)}

--- CONTAS DE DESPESA/CUSTO (top 30 por valor) ---
${Array.from(uniqueDespesas).map(codCta => {
  const info = contasMap.get(codCta);
  const anoMap = contaAnoMap.get(codCta);
  const totalDeb = anoMap ? Array.from(anoMap.values()).reduce((s, v) => s + v.vlDeb, 0) : 0;
  return { codCta, desc: info?.descricao || codCta, totalDeb };
}).sort((a, b) => b.totalDeb - a.totalDeb).slice(0, 30).map(c => `${c.codCta} ${c.desc}: R$ ${fmt(c.totalDeb)}`).join('\n')}
`.trim();

    logger.info(`[ECD] ${data.planoContas.length} contas | ${uniqueAccounts.size} com movimento | ${uniqueDespesas.size} despesas/custos | ${data.movimentosDetalhados.length} registros I155`);

    return data;
  }

  // ============================================================
  // 4. FORMATADOR SPED → TEXTO PARA CLAUDE
  // ============================================================

  private formatSpedForClaude(
    sped: SpedDocument,
    c190Records: string[][],
    e111Records: string[][],
    e116Records: string[][],
    p0150Records: string[][]
  ): string {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let text = '';

    text += `=== SPED EFD FISCAL ===\n`;
    text += `Empresa: ${sped.empresa}\n`;
    text += `CNPJ: ${sped.cnpj} | IE: ${sped.ie} | UF: ${sped.uf}\n`;
    text += `Período: ${sped.periodo.inicio} a ${sped.periodo.fim}\n\n`;

    // Participantes (top 20)
    if (p0150Records.length > 0) {
      text += `--- PARTICIPANTES (${p0150Records.length}) ---\n`;
      for (const r of p0150Records.slice(0, 20)) {
        text += `${r[1] || ''} | ${r[2] || ''}\n`;
      }
      if (p0150Records.length > 20) text += `... e mais ${p0150Records.length - 20} participantes\n`;
      text += '\n';
    }

    // Consolidação C190 (por CFOP)
    if (c190Records.length > 0) {
      text += `--- CONSOLIDAÇÃO POR CST/CFOP (C190) ---\n`;
      for (const r of c190Records) {
        text += `CST: ${r[1] || ''} | CFOP: ${r[2] || ''} | Alíq: ${r[3] || ''}% | Valor: R$ ${fmt(this.parseDecimal(r[4]))} | BC: R$ ${fmt(this.parseDecimal(r[5]))} | ICMS: R$ ${fmt(this.parseDecimal(r[6]))}\n`;
      }
      text += '\n';
    }

    // Apuração E110
    text += `--- APURAÇÃO DO ICMS (E110) ---\n`;
    text += `Débitos (saídas): R$ ${fmt(sped.resumo.icmsDebitos)}\n`;
    text += `Créditos (entradas): R$ ${fmt(sped.resumo.icmsCreditos)}\n`;
    text += `Saldo credor anterior: R$ ${fmt(sped.resumo.saldoAnterior)}\n`;
    text += `ICMS a recolher: R$ ${fmt(sped.resumo.saldoDevedor)}\n`;
    text += `Saldo credor a transportar: R$ ${fmt(sped.resumo.saldoCredor)}\n`;

    // Ajustes E111
    if (e111Records.length > 0) {
      text += `\n--- AJUSTES DA APURAÇÃO (E111) ---\n`;
      for (const r of e111Records) {
        text += `Código: ${r[1] || ''} | Descrição: ${r[2] || ''} | Valor: R$ ${fmt(this.parseDecimal(r[3]))}\n`;
      }
    }

    // Obrigações E116
    if (e116Records.length > 0) {
      text += `\n--- OBRIGAÇÕES ICMS A RECOLHER (E116) ---\n`;
      for (const r of e116Records) {
        text += `Código: ${r[1] || ''} | Valor: R$ ${fmt(this.parseDecimal(r[2]))} | Vencimento: ${r[3] || ''}\n`;
      }
    }

    // Totais
    text += `\n--- TOTAIS DO PERÍODO ---\n`;
    text += `Total entradas: R$ ${fmt(sped.resumo.totalEntradas)}\n`;
    text += `Total saídas: R$ ${fmt(sped.resumo.totalSaidas)}\n`;
    text += `NFes processadas: ${sped.resumo.numNfes}\n`;

    return text;
  }

  // ============================================================
  // 5. CLASSIFICADOR DE DOCUMENTOS
  // ============================================================

  private classifyDocument(doc: ProcessedDocument, result: ZipProcessResult): void {
    const name = (doc.nome || '').toLowerCase();
    const content = (doc.conteudo || '').toLowerCase().substring(0, 500);

    if (doc.tipo === 'sped') {
      const spedDoc = doc as SpedDocument;
      result.speds.push(spedDoc);
      if (spedDoc.efdContrib) {
        result.efdContribs.push(spedDoc.efdContrib);
        if (!result.resumo.tiposEncontrados.includes('efd-contribuicoes')) result.resumo.tiposEncontrados.push('efd-contribuicoes');
      }
      if (spedDoc.ecf) {
        result.ecfs.push(spedDoc.ecf);
        if (!result.resumo.tiposEncontrados.includes('ecf')) result.resumo.tiposEncontrados.push('ecf');
      }
      if (spedDoc.ecd) {
        result.ecds.push(spedDoc.ecd);
        if (!result.resumo.tiposEncontrados.includes('ecd')) result.resumo.tiposEncontrados.push('ecd');
      }
    } else if (name.includes('demonstrativo') || (name.includes('icms') && doc.tipo === 'pdf')) {
      result.demonstrativos.push(doc);
    } else if (name.match(/^\d+\.pdf$/) || name.includes('nfe') || name.includes('nf-e') ||
      (content.includes('nota fiscal') && content.includes('danfe'))) {
      result.nfes.push(doc);
    } else if (name.includes('contrato') || name.includes('proposta') ||
      content.includes('contratante') || content.includes('contratada')) {
      result.contratos.push(doc);
    } else {
      result.outros.push(doc);
    }

    result.documentos.push(doc);
  }

  // ============================================================
  // 6. MONTADOR DE TEXTO COMBINADO PARA ANÁLISE
  // ============================================================

  /**
   * Monta texto combinado de todos os documentos processados
   * Prioriza SPEDs, depois demonstrativos, depois demais
   */
  buildCombinedText(result: ZipProcessResult): string {
    let text = '';

    // SPEDs (dados estruturados — prioridade máxima)
    if (result.speds.length > 0) {
      text += `${'='.repeat(60)}\nSPED — DADOS ESTRUTURADOS\n${'='.repeat(60)}\n\n`;
      const sorted = [...result.speds].sort((a, b) =>
        ((a as SpedDocument).periodo?.inicio || '').localeCompare((b as SpedDocument).periodo?.inicio || '')
      );
      for (const sped of sorted) {
        text += sped.conteudo + '\n\n';
      }
    }

    // EFD Contribuições (PIS/COFINS reais)
    if (result.efdContribs.length > 0) {
      text += `${'='.repeat(60)}\nEFD CONTRIBUIÇÕES — PIS/COFINS REAIS\n${'='.repeat(60)}\n\n`;
      for (const efd of result.efdContribs) {
        text += efd.textoFormatado + '\n\n';
      }
    }

    // ECF (IRPJ/CSLL)
    if (result.ecfs.length > 0) {
      text += `${'='.repeat(60)}\nECF — IRPJ/CSLL\n${'='.repeat(60)}\n\n`;
      for (const ecf of result.ecfs) {
        text += ecf.textoFormatado + '\n\n';
      }
    }

    // ECD (Contabilidade)
    if (result.ecds.length > 0) {
      text += `${'='.repeat(60)}\nECD — ESCRITURAÇÃO CONTÁBIL\n${'='.repeat(60)}\n\n`;
      for (const ecd of result.ecds) {
        text += ecd.textoFormatado + '\n\n';
      }
    }

    // Demonstrativos
    if (result.demonstrativos.length > 0) {
      text += `${'='.repeat(60)}\nDEMONSTRATIVOS\n${'='.repeat(60)}\n\n`;
      for (const demo of result.demonstrativos) {
        text += `--- ${demo.nome} ---\n`;
        text += demo.conteudo.substring(0, 5000) + '\n\n';
      }
    }

    // NFes (resumo)
    if (result.nfes.length > 0) {
      text += `${'='.repeat(60)}\nNOTAS FISCAIS (${result.nfes.length})\n${'='.repeat(60)}\n\n`;
      for (const nfe of result.nfes.slice(0, 10)) {
        text += `--- ${nfe.nome} ---\n`;
        text += nfe.conteudo.substring(0, 2000) + '\n\n';
      }
      if (result.nfes.length > 10) {
        text += `... e mais ${result.nfes.length - 10} NFes\n\n`;
      }
    }

    // Outros (PDFs, Excel, etc)
    if (result.outros.length > 0) {
      text += `${'='.repeat(60)}\nOUTROS DOCUMENTOS (${result.outros.length})\n${'='.repeat(60)}\n\n`;
      for (const o of result.outros) {
        text += `--- ${o.nome} ---\n`;
        text += (o.conteudo || '').substring(0, 3000) + '\n\n';
      }
    }

    return text;
  }

  // ============================================================
  // 7. UTILITÁRIOS
  // ============================================================

  private createEmptyResult(): ZipProcessResult {
    return {
      empresa: null,
      documentos: [],
      speds: [],
      efdContribs: [],
      ecfs: [],
      ecds: [],
      nfes: [],
      demonstrativos: [],
      contratos: [],
      outros: [],
      resumo: {
        totalArquivos: 0,
        processados: 0,
        ignorados: 0,
        erros: [],
        tiposEncontrados: [],
      },
    };
  }

  private getDedupKey(basename: string, ext: string): string {
    if (ext === '.txt') {
      const lower = basename.toLowerCase();
      let prefix = 'sped';
      if (lower.includes('contrib')) prefix = 'efd-contrib';
      else if (lower.includes('ecf')) prefix = 'ecf';
      else if (lower.includes('ecd')) prefix = 'ecd';
      else if (lower.includes('icms') || lower.includes('ipi')) prefix = 'efd-icms';

      const match = basename.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\d{4})/i) ||
        basename.match(/(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
      if (match) return `${prefix}-${match[0]}`;
    }
    return basename.toLowerCase();
  }

  private parseDecimal(value: string | undefined): number {
    if (!value || value === '') return 0;
    return parseFloat(String(value).replace(/\./g, '').replace(',', '.')) || 0;
  }

  private formatDate(dt: string): string {
    if (!dt || dt.length !== 8) return dt;
    return `${dt.substring(0, 2)}/${dt.substring(2, 4)}/${dt.substring(4, 8)}`;
  }

  private formatCnpj(cnpj: string): string {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return `${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12, 14)}`;
  }

  /**
   * Verifica se um arquivo é suportado (inclui ZIP)
   */
  isSupported(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return ['.pdf', '.zip', '.xlsx', '.xls', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'].includes(ext);
  }

  getSupportedExtensions(): string[] {
    return ['pdf', 'zip', 'xlsx', 'xls', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp'];
  }
}

export const zipProcessor = new ZipProcessorService();
export default zipProcessor;
