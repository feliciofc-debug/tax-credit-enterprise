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
  versao: string;
  periodo: { inicio: string; fim: string };
  empresa: string;
  cnpj: string;
  ie: string;
  uf: string;
  fantasia?: string;
  resumo: SpedResumo;
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

export interface ZipProcessResult {
  empresa: { nome: string; cnpj: string; ie: string; uf: string; fantasia: string } | null;
  documentos: ProcessedDocument[];
  speds: SpedDocument[];
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
          const indOper = fields[1]; // 0=entrada, 1=saida
          const numDoc = fields[7] || '';
          const vlDoc = this.parseDecimal(fields[11]);
          const vlBcIcms = this.parseDecimal(fields[20]);
          const vlIcms = this.parseDecimal(fields[21]);
          const vlPis = this.parseDecimal(fields[25]);
          const vlCofins = this.parseDecimal(fields[26]);

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

        case 'C190':
          c190Records.push(fields);
          break;

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

    // Montar texto formatado para o Claude
    sped.conteudo = this.formatSpedForClaude(sped, c190Records, e111Records, e116Records, p0150Records);

    logger.info(`SPED parsed: ${sped.empresa} | ${sped.periodo.inicio}-${sped.periodo.fim} | ${sped.resumo.numNfes} NFes | Saldo credor: R$ ${sped.resumo.saldoCredor.toLocaleString('pt-BR')}`);

    return sped;
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
      result.speds.push(doc as SpedDocument);
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
      text += `${'='.repeat(60)}\nSPED EFD FISCAL — DADOS ESTRUTURADOS\n${'='.repeat(60)}\n\n`;
      const sorted = [...result.speds].sort((a, b) =>
        ((a as SpedDocument).periodo?.inicio || '').localeCompare((b as SpedDocument).periodo?.inicio || '')
      );
      for (const sped of sorted) {
        text += sped.conteudo + '\n\n';
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
      const match = basename.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\d{4})/i) ||
        basename.match(/(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
      if (match) return `sped-${match[0]}`;
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
