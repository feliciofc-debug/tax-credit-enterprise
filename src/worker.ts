import { Job } from 'bull';
import { documentQueue, batchConsolidationQueue, DocumentJobData, BatchConsolidationJobData } from './queues';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';
import { documentProcessor } from './services/documentProcessor.service';
import { claudeService } from './services/claude.service';
import { ocrService } from './services/ocr.service';
import { periodExtractor } from './services/periodExtractor.service';
import { batchConsolidator } from './services/batchConsolidator.service';
import fs from 'fs/promises';

// Processar documento individual
documentQueue.process(5, async (job: Job<DocumentJobData>) => {
  const { documentId, userId, batchJobId, filePath, fileName, mimeType, documentType, companyInfo } = job.data;
  
  logger.info(`Processing document ${documentId}`, { fileName, documentType });

  try {
    // Atualizar status para processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' }
    });

    // Incrementar contador de documentos em processamento
    if (batchJobId) {
      await prisma.batchJob.update({
        where: { id: batchJobId },
        data: {
          status: 'processing',
          startedAt: new Date()
        }
      });
    }

    // 1. Ler arquivo
    const fileBuffer = await fs.readFile(filePath);

    // 2. Extrair texto
    let extractedText: string;
    let needsOCR = false;

    try {
      extractedText = await documentProcessor.processBuffer(fileBuffer, mimeType);
      
      // Validar se tem conteúdo suficiente
      const validation = documentProcessor.validateFinancialDocument(extractedText);
      if (!validation.isValid || extractedText.length < 200) {
        needsOCR = true;
      }
    } catch (error) {
      logger.warn(`Failed to extract text from ${fileName}, trying OCR`, { error });
      needsOCR = true;
    }

    // 3. OCR se necessário
    if (needsOCR && mimeType === 'application/pdf') {
      logger.info(`Applying OCR to ${fileName}`);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'ocr_needed' }
      });

      extractedText = await ocrService.processPDF(fileBuffer);
    }

    // 4. Extrair período automaticamente
    const periodInfo = await periodExtractor.extractPeriod(extractedText, fileName);
    
    // 5. Atualizar documento com texto extraído
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedText,
        extractedPeriod: periodInfo.period,
        extractedYear: periodInfo.year,
        extractedMonth: periodInfo.month,
        extractedQuarter: periodInfo.quarter,
      }
    });

    // 6. Análise com Claude
    const startTime = Date.now();
    const analysis = await claudeService.analyzeDocument({
      documentType,
      documentText: extractedText,
      companyInfo: companyInfo || {
        name: '',
        cnpj: '',
        regime: 'lucro_real'
      },
      period: periodInfo.period
    });
    const processingTime = Date.now() - startTime;

    // 7. Salvar análise
    await prisma.analysis.create({
      data: {
        documentId,
        opportunities: JSON.stringify(analysis.oportunidades),
        executiveSummary: analysis.resumoExecutivo,
        totalEstimatedValue: analysis.valorTotalEstimado,
        recommendations: JSON.stringify(analysis.recomendacoes),
        alerts: JSON.stringify(analysis.alertas),
        modelUsed: 'claude-opus-4-20250514',
        processingTimeMs: processingTime,
      }
    });

    // 8. Atualizar documento como concluído
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'completed',
        processedAt: new Date()
      }
    });

    // 9. Atualizar batch job
    if (batchJobId) {
      const batch = await prisma.batchJob.findUnique({
        where: { id: batchJobId },
        include: { documents: true }
      });

      if (batch) {
        const processedCount = batch.documents.filter(d => d.status === 'completed').length;
        const failedCount = batch.documents.filter(d => d.status === 'failed').length;

        await prisma.batchJob.update({
          where: { id: batchJobId },
          data: {
            processedDocs: processedCount,
            failedDocs: failedCount,
          }
        });

        // Se todos os documentos foram processados, adicionar job de consolidação
        if (processedCount + failedCount === batch.totalDocuments) {
          await batchConsolidationQueue.add({
            batchJobId,
            userId
          });
        }
      }
    }

    // 10. Limpar arquivo temporário
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn(`Failed to delete temp file ${filePath}`);
    }

    logger.info(`Document ${documentId} processed successfully`);
    return { success: true, documentId, analysis };

  } catch (error: any) {
    logger.error(`Error processing document ${documentId}:`, error);

    // Atualizar documento como falho
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        processingError: error.message,
        processedAt: new Date()
      }
    });

    // Atualizar batch job
    if (batchJobId) {
      const batch = await prisma.batchJob.findUnique({
        where: { id: batchJobId },
        include: { documents: true }
      });

      if (batch) {
        const failedCount = batch.documents.filter(d => d.status === 'failed').length;
        await prisma.batchJob.update({
          where: { id: batchJobId },
          data: { failedDocs: failedCount }
        });
      }
    }

    // Limpar arquivo temporário
    try {
      await fs.unlink(filePath);
    } catch {}

    throw error;
  }
});

// Processar consolidação de batch
batchConsolidationQueue.process(async (job: Job<BatchConsolidationJobData>) => {
  const { batchJobId, userId } = job.data;

  logger.info(`Consolidating batch ${batchJobId}`);

  try {
    const consolidatedReport = await batchConsolidator.consolidate(batchJobId);

    await prisma.batchJob.update({
      where: { id: batchJobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        consolidatedReport: JSON.stringify(consolidatedReport),
        totalEstimatedValue: consolidatedReport.totalEstimatedValue,
        totalOpportunities: consolidatedReport.totalOpportunities,
      }
    });

    logger.info(`Batch ${batchJobId} consolidated successfully`);
    return { success: true, batchJobId };

  } catch (error: any) {
    logger.error(`Error consolidating batch ${batchJobId}:`, error);

    await prisma.batchJob.update({
      where: { id: batchJobId },
      data: { status: 'failed' }
    });

    throw error;
  }
});

logger.info('Worker started and processing jobs');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers...');
  await documentQueue.close();
  await batchConsolidationQueue.close();
  process.exit(0);
});
