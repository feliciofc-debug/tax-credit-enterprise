import { Router, Request, Response } from 'express';
import { taxCreditDocService } from '../services/tax-credit-documentation.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import archiver from 'archiver';
import { Readable } from 'stream';

const router = Router();

/**
 * POST /api/tax-credit/generate-docs
 * Gera pacote completo de documentação para protocolo
 */
router.post('/generate-docs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { analysisId, opportunityIndex } = req.body;

    if (!analysisId || opportunityIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'analysisId e opportunityIndex são obrigatórios'
      });
    }

    logger.info(`Generating documentation for analysis ${analysisId}, opportunity ${opportunityIndex}`);

    const documentation = await taxCreditDocService.generateDocumentationPackage(
      analysisId,
      opportunityIndex
    );

    // Criar ZIP com todos os documentos
    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers: Buffer[] = [];

    archive.on('data', (chunk) => buffers.push(chunk));
    
    await new Promise((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);

      // Adicionar documentos ao ZIP
      archive.append(documentation.documentos.memoriaCalculo, { 
        name: '01-memoria-de-calculo.pdf' 
      });
      archive.append(documentation.documentos.planilhaApuracao, { 
        name: '02-planilha-apuracao.xlsx' 
      });
      archive.append(documentation.documentos.parecerTecnico, { 
        name: '03-parecer-tecnico.pdf' 
      });
      archive.append(documentation.documentos.peticaoModelo, { 
        name: '04-peticao-modelo.pdf' 
      });

      // Adicionar checklist em JSON
      archive.append(JSON.stringify(documentation.checklistValidacao, null, 2), {
        name: '05-checklist-validacao.json'
      });

      archive.finalize();
    });

    const zipBuffer = Buffer.concat(buffers);

    // Retornar ZIP para download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documentacao-credito-${documentation.tipo}.zip"`);
    
    return res.send(zipBuffer);

  } catch (error: any) {
    logger.error('Error generating documentation:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao gerar documentação',
      message: error.message
    });
  }
});

/**
 * POST /api/tax-credit/validate-checklist
 * Valida checklist antes do protocolo
 */
router.post('/validate-checklist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { analysisId, opportunityIndex, checklistUpdates } = req.body;

    // Atualizar status dos itens do checklist
    // Verificar se todos os itens obrigatórios estão OK

    const allOk = checklistUpdates.every((item: any) => 
      item.optional || item.status === 'ok'
    );

    return res.json({
      success: true,
      data: {
        readyToFile: allOk,
        pendingItems: checklistUpdates.filter((item: any) => 
          !item.optional && item.status !== 'ok'
        )
      }
    });

  } catch (error: any) {
    logger.error('Error validating checklist:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao validar checklist'
    });
  }
});

/**
 * POST /api/tax-credit/prepare-perdcomp
 * Prepara arquivo para importação no PER/DCOMP
 */
router.post('/prepare-perdcomp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { analysisId, opportunityIndex } = req.body;

    // Gerar arquivo no formato aceito pelo PER/DCOMP
    // Isso varia dependendo do tipo de crédito

    const perdcompData = {
      codigoReceita: '5856', // Exemplo: COFINS
      periodoApuracao: '01/2024',
      valorCredito: 10000.50,
      naturezaCredito: 'Crédito de COFINS sobre insumos',
      fundamentacaoLegal: 'Lei 10.833/2003, art. 3º'
    };

    return res.json({
      success: true,
      data: {
        perdcompData,
        instructions: [
          '1. Acesse o e-CAC (https://cav.receita.fazenda.gov.br)',
          '2. Entre em "Declarações e Demonstrativos"',
          '3. Selecione "PER/DCOMP"',
          '4. Clique em "Preencher Declaração"',
          '5. Importe os dados fornecidos',
          '6. Anexe os documentos gerados',
          '7. Transmita via ReceitaNet'
        ],
        estimatedProcessingTime: '30-90 dias'
      }
    });

  } catch (error: any) {
    logger.error('Error preparing PER/DCOMP:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao preparar PER/DCOMP'
    });
  }
});

/**
 * GET /api/tax-credit/filing-guide/:creditType
 * Retorna guia passo-a-passo de protocolo
 */
router.get('/filing-guide/:creditType', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { creditType } = req.params;

    const guides: { [key: string]: any } = {
      'PIS_COFINS': {
        title: 'Guia de Protocolo - Créditos de PIS/COFINS',
        steps: [
          {
            step: 1,
            title: 'Preparação dos Documentos',
            description: 'Reúna todas as notas fiscais de entrada do período',
            documents: [
              'Notas fiscais de aquisição de insumos',
              'Planilha de apuração mensal',
              'Memória de cálculo',
              'Parecer técnico'
            ],
            estimatedTime: '2-5 dias'
          },
          {
            step: 2,
            title: 'Acesso ao e-CAC',
            description: 'Entre no Centro de Atendimento Virtual da Receita Federal',
            url: 'https://cav.receita.fazenda.gov.br',
            requirements: [
              'Certificado digital e-CPF ou e-CNPJ',
              'Código de acesso (se não tiver certificado)'
            ]
          },
          {
            step: 3,
            title: 'Preenchimento do PER/DCOMP',
            description: 'Preencha a declaração de compensação',
            instructions: [
              'Selecione "Declarações e Demonstrativos"',
              'Escolha "PER/DCOMP"',
              'Clique em "Preencher Declaração"',
              'Informe o período de apuração',
              'Inclua os créditos a compensar',
              'Anexe a documentação comprobatória'
            ]
          },
          {
            step: 4,
            title: 'Transmissão',
            description: 'Envie a declaração via ReceitaNet',
            warnings: [
              'Verifique todos os dados antes de transmitir',
              'Guarde o recibo de transmissão',
              'Não é possível alterar após transmissão'
            ]
          },
          {
            step: 5,
            title: 'Acompanhamento',
            description: 'Monitore o processamento no e-CAC',
            processingTime: '30-90 dias',
            possibleOutcomes: [
              'Deferimento automático (valores pequenos)',
              'Intimação para esclarecimentos',
              'Deferimento após análise',
              'Indeferimento (cabe recurso)'
            ]
          }
        ],
        legalBasis: 'IN RFB 1.717/2017',
        tips: [
          'Mantenha cópia de todos os documentos',
          'Responda intimações dentro do prazo',
          'Considere assessoria especializada para valores altos'
        ]
      },
      
      'ICMS': {
        title: 'Guia de Protocolo - Créditos de ICMS',
        steps: [
          {
            step: 1,
            title: 'Identificar o Estado',
            description: 'Cada estado tem procedimento próprio',
            note: 'O protocolo de ICMS é estadual, não federal'
          },
          {
            step: 2,
            title: 'Acessar Sistema Estadual',
            description: 'Exemplos de portais por estado:',
            portals: {
              'SP': 'https://www.fazenda.sp.gov.br',
              'RJ': 'https://www.fazenda.rj.gov.br',
              'MG': 'https://www.fazenda.mg.gov.br'
            }
          },
          {
            step: 3,
            title: 'Retificar SPED Fiscal',
            description: 'Corrigir apuração do ICMS',
            requirements: [
              'SPED Fiscal original',
              'Documentação comprobatória',
              'Memória de cálculo'
            ]
          },
          {
            step: 4,
            title: 'Protocolar Pedido Administrativo',
            description: 'Formalizar pedido na Secretaria da Fazenda Estadual',
            processingTime: '6-24 meses (varia por estado)'
          }
        ],
        legalBasis: 'Legislação estadual específica',
        warning: 'Cada estado tem regras próprias. Consulte a legislação local.'
      }
    };

    const guide = guides[creditType] || guides['PIS_COFINS'];

    return res.json({
      success: true,
      data: guide
    });

  } catch (error: any) {
    logger.error('Error fetching filing guide:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar guia de protocolo'
    });
  }
});

export default router;
