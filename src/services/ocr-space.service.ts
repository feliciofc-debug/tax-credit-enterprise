// src/services/ocr-space.service.ts
// Integração com OCR.space API para extração de texto de PDFs escaneados e imagens
// Grátis até 25.000 páginas/mês — https://ocr.space/ocrapi

import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (limite do plano gratuito)

// ============================================================
// TIPOS
// ============================================================
interface OCRSpaceResponse {
  ParsedResults?: {
    ParsedText: string;
    ErrorMessage?: string;
    FileParseExitCode: number;
  }[];
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string[];
}

// ============================================================
// SERVIÇO
// ============================================================

class OCRSpaceService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.OCR_SPACE_API_KEY || null;
    if (!this.apiKey) {
      logger.warn('OCR_SPACE_API_KEY não configurada. OCR para PDFs escaneados estará indisponível.');
    }
  }

  /**
   * Verifica se o serviço de OCR está disponível
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Processa um PDF escaneado e extrai texto via OCR.space
   */
  async processPDF(buffer: Buffer, fileName: string): Promise<string> {
    return this.processFile(buffer, fileName, 'application/pdf');
  }

  /**
   * Processa uma imagem e extrai texto via OCR.space
   */
  async processImage(buffer: Buffer, fileName: string): Promise<string> {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      bmp: 'image/bmp',
      webp: 'image/webp',
    };
    const mimeType = mimeTypes[ext || ''] || 'image/png';
    return this.processFile(buffer, fileName, mimeType);
  }

  /**
   * Método interno que envia o arquivo para OCR.space
   */
  private async processFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'OCR não disponível: OCR_SPACE_API_KEY não configurada. ' +
        'Configure a variável de ambiente para processar PDFs escaneados e imagens.'
      );
    }

    // Verificar tamanho do arquivo
    if (buffer.length > MAX_FILE_SIZE) {
      logger.warn(`Arquivo ${fileName} excede limite de 5MB para OCR (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      // Tentar mesmo assim — OCR.space pode aceitar até 10MB em alguns casos
    }

    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName,
        contentType: mimeType,
      });
      formData.append('apikey', this.apiKey);
      formData.append('language', 'por'); // Português
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true'); // Melhora qualidade de imagens pequenas
      formData.append('OCREngine', '2'); // Engine 2 é melhor para documentos

      // Para PDFs com múltiplas páginas
      if (mimeType === 'application/pdf') {
        formData.append('isTable', 'true'); // Melhor para tabelas financeiras
        formData.append('filetype', 'PDF');
      }

      logger.info(`Enviando ${fileName} para OCR.space (${(buffer.length / 1024).toFixed(0)}KB)`);

      const response = await axios.post<OCRSpaceResponse>(OCR_SPACE_URL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 120000, // 2 minutos (PDFs grandes podem demorar)
        maxContentLength: 50 * 1024 * 1024,
      });

      const data = response.data;
      const duration = Date.now() - startTime;

      // Verificar erros
      if (data.IsErroredOnProcessing || data.OCRExitCode !== 1) {
        const errorMsg = data.ErrorMessage?.join('; ') || 'Erro desconhecido no OCR';
        logger.error(`OCR.space erro para ${fileName}: ${errorMsg}`, { duration });
        throw new Error(`OCR falhou: ${errorMsg}`);
      }

      // Extrair texto de todas as páginas
      const texts: string[] = [];
      if (data.ParsedResults) {
        for (const result of data.ParsedResults) {
          if (result.FileParseExitCode === 1 && result.ParsedText) {
            texts.push(result.ParsedText);
          } else if (result.ErrorMessage) {
            logger.warn(`OCR.space página com erro: ${result.ErrorMessage}`);
          }
        }
      }

      const fullText = texts.join('\n\n');

      logger.info(`OCR.space concluído para ${fileName}`, {
        chars: fullText.length,
        pages: data.ParsedResults?.length || 0,
        durationMs: duration,
      });

      return fullText;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('Chave da API OCR.space inválida ou limite mensal atingido.');
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Timeout no processamento OCR. O documento pode ser muito grande.');
        }
        logger.error(`OCR.space HTTP error: ${error.response?.status}`, {
          fileName,
          duration,
          status: error.response?.status,
        });
      }

      // Re-throw se já é um erro nosso
      if (error.message.startsWith('OCR')) {
        throw error;
      }

      throw new Error(`Erro no OCR para ${fileName}: ${error.message}`);
    }
  }
}

// Exportar instância singleton
export const ocrService = new OCRSpaceService();
export default ocrService;
