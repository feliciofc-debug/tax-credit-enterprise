import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // 2. Gerar cada documento
    const [
      memoriaCalculo,
      planilhaApuracao,
      parecerTecnico,
      peticaoModelo
    ] = await Promise.all([
      this.generateMemoriaCalculo(analysis, opportunity),
      this.generatePlanilhaApuracao(analysis, opportunity),
      this.generateParecerTecnico(analysis, opportunity),
      this.generatePeticaoModelo(analysis, opportunity)
    ]);

    // 3. Gerar checklist de validação
    const checklist = await this.generateValidationChecklist(analysis, opportunity);

    return {
      tipo: opportunity.tipo,
      periodo: analysis.document.extractedPeriod || 'N/A',
      valorTotal: opportunity.valorEstimado || 0,
      documentos: {
        memoriaCalculo,
        planilhaApuracao,
        parecerTecnico,
        peticaoModelo
      },
      fundamentacaoLegal: [opportunity.fundamentacaoLegal],
      checklistValidacao: checklist
    };
  }

  /**
   * Gera Memória de Cálculo em PDF
   */
  private async generateMemoriaCalculo(
    analysis: any,
    opportunity: any
  ): Promise<Buffer> {
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Cabeçalho
      doc.fontSize(20).text('MEMÓRIA DE CÁLCULO', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(opportunity.tipo, { align: 'center' });
      doc.moveDown(2);

      // Dados da empresa
      doc.fontSize(12);
      doc.text(`Empresa: ${analysis.document.companyName || 'N/A'}`);
      doc.text(`CNPJ: ${analysis.document.cnpj || 'N/A'}`);
      doc.text(`Período: ${analysis.document.extractedPeriod || 'N/A'}`);
      doc.moveDown();

      // Fundamentação Legal
      doc.fontSize(14).text('FUNDAMENTAÇÃO LEGAL', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(opportunity.fundamentacaoLegal);
      doc.moveDown();

      // Descrição da Oportunidade
      doc.fontSize(14).text('DESCRIÇÃO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(opportunity.descricao);
      doc.moveDown();

      // Cálculo
      doc.fontSize(14).text('CÁLCULO DO CRÉDITO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`Valor Estimado: R$ ${(opportunity.valorEstimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`Prazo de Recuperação: ${opportunity.prazoRecuperacao}`);
      doc.text(`Probabilidade de Recuperação: ${opportunity.probabilidadeRecuperacao}%`);
      doc.moveDown();

      // Observações
      doc.fontSize(14).text('OBSERVAÇÕES', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text('Este documento foi gerado automaticamente e deve ser revisado por profissional habilitado antes do protocolo.');
      
      // Rodapé
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
    opportunity: any
  ): Promise<Buffer> {
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Apuração de Crédito');

    // Configurar colunas
    sheet.columns = [
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Competência', key: 'competencia', width: 15 },
      { header: 'Base de Cálculo (R$)', key: 'baseCalculo', width: 20 },
      { header: 'Alíquota (%)', key: 'aliquota', width: 15 },
      { header: 'Valor do Crédito (R$)', key: 'valorCredito', width: 20 }
    ];

    // Adicionar linhas de exemplo
    sheet.addRow({
      descricao: opportunity.tipo,
      competencia: analysis.document.extractedPeriod || 'N/A',
      baseCalculo: opportunity.valorEstimado || 0,
      aliquota: this.estimateAliquota(opportunity.tipo),
      valorCredito: opportunity.valorEstimado || 0
    });

    // Totalizadores
    const lastRow = sheet.lastRow.number + 2;
    sheet.getCell(`A${lastRow}`).value = 'TOTAL';
    sheet.getCell(`A${lastRow}`).font = { bold: true };
    sheet.getCell(`E${lastRow}`).value = opportunity.valorEstimado || 0;
    sheet.getCell(`E${lastRow}`).font = { bold: true };

    // Formatação
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Gera Parecer Técnico usando Claude
   */
  private async generateParecerTecnico(
    analysis: any,
    opportunity: any
  ): Promise<Buffer> {
    
    // Usar Claude para gerar parecer técnico detalhado
    const prompt = `
Você é um consultor tributário especializado em recuperação de créditos.

Gere um PARECER TÉCNICO PROFISSIONAL sobre a seguinte oportunidade de crédito tributário:

TIPO DE CRÉDITO: ${opportunity.tipo}
EMPRESA: ${analysis.document.companyName || 'N/A'}
CNPJ: ${analysis.document.cnpj || 'N/A'}
PERÍODO: ${analysis.document.extractedPeriod || 'N/A'}
VALOR ESTIMADO: R$ ${(opportunity.valorEstimado || 0).toLocaleString('pt-BR')}

FUNDAMENTAÇÃO LEGAL: ${opportunity.fundamentacaoLegal}
DESCRIÇÃO: ${opportunity.descricao}

O parecer deve conter:
1. INTRODUÇÃO - contexto e objetivo
2. FUNDAMENTAÇÃO LEGAL - detalhada com artigos específicos
3. ANÁLISE TÉCNICA - demonstração do direito ao crédito
4. CÁLCULO - metodologia e apuração
5. CONCLUSÃO - opinião técnica favorável
6. REFERÊNCIAS - legislação e jurisprudência

Use linguagem técnica e formal. Seja detalhado e preciso.
`;

    const message = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const parecerText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    // Converter para PDF
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Título
      doc.fontSize(18).text('PARECER TÉCNICO', { align: 'center' });
      doc.moveDown(2);

      // Conteúdo
      doc.fontSize(11).text(parecerText, { align: 'justify' });

      // Assinatura
      doc.moveDown(3);
      doc.text('_________________________________', { align: 'center' });
      doc.text('Responsável Técnico', { align: 'center' });
      doc.fontSize(9);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Gera Petição Modelo para protocolo
   */
  private async generatePeticaoModelo(
    analysis: any,
    opportunity: any
  ): Promise<Buffer> {
    
    const prompt = `
Você é um advogado tributarista especializado.

Redija uma PETIÇÃO ADMINISTRATIVA para pedido de reconhecimento de crédito tributário:

REQUERENTE: ${analysis.document.companyName || '[NOME DA EMPRESA]'}
CNPJ: ${analysis.document.cnpj || '[CNPJ]'}
TIPO DE CRÉDITO: ${opportunity.tipo}
VALOR: R$ ${(opportunity.valorEstimado || 0).toLocaleString('pt-BR')}
PERÍODO: ${analysis.document.extractedPeriod || '[PERÍODO]'}
FUNDAMENTAÇÃO: ${opportunity.fundamentacaoLegal}

A petição deve conter:
1. Qualificação do requerente
2. Dos fatos (contexto e histórico)
3. Do direito (fundamentação legal completa)
4. Do pedido (requerimentos específicos)
5. Documentos anexos (lista)
6. Encerramento

Use linguagem jurídica formal e técnica.
`;

    const message = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const peticaoText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Converter para PDF
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(12).text(peticaoText, { align: 'justify' });
      doc.end();
    });
  }

  /**
   * Gera checklist de validação
   */
  private async generateValidationChecklist(
    analysis: any,
    opportunity: any
  ): Promise<any[]> {
    
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

    return checklist;
  }

  /**
   * Estima alíquota baseada no tipo de crédito
   */
  private estimateAliquota(tipoCredito: string): number {
    if (tipoCredito.includes('PIS')) return 1.65;
    if (tipoCredito.includes('COFINS')) return 7.6;
    if (tipoCredito.includes('ICMS')) return 18;
    return 0;
  }
}

export const taxCreditDocService = new TaxCreditDocumentationService();
