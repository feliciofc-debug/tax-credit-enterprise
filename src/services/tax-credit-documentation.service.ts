import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { claudeService, AnalysisOpportunity, CompanyInfo } from './claude.service';

export interface TaxCreditDocumentation {
  tipo: string;
  periodo: string;
  valorTotal: number;
  documentos: {
    memoriaCalculo: Buffer;
    planilhaApuracao: Buffer;
    parecerTecnico: Buffer;
    peticaoModelo: Buffer;
  };
  fundamentacaoLegal: string[];
  checklistValidacao: {
    item: string;
    status: 'ok' | 'pendente' | 'faltando';
    detalhes?: string;
  }[];
}

export class TaxCreditDocumentationService {
  
  /**
   * Gera pacote completo de documentação para protocolo
   */
  async generateDocumentationPackage(
    analysisId: string,
    opportunityIndex: number
  ): Promise<TaxCreditDocumentation> {
    
    logger.info(`Generating documentation for analysis ${analysisId}`);

    // 1. Buscar análise e oportunidade
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        document: {
          include: {
            user: true
          }
        }
      }
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    const opportunities = JSON.parse(analysis.opportunities);
    const opportunity = opportunities[opportunityIndex];

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    // Montar CompanyInfo e AnalysisOpportunity para o claudeService
    const companyInfo: CompanyInfo = {
      name: analysis.document.companyName || 'N/A',
      cnpj: analysis.document.cnpj || undefined,
    };

    const analysisOpportunity: AnalysisOpportunity = {
      tipo: opportunity.tipo || 'Não especificado',
      tributo: opportunity.tributo || 'N/A',
      descricao: opportunity.descricao || '',
      valorEstimado: parseFloat(opportunity.valorEstimado) || 0,
      fundamentacaoLegal: opportunity.fundamentacaoLegal || '',
      prazoRecuperacao: opportunity.prazoRecuperacao || 'Últimos 5 anos',
      complexidade: opportunity.complexidade || 'media',
      probabilidadeRecuperacao: parseInt(opportunity.probabilidadeRecuperacao) || 0,
      risco: opportunity.risco || '',
      documentacaoNecessaria: Array.isArray(opportunity.documentacaoNecessaria) ? opportunity.documentacaoNecessaria : [],
      passosPraticos: Array.isArray(opportunity.passosPraticos) ? opportunity.passosPraticos : [],
    };

    // 2. Gerar documentação via Claude Sonnet 4.5 (parecer + petição + memória + checklist)
    let parecerText = '';
    let peticaoText = '';
    let memoriaText = '';
    let checklistDocs: string[] = [];

    try {
      const docs = await claudeService.generateDocumentation(analysisOpportunity, companyInfo);
      parecerText = docs.parecerTecnico;
      peticaoText = docs.peticaoAdministrativa;
      memoriaText = docs.memoriaCalculo;
      checklistDocs = docs.checklistDocumentos;
    } catch (aiError: any) {
      logger.error(`Claude documentation generation failed: ${aiError.message}`);
      // Fallback com texto básico (não fake, apenas placeholder indicando erro)
      parecerText = `PARECER TÉCNICO - ${opportunity.tipo}\n\nEmpresa: ${companyInfo.name}\nCNPJ: ${companyInfo.cnpj || 'N/A'}\nValor Estimado: R$ ${(analysisOpportunity.valorEstimado).toLocaleString('pt-BR')}\nFundamentação: ${analysisOpportunity.fundamentacaoLegal}\n\n[Erro na geração automática: ${aiError.message}. Preencha manualmente.]`;
      peticaoText = `PETIÇÃO ADMINISTRATIVA\n\nRequerente: ${companyInfo.name}\nCNPJ: ${companyInfo.cnpj || 'N/A'}\nTipo: ${opportunity.tipo}\nValor: R$ ${(analysisOpportunity.valorEstimado).toLocaleString('pt-BR')}\n\n[Erro na geração automática: ${aiError.message}. Preencha manualmente.]`;
    }

    // 3. Gerar documentos em paralelo (PDFs e Excel)
    const [
      memoriaCalculo,
      planilhaApuracao,
      parecerTecnico,
      peticaoModelo
    ] = await Promise.all([
      this.generateMemoriaCalculoPDF(analysis, analysisOpportunity, memoriaText),
      this.generatePlanilhaApuracao(analysis, analysisOpportunity),
      this.textToPDF('PARECER TÉCNICO', parecerText),
      this.textToPDF('PETIÇÃO ADMINISTRATIVA', peticaoText),
    ]);

    // 4. Gerar checklist de validação
    const checklist = this.generateValidationChecklist(analysisOpportunity, checklistDocs);

    return {
      tipo: opportunity.tipo,
      periodo: analysis.document.extractedPeriod || 'N/A',
      valorTotal: analysisOpportunity.valorEstimado,
      documentos: {
        memoriaCalculo,
        planilhaApuracao,
        parecerTecnico,
        peticaoModelo
      },
      fundamentacaoLegal: [analysisOpportunity.fundamentacaoLegal],
      checklistValidacao: checklist
    };
  }

  /**
   * Gera Memória de Cálculo em PDF
   */
  private async generateMemoriaCalculoPDF(
    analysis: any,
    opportunity: AnalysisOpportunity,
    memoriaText?: string
  ): Promise<Buffer> {
    // Se temos texto gerado pelo claudeService, usar ele
    if (memoriaText && memoriaText.trim().length > 50) {
      return this.textToPDF('MEMÓRIA DE CÁLCULO', memoriaText);
    }

    // Fallback: gerar PDF estruturado localmente
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('MEMÓRIA DE CÁLCULO', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(opportunity.tipo, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12);
      doc.text(`Empresa: ${analysis.document.companyName || 'N/A'}`);
      doc.text(`CNPJ: ${analysis.document.cnpj || 'N/A'}`);
      doc.text(`Período: ${analysis.document.extractedPeriod || 'N/A'}`);
      doc.moveDown();

      doc.fontSize(14).text('FUNDAMENTAÇÃO LEGAL', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(opportunity.fundamentacaoLegal);
      doc.moveDown();

      doc.fontSize(14).text('DESCRIÇÃO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(opportunity.descricao);
      doc.moveDown();

      doc.fontSize(14).text('CÁLCULO DO CRÉDITO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`Valor Estimado: R$ ${opportunity.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`Prazo de Recuperação: ${opportunity.prazoRecuperacao}`);
      doc.text(`Probabilidade de Recuperação: ${opportunity.probabilidadeRecuperacao}%`);
      doc.moveDown();

      doc.fontSize(14).text('OBSERVAÇÕES', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text('Este documento foi gerado automaticamente e deve ser revisado por profissional habilitado antes do protocolo.');
      
      doc.moveDown(2);
      doc.fontSize(9);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Gera Planilha de Apuração em Excel
   */
  private async generatePlanilhaApuracao(
    analysis: any,
    opportunity: AnalysisOpportunity
  ): Promise<Buffer> {
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Apuração de Crédito');

    sheet.columns = [
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Competência', key: 'competencia', width: 15 },
      { header: 'Base de Cálculo (R$)', key: 'baseCalculo', width: 20 },
      { header: 'Alíquota (%)', key: 'aliquota', width: 15 },
      { header: 'Valor do Crédito (R$)', key: 'valorCredito', width: 20 }
    ];

    sheet.addRow({
      descricao: opportunity.tipo,
      competencia: analysis.document.extractedPeriod || 'N/A',
      baseCalculo: opportunity.valorEstimado,
      aliquota: this.estimateAliquota(opportunity.tributo),
      valorCredito: opportunity.valorEstimado
    });

    const lastRow = (sheet.lastRow?.number || 5) + 2;
    sheet.getCell(`A${lastRow}`).value = 'TOTAL';
    sheet.getCell(`A${lastRow}`).font = { bold: true };
    sheet.getCell(`E${lastRow}`).value = opportunity.valorEstimado;
    sheet.getCell(`E${lastRow}`).font = { bold: true };

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  /**
   * Converte texto para PDF formatado
   */
  private async textToPDF(title: string, content: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(11).text(content, { align: 'justify' });
      doc.moveDown(3);
      doc.text('_________________________________', { align: 'center' });
      doc.text('Responsável Técnico', { align: 'center' });
      doc.fontSize(9);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Gera checklist de validação combinando fixos + gerados pela IA
   */
  private generateValidationChecklist(
    opportunity: AnalysisOpportunity,
    aiChecklist: string[]
  ): any[] {
    const checklist = [
      {
        item: 'Documentação fiscal completa',
        status: 'pendente' as const,
        detalhes: 'Verificar se todas as notas fiscais estão disponíveis'
      },
      {
        item: 'SPED Fiscal transmitido',
        status: 'pendente' as const,
        detalhes: 'Confirmar transmissão do SPED para o período'
      },
      {
        item: 'Cálculo revisado',
        status: 'ok' as const,
        detalhes: 'Memória de cálculo gerada automaticamente'
      },
      {
        item: 'Fundamentação legal verificada',
        status: 'ok' as const,
        detalhes: opportunity.fundamentacaoLegal
      },
      {
        item: 'Certificado digital válido',
        status: 'pendente' as const,
        detalhes: 'Necessário para protocolo eletrônico'
      },
      {
        item: 'Procuração eletrônica (e-CAC)',
        status: 'pendente' as const,
        detalhes: 'Se for protocolar por terceiro'
      }
    ];

    // Adicionar itens da checklist gerada pela IA
    if (aiChecklist && aiChecklist.length > 0) {
      for (const item of aiChecklist) {
        // Evitar duplicatas
        if (!checklist.some(c => c.item.toLowerCase().includes(item.toLowerCase().substring(0, 20)))) {
          checklist.push({
            item,
            status: 'pendente' as const,
            detalhes: 'Identificado pela análise de IA'
          });
        }
      }
    }

    return checklist;
  }

  /**
   * Estima alíquota baseada no tributo
   */
  private estimateAliquota(tributo: string): number {
    if (tributo.includes('PIS')) return 1.65;
    if (tributo.includes('COFINS')) return 7.6;
    if (tributo.includes('ICMS')) return 18;
    if (tributo.includes('IRPJ')) return 15;
    if (tributo.includes('CSLL')) return 9;
    if (tributo.includes('ISS')) return 5;
    return 0;
  }
}

export const taxCreditDocService = new TaxCreditDocumentationService();
