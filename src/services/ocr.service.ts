import Tesseract from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class OCRService {
  
  async processPDF(pdfBuffer: Buffer): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
    
    try {
      logger.info('Starting OCR processing');

      // 1. Salvar PDF temporariamente
      const pdfPath = path.join(tempDir, 'document.pdf');
      await fs.writeFile(pdfPath, pdfBuffer);

      // 2. Converter PDF para imagens (uma por página)
      const converter = fromPath(pdfPath, {
        density: 200,       // DPI
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Processar até 50 páginas (ajuste conforme necessário)
      const maxPages = 50;
      const texts: string[] = [];

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          logger.info(`Processing page ${pageNum}`);
          
          // Converter página para imagem
          const pageImage = await converter(pageNum, { responseType: 'image' });
          
          if (!pageImage || !pageImage.path) {
            // Fim do PDF
            break;
          }

          // OCR na imagem
          const { data } = await Tesseract.recognize(
            pageImage.path,
            'por', // Português
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
                }
              }
            }
          );

          if (data.text && data.text.length > 50) {
            texts.push(`\n=== PÁGINA ${pageNum} ===\n`);
            texts.push(data.text);
          }

          // Limpar imagem da página
          try {
            await fs.unlink(pageImage.path);
          } catch {}

        } catch (pageError: any) {
          // Página não existe ou erro no OCR
          if (pageError.message?.includes('Invalid page')) {
            break;
          }
          logger.warn(`Error on page ${pageNum}:`, pageError.message);
        }
      }

      const fullText = texts.join('\n');
      logger.info(`OCR completed, extracted ${fullText.length} characters from ${texts.length / 2} pages`);

      return fullText;

    } catch (error) {
      logger.error('OCR processing failed:', error);
      throw new Error('Falha no processamento OCR');
    } finally {
      // Limpar diretório temporário
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  async processImage(imageBuffer: Buffer, imageType: 'png' | 'jpg' | 'jpeg' = 'png'): Promise<string> {
    try {
      logger.info('Processing image with OCR');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-img-'));
      const imagePath = path.join(tempDir, `image.${imageType}`);
      
      await fs.writeFile(imagePath, imageBuffer);

      const { data } = await Tesseract.recognize(
        imagePath,
        'por',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      // Limpar
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}

      logger.info(`OCR completed, extracted ${data.text.length} characters`);
      return data.text;

    } catch (error) {
      logger.error('Image OCR processing failed:', error);
      throw new Error('Falha no processamento OCR da imagem');
    }
  }

  // Método para melhorar qualidade do texto extraído
  cleanOCRText(text: string): string {
    return text
      // Remover múltiplas quebras de linha
      .replace(/\n{3,}/g, '\n\n')
      // Remover espaços extras
      .replace(/ {2,}/g, ' ')
      // Corrigir pontuação comum do OCR
      .replace(/([a-z])\.([A-Z])/g, '$1. $2')
      // Remover caracteres estranhos
      .replace(/[^\w\s\d.,;:()\-+=%$R\n]/g, '')
      .trim();
  }
}

export const ocrService = new OCRService();
