import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ComplianceAnalyzer } from './compliance.service';
import { analyzeSimples, parseNFeXml, extractCompetencia } from './simplesRecovery.service';
import zipProcessor from './zipProcessor.service';
import type { NFeItem } from './simplesRecovery.service';
import JSZip from 'jszip';

export interface ProcessResult {
  itemsProcessed: number;
  alertsGenerated: number;
  creditosFound: number;
  comissaoGerada: number;
  details: string[];
}

export class IntegrationProcessor {

  static async processFile(
    buffer: Buffer,
    fileName: string,
    integration: { id: string; cnpj: string; companyName: string; comissaoPerc: number; regime?: string | null }
  ): Promise<ProcessResult> {
    const start = Date.now();
    const result: ProcessResult = { itemsProcessed: 0, alertsGenerated: 0, creditosFound: 0, comissaoGerada: 0, details: [] };
    const lowerName = fileName.toLowerCase();

    try {
      if (lowerName.endsWith('.xml')) {
        await this.processNFeXml(buffer, fileName, integration, result);
      } else if (lowerName.endsWith('.txt')) {
        await this.processSped(buffer, fileName, integration, result);
      } else if (lowerName.endsWith('.zip')) {
        await this.processZip(buffer, fileName, integration, result);
      } else {
        result.details.push(`Tipo de arquivo não suportado: ${fileName}`);
      }

      await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          eventType: 'webhook_received',
          status: 'success',
          fileName,
          fileSize: buffer.length,
          payloadType: lowerName.endsWith('.xml') ? 'nfe_xml' : lowerName.endsWith('.txt') ? 'sped_txt' : 'zip',
          itemsProcessed: result.itemsProcessed,
          alertsGenerated: result.alertsGenerated,
          creditosFound: result.creditosFound,
          processingMs: Date.now() - start,
        },
      });

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          totalEvents: { increment: 1 },
          totalCreditos: { increment: result.creditosFound },
          totalComissao: { increment: result.comissaoGerada },
          lastEventAt: new Date(),
        },
      });

    } catch (err: any) {
      logger.error(`[IntProcessor] Erro processando ${fileName}:`, err.message);
      await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          eventType: 'webhook_received',
          status: 'error',
          fileName,
          fileSize: buffer.length,
          errorMessage: err.message,
          processingMs: Date.now() - start,
        },
      }).catch(() => {});
      result.details.push(`Erro: ${err.message}`);
    }

    return result;
  }

  private static async processNFeXml(
    buffer: Buffer,
    fileName: string,
    integration: { id: string; cnpj: string; companyName: string; comissaoPerc: number },
    result: ProcessResult
  ) {
    const content = buffer.toString('utf-8');
    const competencia = extractCompetencia(content);
    const items: NFeItem[] = parseNFeXml(content);
    items.forEach(it => { if (!it.competencia && competencia) it.competencia = competencia; });

    if (!items.length) {
      result.details.push(`${fileName}: nenhum item encontrado`);
      return;
    }

    const analysis = analyzeSimples({
      cnpj: integration.cnpj,
      companyName: integration.companyName,
      items,
    });

    result.itemsProcessed += items.length;
    result.creditosFound += analysis.totalRecuperavel;

    if (analysis.totalRecuperavel > 0) {
      const comissao = analysis.totalRecuperavel * integration.comissaoPerc;
      result.comissaoGerada += comissao;
      result.alertsGenerated += analysis.itensMonofasicos + analysis.itensIcmsSt;

      await prisma.revenueEvent.create({
        data: {
          integrationId: integration.id,
          cnpj: integration.cnpj,
          companyName: integration.companyName,
          eventType: 'credit_found',
          fonte: 'simples_recovery',
          tributo: 'PIS/COFINS',
          valorCredito: analysis.totalRecuperavel,
          comissaoPerc: integration.comissaoPerc,
          comissaoValor: comissao,
          descricao: `${items.length} itens, ${analysis.itensMonofasicos} monofásicos, ${analysis.itensIcmsSt} ST`,
          metadata: { porGrupo: analysis.porGrupo, fileName },
        },
      });

      result.details.push(`${fileName}: R$ ${analysis.totalRecuperavel.toFixed(2)} recuperável (${analysis.itensMonofasicos} monofásicos)`);
    } else {
      result.details.push(`${fileName}: ${items.length} itens, nenhum crédito identificado`);
    }
  }

  private static async processSped(
    buffer: Buffer,
    fileName: string,
    integration: { id: string; cnpj: string; companyName: string; comissaoPerc: number },
    result: ProcessResult
  ) {
    const zipResult = await zipProcessor.processUpload(buffer, fileName, 'text/plain');
    if (!zipResult.speds.length && !zipResult.efdContribs.length && !zipResult.ecfs.length) {
      result.details.push(`${fileName}: nenhum dado SPED encontrado`);
      return;
    }

    let totalCreditos = 0;
    let alertCount = 0;

    for (const sped of zipResult.speds) {
      const analysis = ComplianceAnalyzer.analyze(
        sped,
        zipResult.efdContribs[0],
        zipResult.ecfs[0],
        zipResult.ecds[0]
      );
      totalCreditos += analysis.totalCreditos;
      alertCount += analysis.alerts.length;
      result.itemsProcessed += (sped.resumo?.cfopBreakdown?.length || 0);
    }

    result.creditosFound += totalCreditos;
    result.alertsGenerated += alertCount;

    if (totalCreditos > 0) {
      const comissao = totalCreditos * integration.comissaoPerc;
      result.comissaoGerada += comissao;

      await prisma.revenueEvent.create({
        data: {
          integrationId: integration.id,
          cnpj: integration.cnpj,
          companyName: integration.companyName,
          eventType: 'alert_generated',
          fonte: 'compliance_rt',
          tributo: 'ICMS/PIS/COFINS',
          valorCredito: totalCreditos,
          comissaoPerc: integration.comissaoPerc,
          comissaoValor: comissao,
          descricao: `${alertCount} alertas de compliance gerados`,
          metadata: { fileName, speds: zipResult.speds.length },
        },
      });

      result.details.push(`${fileName}: R$ ${totalCreditos.toFixed(2)} em alertas (${alertCount} alertas)`);
    }
  }

  private static async processZip(
    buffer: Buffer,
    fileName: string,
    integration: { id: string; cnpj: string; companyName: string; comissaoPerc: number },
    result: ProcessResult
  ) {
    const zip = await JSZip.loadAsync(buffer);
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const lower = name.toLowerCase();
      if (lower.endsWith('.xml') || lower.endsWith('.txt')) {
        const buf = Buffer.from(await entry.async('arraybuffer'));
        const sub = await this.processFile(buf, name, integration);
        result.itemsProcessed += sub.itemsProcessed;
        result.alertsGenerated += sub.alertsGenerated;
        result.creditosFound += sub.creditosFound;
        result.comissaoGerada += sub.comissaoGerada;
        result.details.push(...sub.details);
      }
    }
  }
}
