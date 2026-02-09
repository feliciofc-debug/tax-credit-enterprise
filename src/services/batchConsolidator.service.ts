import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { periodExtractor } from './periodExtractor.service';

export interface ConsolidatedReport {
  batchJobId: string;
  summary: {
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
    totalEstimatedValue: number;
    totalOpportunities: number;
    processingTimeMs: number;
  };
  byPeriod: {
    period: string;
    documents: number;
    estimatedValue: number;
    opportunities: number;
  }[];
  byType: {
    documentType: string;
    documents: number;
    estimatedValue: number;
  }[];
  topOpportunities: {
    tipo: string;
    count: number;
    totalValue: number;
    avgProbability: number;
  }[];
  allOpportunities: any[];
  recommendations: string[];
  alerts: string[];
  timeline: {
    period: string;
    value: number;
  }[];
}

export class BatchConsolidatorService {
  
  async consolidate(batchJobId: string): Promise<ConsolidatedReport> {
    logger.info(`Consolidating batch ${batchJobId}`);

    // Buscar batch com todos os documentos e análises
    const batch = await prisma.batchJob.findUnique({
      where: { id: batchJobId },
      include: {
        documents: {
          include: {
            analysis: true
          }
        }
      }
    });

    if (!batch) {
      throw new Error('Batch job not found');
    }

    const successfulDocs = batch.documents.filter(d => d.status === 'completed' && d.analysis);
    const failedDocs = batch.documents.filter(d => d.status === 'failed');

    // 1. SUMÁRIO GERAL
    let totalEstimatedValue = 0;
    let totalOpportunities = 0;
    let totalProcessingTime = 0;

    successfulDocs.forEach(doc => {
      if (doc.analysis) {
        totalEstimatedValue += doc.analysis.totalEstimatedValue;
        const opportunities = JSON.parse(doc.analysis.opportunities);
        totalOpportunities += opportunities.length;
        totalProcessingTime += doc.analysis.processingTimeMs || 0;
      }
    });

    // 2. AGRUPAMENTO POR PERÍODO
    const byPeriodMap = new Map<string, {
      period: string;
      documents: number;
      estimatedValue: number;
      opportunities: number;
    }>();

    successfulDocs.forEach(doc => {
      if (doc.extractedPeriod && doc.analysis) {
        const existing = byPeriodMap.get(doc.extractedPeriod) || {
          period: doc.extractedPeriod,
          documents: 0,
          estimatedValue: 0,
          opportunities: 0
        };

        existing.documents += 1;
        existing.estimatedValue += doc.analysis.totalEstimatedValue;
        const opportunities = JSON.parse(doc.analysis.opportunities);
        existing.opportunities += opportunities.length;

        byPeriodMap.set(doc.extractedPeriod, existing);
      }
    });

    const byPeriod = Array.from(byPeriodMap.values())
      .sort((a, b) => periodExtractor.comparePeriods(a.period, b.period));

    // 3. AGRUPAMENTO POR TIPO DE DOCUMENTO
    const byTypeMap = new Map<string, {
      documentType: string;
      documents: number;
      estimatedValue: number;
    }>();

    successfulDocs.forEach(doc => {
      if (doc.analysis) {
        const existing = byTypeMap.get(doc.documentType) || {
          documentType: doc.documentType,
          documents: 0,
          estimatedValue: 0
        };

        existing.documents += 1;
        existing.estimatedValue += doc.analysis.totalEstimatedValue;

        byTypeMap.set(doc.documentType, existing);
      }
    });

    const byType = Array.from(byTypeMap.values());

    // 4. TOP OPORTUNIDADES (agregadas por tipo)
    const opportunityMap = new Map<string, {
      tipo: string;
      count: number;
      totalValue: number;
      totalProbability: number;
    }>();

    const allOpportunities: any[] = [];

    successfulDocs.forEach(doc => {
      if (doc.analysis) {
        const opportunities = JSON.parse(doc.analysis.opportunities);
        
        opportunities.forEach((opp: any) => {
          allOpportunities.push({
            ...opp,
            documentId: doc.id,
            fileName: doc.fileName,
            period: doc.extractedPeriod
          });

          const existing = opportunityMap.get(opp.tipo) || {
            tipo: opp.tipo,
            count: 0,
            totalValue: 0,
            totalProbability: 0
          };

          existing.count += 1;
          existing.totalValue += opp.valorEstimado || 0;
          existing.totalProbability += opp.probabilidadeRecuperacao || 0;

          opportunityMap.set(opp.tipo, existing);
        });
      }
    });

    const topOpportunities = Array.from(opportunityMap.values())
      .map(opp => ({
        tipo: opp.tipo,
        count: opp.count,
        totalValue: opp.totalValue,
        avgProbability: opp.count > 0 ? opp.totalProbability / opp.count : 0
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // 5. CONSOLIDAR RECOMENDAÇÕES E ALERTAS
    const recommendationsSet = new Set<string>();
    const alertsSet = new Set<string>();

    successfulDocs.forEach(doc => {
      if (doc.analysis) {
        const recommendations = JSON.parse(doc.analysis.recommendations);
        const alerts = JSON.parse(doc.analysis.alerts);

        recommendations.forEach((rec: string) => recommendationsSet.add(rec));
        alerts.forEach((alert: string) => alertsSet.add(alert));
      }
    });

    // 6. TIMELINE (valor por período)
    const timeline = byPeriod.map(p => ({
      period: p.period,
      value: p.estimatedValue
    }));

    const consolidatedReport: ConsolidatedReport = {
      batchJobId,
      summary: {
        totalDocuments: batch.totalDocuments,
        successfulDocuments: successfulDocs.length,
        failedDocuments: failedDocs.length,
        totalEstimatedValue,
        totalOpportunities,
        processingTimeMs: totalProcessingTime
      },
      byPeriod,
      byType,
      topOpportunities,
      allOpportunities,
      recommendations: Array.from(recommendationsSet),
      alerts: Array.from(alertsSet),
      timeline
    };

    logger.info('Batch consolidated successfully', {
      batchJobId,
      totalValue: totalEstimatedValue,
      totalOpportunities
    });

    return consolidatedReport;
  }

  // Método para exportar relatório consolidado em Excel
  async exportToExcel(batchJobId: string): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const report = await this.consolidate(batchJobId);

    const workbook = new ExcelJS.Workbook();

    // Aba 1: Resumo
    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 20 }
    ];

    summarySheet.addRows([
      { metric: 'Total de Documentos', value: report.summary.totalDocuments },
      { metric: 'Documentos Processados', value: report.summary.successfulDocuments },
      { metric: 'Documentos com Falha', value: report.summary.failedDocuments },
      { metric: 'Valor Total Estimado', value: `R$ ${report.summary.totalEstimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { metric: 'Total de Oportunidades', value: report.summary.totalOpportunities },
    ]);

    // Aba 2: Por Período
    const periodSheet = workbook.addWorksheet('Por Período');
    periodSheet.columns = [
      { header: 'Período', key: 'period', width: 15 },
      { header: 'Documentos', key: 'documents', width: 15 },
      { header: 'Valor Estimado', key: 'value', width: 20 },
      { header: 'Oportunidades', key: 'opportunities', width: 15 }
    ];

    report.byPeriod.forEach(p => {
      periodSheet.addRow({
        period: p.period,
        documents: p.documents,
        value: p.estimatedValue,
        opportunities: p.opportunities
      });
    });

    // Aba 3: Top Oportunidades
    const oppSheet = workbook.addWorksheet('Top Oportunidades');
    oppSheet.columns = [
      { header: 'Tipo de Crédito', key: 'tipo', width: 40 },
      { header: 'Ocorrências', key: 'count', width: 15 },
      { header: 'Valor Total', key: 'value', width: 20 },
      { header: 'Prob. Média (%)', key: 'probability', width: 15 }
    ];

    report.topOpportunities.forEach(opp => {
      oppSheet.addRow({
        tipo: opp.tipo,
        count: opp.count,
        value: opp.totalValue,
        probability: Math.round(opp.avgProbability)
      });
    });

    return await workbook.xlsx.writeBuffer();
  }
}

export const batchConsolidator = new BatchConsolidatorService();
