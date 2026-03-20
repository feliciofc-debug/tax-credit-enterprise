import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RequestRecord {
  count: number;
  firstSeen: number;
  lastSeen: number;
  endpoints: Set<string>;
  suspicionScore: number;
  blocked: boolean;
  userAgent: string;
}

const ipTracker = new Map<string, RequestRecord>();
const WINDOW_MS = 5 * 60 * 1000; // 5 min window
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 min block
const MAX_SCORE = 100;
const BLOCK_THRESHOLD = 70;

const SUSPICIOUS_UA_PATTERNS = [
  /python-requests/i, /scrapy/i, /wget/i, /curl/i, /httpie/i,
  /postman/i, /insomnia/i, /axios/i, /node-fetch/i, /go-http/i,
  /java\//i, /ruby/i, /perl/i, /phantomjs/i, /selenium/i,
  /headless/i, /puppeteer/i, /playwright/i, /crawl/i, /spider/i,
  /bot(?!.*google|.*bing|.*facebook)/i,
];

const SENSITIVE_PATTERNS = [
  /\/api\/viability/i, /\/api\/hpc/i, /\/api\/formalization/i,
  /\/api\/serpro/i, /\/api\/revenue/i, /\/api\/integrations/i,
];

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function calculateSuspicion(record: RequestRecord, req: Request): number {
  let score = record.suspicionScore;
  const elapsed = Date.now() - record.firstSeen;
  const rps = elapsed > 0 ? (record.count / (elapsed / 1000)) : 0;

  if (rps > 5) score += 15;
  else if (rps > 2) score += 5;

  if (record.endpoints.size > 10) score += 10;
  if (record.endpoints.size > 20) score += 15;

  const ua = req.headers['user-agent'] || '';
  if (!ua || ua.length < 10) score += 20;
  if (SUSPICIOUS_UA_PATTERNS.some(p => p.test(ua))) score += 25;

  if (!req.headers['accept-language']) score += 5;
  if (!req.headers['accept']) score += 5;

  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(req.path));
  if (isSensitive && rps > 1) score += 10;

  const timeSinceLast = Date.now() - record.lastSeen;
  if (timeSinceLast < 100 && record.count > 5) score += 15;

  return Math.min(score, MAX_SCORE);
}

export function antiScrapingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health' || req.path === '/api/webhook') {
    next();
    return;
  }

  const ip = getClientIp(req);
  const now = Date.now();

  let record = ipTracker.get(ip);

  if (!record) {
    record = {
      count: 0,
      firstSeen: now,
      lastSeen: now,
      endpoints: new Set(),
      suspicionScore: 0,
      blocked: false,
      userAgent: req.headers['user-agent'] || '',
    };
    ipTracker.set(ip, record);
  }

  if (now - record.firstSeen > WINDOW_MS) {
    if (!record.blocked) {
      record.count = 0;
      record.firstSeen = now;
      record.endpoints.clear();
      record.suspicionScore = 0;
    } else if (now - record.lastSeen > BLOCK_DURATION_MS) {
      record.blocked = false;
      record.count = 0;
      record.firstSeen = now;
      record.endpoints.clear();
      record.suspicionScore = 0;
    }
  }

  if (record.blocked) {
    logger.warn(`[ANTI-SCRAPING] IP bloqueado tentou acessar: ${ip} -> ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Acesso temporariamente suspenso. Entre em contato com o suporte.',
    });
    return;
  }

  record.count++;
  record.lastSeen = now;
  record.endpoints.add(req.path);

  const newScore = calculateSuspicion(record, req);
  record.suspicionScore = newScore;

  if (newScore >= BLOCK_THRESHOLD) {
    record.blocked = true;
    logger.warn(`[ANTI-SCRAPING] IP BLOQUEADO por comportamento suspeito: ${ip} (score=${newScore}, requests=${record.count}, endpoints=${record.endpoints.size}, ua=${record.userAgent})`);
    res.status(429).json({
      success: false,
      error: 'Atividade incomum detectada. Acesso temporariamente suspenso.',
    });
    return;
  }

  if (newScore >= 40) {
    logger.info(`[ANTI-SCRAPING] IP suspeito: ${ip} (score=${newScore}, requests=${record.count})`);
  }

  next();
}

export function getBlockedIps(): Array<{ ip: string; record: RequestRecord }> {
  const result: Array<{ ip: string; record: any }> = [];
  ipTracker.forEach((record, ip) => {
    if (record.blocked || record.suspicionScore >= 30) {
      result.push({
        ip,
        record: {
          count: record.count,
          firstSeen: new Date(record.firstSeen).toISOString(),
          lastSeen: new Date(record.lastSeen).toISOString(),
          endpointCount: record.endpoints.size,
          suspicionScore: record.suspicionScore,
          blocked: record.blocked,
          userAgent: record.userAgent,
        },
      });
    }
  });
  return result.sort((a, b) => b.record.suspicionScore - a.record.suspicionScore);
}

export function unblockIp(ip: string): boolean {
  const record = ipTracker.get(ip);
  if (record) {
    record.blocked = false;
    record.suspicionScore = 0;
    record.count = 0;
    record.endpoints.clear();
    return true;
  }
  return false;
}

export function blockIp(ip: string): void {
  const record = ipTracker.get(ip) || {
    count: 0, firstSeen: Date.now(), lastSeen: Date.now(),
    endpoints: new Set<string>(), suspicionScore: MAX_SCORE,
    blocked: true, userAgent: 'manual-block',
  };
  record.blocked = true;
  record.suspicionScore = MAX_SCORE;
  ipTracker.set(ip, record);
}

setInterval(() => {
  const now = Date.now();
  const expiry = WINDOW_MS * 6; // 30min
  ipTracker.forEach((record, ip) => {
    if (!record.blocked && (now - record.lastSeen > expiry)) {
      ipTracker.delete(ip);
    }
  });
}, 10 * 60 * 1000);
