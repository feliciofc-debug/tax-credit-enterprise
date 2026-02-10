// src/services/documentProcessor.service.ts
// Processador inteligente de documentos: PDF, Excel, Imagem
// Detecta automaticamente se precisa OCR e extrai texto otimizado

import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import { ocrService } from './ocr-space.service';
import { logger } from '../utils/logger';

// ============================================================
// TIPOS
// ============================================================
export interface ProcessedDocument {
  text: string;
  metadata: DocumentMetadata;
  needsOCR: boolean;
  ocrUsed: boolean;
  pageCount: number;
  quality: 'high' | 'medium' | 'low';
}

export interface DocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedPeriod?: string;
  extractedYear?: number;
  extractedCompanyName?: string;
  extractedCNPJ?: string;
}

// Mínimo de caracteres por página para considerar texto válido
const MIN_CHARS_PER_PAGE = 50;
const MIN_TOTAL_CHARS = 200;

// ============================================================
// SERVIÇO PRINCIPAL
// ============================================================

class DocumentProcessorService {
  /**
   * Processa qualquer tipo de documento e retorna texto limpo
   * Decide automaticamente se usa PDF nativo, OCR ou Excel parser
   */
  async processDocument(
    buffer: Buffer,
    fileName: string,
    mimeType?: string
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    const fileType = this.detectFileType(fileName, mimeType);
    const fileSize = buffer.length;

    logger.info(`Processando documento: ${fileName}`, { fileType, fileSize });

    let result: ProcessedDocument;

    try {
      switch (fileType) {
        case 'pdf':
          result = await this.processPDF(buffer, fileName);
          break;
        case 'excel':
          result = await this.processExcel(buffer, fileName);
          break;
        case 'image':
          result = await this.processImage(buffer, fileName);
          break;
        case 'text':
          result = await this.processText(buffer, fileName);
          break;
        default:
          throw new Error(`Tipo de arquivo não suportado: ${fileType}. Use PDF, Excel, imagem ou texto.`);
      }

      // Extrair metadados do texto
      result.metadata = {
        ...result.metadata,
        ...this.extractMetadata(result.text),
      };

      // Avaliar qualidade do texto extraído
      result.quality = this.assessQuality(result.text, result.pageCount);

      const duration = Date.now() - startTime;
      logger.info(`Documento processado: ${fileName}`, {
        textLength: result.text.length,
        pageCount: result.pageCount,
        ocrUsed: result.ocrUsed,
        quality: result.quality,
        durationMs: duration,
      });

      return result;
    } catch (error: any) {
      logger.error(`Erro ao processar ${fileName}: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // PROCESSADORES POR TIPO DE ARQUIVO
  // ============================================================

  /**
   * Processa PDF — tenta extração nativa, se falhar usa OCR
   */
  private async processPDF(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
    let text = '';
    let pageCount = 0;
    let ocrUsed = false;
    let needsOCR = false;

    // ETAPA 1: Tentar extração nativa de texto
    try {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text || '';
      pageCount = pdfData.numpages || 1;

      // Verificar se o texto extraído é suficiente
      const avgCharsPerPage = text.trim().length / Math.max(pageCount, 1);
      needsOCR = avgCharsPerPage < MIN_CHARS_PER_PAGE || text.trim().length < MIN_TOTAL_CHARS;

      if (!needsOCR) {
        logger.info(`PDF nativo extraído com sucesso: ${text.length} chars, ${pageCount} páginas`);
      }
    } catch (pdfError: any) {
      logger.warn(`pdf-parse falhou para ${fileName}: ${pdfError.message}`);
      needsOCR = true;
    }

    // ETAPA 2: Se texto insuficiente, usar OCR.space
    if (needsOCR) {
      logger.info(`Texto insuficiente no PDF nativo. Usando OCR.space para ${fileName}`);
      try {
        const ocrText = await ocrService.processPDF(buffer, fileName);
        if (ocrText && ocrText.trim().length > text.trim().length) {
          text = ocrText;
          ocrUsed = true;
          logger.info(`OCR extraiu ${ocrText.length} chars (melhor que nativo: ${text.length} chars)`);
        }
      } catch (ocrError: any) {
        logger.error(`OCR falhou para ${fileName}: ${ocrError.message}`);
        // Se tanto PDF nativo quanto OCR falharam
        if (text.trim().length < MIN_TOTAL_CHARS) {
          throw new Error(
            `Não foi possível extrair texto do documento "${fileName}". ` +
            `O PDF pode estar corrompido, protegido por senha, ou conter apenas imagens de baixa qualidade. ` +
            `Tente enviar uma versão diferente do documento.`
          );
        }
      }
    }

    // Limpar texto extraído
    text = this.cleanExtractedText(text);

    return {
      text,
      metadata: {
        fileName,
        fileType: 'pdf',
        fileSize: buffer.length,
      },
      needsOCR,
      ocrUsed,
      pageCount,
      quality: 'medium', // Será reavaliado depois
    };
  }

  /**
   * Processa Excel — converte planilha para texto estruturado
   */
  private async processExcel(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const texts: string[] = [];
      let totalRows = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        texts.push(`\n=== PLANILHA: ${sheetName} ===\n`);

        // Converter para array de arrays para melhor formatação
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

        for (const row of data) {
          if (Array.isArray(row)) {
            const rowText = row
              .map((cell) => String(cell ?? '').trim())
              .filter((cell) => cell.length > 0)
              .join(' | ');
            if (rowText.length > 0) {
              texts.push(rowText);
              totalRows++;
            }
          }
        }
      }

      const text = texts.join('\n');

      if (text.trim().length < MIN_TOTAL_CHARS) {
        throw new Error(
          `Planilha "${fileName}" está vazia ou contém dados insuficientes para análise.`
        );
      }

      logger.info(`Excel processado: ${workbook.SheetNames.length} abas, ${totalRows} linhas`);

      return {
        text: this.cleanExtractedText(text),
        metadata: {
          fileName,
          fileType: 'excel',
          fileSize: buffer.length,
        },
        needsOCR: false,
        ocrUsed: false,
        pageCount: workbook.SheetNames.length,
        quality: 'high', // Excel geralmente tem boa qualidade
      };
    } catch (error: any) {
      if (error.message.includes('vazia') || error.message.includes('insuficientes')) {
        throw error;
      }
      throw new Error(`Erro ao processar planilha "${fileName}": ${error.message}`);
    }
  }

  /**
   * Processa imagem diretamente com OCR
   */
  private async processImage(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
    logger.info(`Processando imagem com OCR.space: ${fileName}`);

    const text = await ocrService.processImage(buffer, fileName);

    if (text.trim().length < MIN_TOTAL_CHARS) {
      throw new Error(
        `Não foi possível extrair texto suficiente da imagem "${fileName}". ` +
        `A imagem pode ser de baixa resolução ou não conter texto legível.`
      );
    }

    return {
      text: this.cleanExtractedText(text),
      metadata: {
        fileName,
        fileType: 'image',
        fileSize: buffer.length,
      },
      needsOCR: true,
      ocrUsed: true,
      pageCount: 1,
      quality: 'medium',
    };
  }

  /**
   * Processa arquivo de texto puro
   */
  private async processText(buffer: Buffer, fileName: string): Promise<ProcessedDocument> {
    const text = buffer.toString('utf-8');

    if (text.trim().length < MIN_TOTAL_CHARS) {
      throw new Error(`Arquivo "${fileName}" contém texto insuficiente para análise.`);
    }

    return {
      text: this.cleanExtractedText(text),
      metadata: {
        fileName,
        fileType: 'text',
        fileSize: buffer.length,
      },
      needsOCR: false,
      ocrUsed: false,
      pageCount: 1,
      quality: 'high',
    };
  }

  // ============================================================
  // MÉTODOS AUXILIARES
  // ============================================================

  /**
   * Detecta tipo de arquivo pela extensão e MIME type
   */
  private detectFileType(fileName: string, mimeType?: string): string {
    const ext = fileName.toLowerCase().split('.').pop();

    const mapping: Record<string, string> = {
      pdf: 'pdf',
      xlsx: 'excel',
      xls: 'excel',
      csv: 'excel',
      tsv: 'excel',
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      tiff: 'image',
      tif: 'image',
      bmp: 'image',
      webp: 'image',
      txt: 'text',
      text: 'text',
    };

    if (ext && mapping[ext]) return mapping[ext];

    // Fallback para MIME type
    if (mimeType) {
      if (mimeType.includes('pdf')) return 'pdf';
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
        return 'excel';
      if (mimeType.includes('image')) return 'image';
      if (mimeType.includes('text')) return 'text';
    }

    return 'unknown';
  }

  /**
   * Limpa texto extraído de qualquer fonte
   */
  private cleanExtractedText(text: string): string {
    return (
      text
        // Remover caracteres de controle (manter newlines e tabs)
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        // Normalizar quebras de linha
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remover múltiplas linhas vazias (máximo 2)
        .replace(/\n{4,}/g, '\n\n\n')
        // Remover espaços múltiplos
        .replace(/ {3,}/g, '  ')
        // Remover espaços no início/fim de cada linha
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Trim final
        .trim()
    );
  }

  /**
   * Extrai metadados do texto do documento (período, empresa, CNPJ)
   */
  private extractMetadata(text: string): Partial<DocumentMetadata> {
    const metadata: Partial<DocumentMetadata> = {};

    // Extrair ano/período
    const yearPatterns = [
      /(?:EXERC[ÍI]CIO|PER[ÍI]ODO|ANO|REFER[ÊE]NCIA)\s*(?:DE\s+)?(\d{4})/i,
      /(\d{2})\/(\d{4})/,
      /(\d{4})\s*[-\/]\s*(\d{4})/,
      /(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\s*(?:\/|DE)\s*(\d{4})/i,
    ];

    for (const pattern of yearPatterns) {
      const match = text.match(pattern);
      if (match) {
        const yearStr = match[match.length - 1]; // Último grupo geralmente é o ano
        const year = parseInt(yearStr);
        if (year >= 2015 && year <= 2030) {
          metadata.extractedYear = year;
          metadata.extractedPeriod = yearStr;
          break;
        }
      }
    }

    // Extrair CNPJ
    const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    if (cnpjMatch) {
      metadata.extractedCNPJ = cnpjMatch[0];
    }

    // Extrair nome da empresa (geralmente aparece no topo do documento)
    const first500 = text.substring(0, 500);
    const companyPatterns = [
      /(?:RAZ[ÃA]O\s*SOCIAL|EMPRESA|DENOMINA[ÇC][ÃA]O)\s*:?\s*(.+?)(?:\n|CNPJ)/i,
      /^([A-Z][A-Z\s&\.]+(?:LTDA|S\.?A\.?|EIRELI|ME|EPP|S\/S))/m,
    ];

    for (const pattern of companyPatterns) {
      const match = first500.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 3 && name.length < 200) {
          metadata.extractedCompanyName = name;
          break;
        }
      }
    }

    return metadata;
  }

  /**
   * Avalia a qualidade do texto extraído
   */
  private assessQuality(text: string, pageCount: number): 'high' | 'medium' | 'low' {
    if (!text || text.trim().length === 0) return 'low';

    const charCount = text.trim().length;
    const avgPerPage = charCount / Math.max(pageCount, 1);

    // Indicadores de boa qualidade
    const hasNumbers = /R\$\s*[\d.,]+/.test(text) || /\d{1,3}(?:\.\d{3})*(?:,\d{2})/.test(text);
    const hasFinancialTerms = /(?:RECEITA|DESPESA|ATIVO|PASSIVO|PATRIMÔNIO|LUCRO|PREJUÍZO|TRIBUT|IMPOSTO|PIS|COFINS|ICMS|ISS|IRPJ|CSLL)/i.test(text);
    const hasPeriod = /\d{4}/.test(text);
    const hasStructure = text.includes('|') || text.includes('\t') || /^\s*\d+\s/.test(text);

    let score = 0;
    if (avgPerPage > 200) score += 2;
    else if (avgPerPage > 100) score += 1;
    if (hasNumbers) score += 2;
    if (hasFinancialTerms) score += 2;
    if (hasPeriod) score += 1;
    if (hasStructure) score += 1;

    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Verifica se um arquivo é um tipo suportado
   */
  isSupported(fileName: string): boolean {
    const type = this.detectFileType(fileName);
    return type !== 'unknown';
  }

  /**
   * Lista extensões suportadas
   */
  getSupportedExtensions(): string[] {
    return ['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'txt'];
  }
}

// Exportar instância singleton
export const documentProcessor = new DocumentProcessorService();
export default documentProcessor;
