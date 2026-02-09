import { logger } from '../utils/logger';

export interface PeriodInfo {
  period: string | null;      // "2024-Q1", "2023", "2024-01"
  year: number | null;
  month: number | null;
  quarter: number | null;
}

export class PeriodExtractorService {
  
  async extractPeriod(documentText: string, fileName?: string): Promise<PeriodInfo> {
    logger.info('Extracting period from document');

    // Combinar texto do documento com nome do arquivo
    const fullText = `${fileName || ''} ${documentText}`.toLowerCase();

    // 1. Extrair ano (2020-2030)
    const yearMatch = fullText.match(/\b(20[2-3][0-9])\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // 2. Extrair trimestre
    let quarter: number | null = null;
    const quarterPatterns = [
      /\b([1-4])º?\s*trimestre\b/i,
      /\btrimestre\s*([1-4])\b/i,
      /\bq([1-4])\b/i,
      /\b([1-4])t\b/i,
    ];

    for (const pattern of quarterPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        quarter = parseInt(match[1]);
        break;
      }
    }

    // 3. Extrair mês
    let month: number | null = null;
    
    const monthNames: { [key: string]: number } = {
      'janeiro': 1, 'jan': 1,
      'fevereiro': 2, 'fev': 2,
      'março': 3, 'mar': 3,
      'abril': 4, 'abr': 4,
      'maio': 5, 'mai': 5,
      'junho': 6, 'jun': 6,
      'julho': 7, 'jul': 7,
      'agosto': 8, 'ago': 8,
      'setembro': 9, 'set': 9,
      'outubro': 10, 'out': 10,
      'novembro': 11, 'nov': 11,
      'dezembro': 12, 'dez': 12,
    };

    for (const [monthName, monthNum] of Object.entries(monthNames)) {
      if (fullText.includes(monthName)) {
        month = monthNum;
        break;
      }
    }

    // Se não encontrou mês por nome, tentar formato numérico
    if (!month && year) {
      const datePatterns = [
        new RegExp(`(0?[1-9]|1[0-2])[\\/\\-]${year}`, 'g'),
        new RegExp(`${year}[\\/\\-](0?[1-9]|1[0-2])`, 'g'),
      ];

      for (const pattern of datePatterns) {
        const match = fullText.match(pattern);
        if (match) {
          const monthStr = match[0].match(/0?[1-9]|1[0-2]/)?.[0];
          if (monthStr) {
            month = parseInt(monthStr);
            break;
          }
        }
      }
    }

    // 4. Construir string de período
    let period: string | null = null;
    
    if (year && quarter) {
      period = `${year}-Q${quarter}`;
    } else if (year && month) {
      period = `${year}-${String(month).padStart(2, '0')}`;
    } else if (year) {
      period = `${year}`;
    }

    const result: PeriodInfo = { period, year, month, quarter };
    
    logger.info('Period extracted:', result);
    return result;
  }

  // Método para validar período
  isValidPeriod(period: string): boolean {
    const patterns = [
      /^\d{4}$/,                    // Ano: "2024"
      /^\d{4}-(0[1-9]|1[0-2])$/,   // Mês: "2024-03"
      /^\d{4}-Q[1-4]$/,            // Trimestre: "2024-Q1"
    ];

    return patterns.some(pattern => pattern.test(period));
  }

  // Método para converter período em range de datas
  periodToDateRange(period: string): { start: Date, end: Date } | null {
    // Ano
    const yearMatch = period.match(/^(\d{4})$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59)
      };
    }

    // Mês
    const monthMatch = period.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (monthMatch) {
      const year = parseInt(monthMatch[1]);
      const month = parseInt(monthMatch[2]) - 1; // JS Date usa 0-11
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month, lastDay, 23, 59, 59)
      };
    }

    // Trimestre
    const quarterMatch = period.match(/^(\d{4})-Q([1-4])$/);
    if (quarterMatch) {
      const year = parseInt(quarterMatch[1]);
      const quarter = parseInt(quarterMatch[2]);
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;
      const lastDay = new Date(year, endMonth + 1, 0).getDate();
      return {
        start: new Date(year, startMonth, 1),
        end: new Date(year, endMonth, lastDay, 23, 59, 59)
      };
    }

    return null;
  }

  // Método para ordenar períodos cronologicamente
  comparePeriods(periodA: string, periodB: string): number {
    const rangeA = this.periodToDateRange(periodA);
    const rangeB = this.periodToDateRange(periodB);

    if (!rangeA || !rangeB) return 0;

    return rangeA.start.getTime() - rangeB.start.getTime();
  }
}

export const periodExtractor = new PeriodExtractorService();
