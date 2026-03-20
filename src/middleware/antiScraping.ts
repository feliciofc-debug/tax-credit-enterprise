import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { logger } from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface GeoInfo {
  country: string;
  region: string;
  city: string;
  isp: string;
  org: string;
  timezone: string;
  hosting: boolean;
}

interface RequestRecord {
  count: number;
  firstSeen: number;
  lastSeen: number;
  endpoints: Set<string>;
  suspicionScore: number;
  blocked: boolean;
  permanentlyBlocked: boolean;
  blockCount: number;
  userAgent: string;
  geo?: GeoInfo;
  hitHoneypot: boolean;
  blockReason: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const ipTracker = new Map<string, RequestRecord>();
const WINDOW_MS = 5 * 60 * 1000;
const BLOCK_DURATION_MS = 2 * 60 * 60 * 1000; // 2h block (was 30min)
const PERMANENT_BLOCK_AFTER = 2; // permanent after 2 blocks
const MAX_SCORE = 100;
const BLOCK_THRESHOLD = 50; // more aggressive (was 70)
const SENSITIVE_RATE_LIMIT = 30; // max 30 req/min per IP on sensitive routes
const sensitiveRateTracker = new Map<string, { count: number; windowStart: number }>();

// ────────────────────────────────────────────────────────────────────────────
// INSTANT-BLOCK: Bot User-Agents (score = 100 immediately)
// ────────────────────────────────────────────────────────────────────────────

const INSTANT_BLOCK_UA = [
  /go-http-client/i,
  /python-requests/i, /python-urllib/i, /python\/\d/i, /aiohttp/i, /httpx/i,
  /scrapy/i, /beautifulsoup/i,
  /wget/i, /curl\//i, /httpie/i, /libcurl/i,
  /node-fetch/i, /axios\/\d/i, /undici/i, /got\//i, /superagent/i,
  /java\/\d/i, /okhttp/i, /apache-httpclient/i, /jersey/i,
  /ruby/i, /perl/i, /php\//i, /guzzle/i,
  /postman/i, /insomnia/i, /paw\//i, /httpbin/i,
  /phantomjs/i, /selenium/i, /puppeteer/i, /playwright/i, /headless/i, /webdriver/i,
  /crawl/i, /spider/i, /slurp/i, /fetch\//i,
  /bot(?!.*google|.*bing|.*facebook|.*twitter|.*whatsapp|.*telegram|.*slack|.*discord)/i,
  /scan/i, /nikto/i, /nmap/i, /masscan/i, /sqlmap/i, /dirbuster/i, /gobuster/i,
  /burp/i, /zap\//i, /nuclei/i, /wfuzz/i, /ffuf/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i, /blexbot/i, /petalbot/i,
  /yandexbot/i, /baiduspider/i, /sogou/i,
];

// ────────────────────────────────────────────────────────────────────────────
// Suspicious patterns (add score but don't instant-block)
// ────────────────────────────────────────────────────────────────────────────

const SUSPICIOUS_UA_PATTERNS = [
  /mozilla\/[45]\.0.*compatible/i, // old IE pattern often faked by bots
  /http_request/i, /winhttp/i, /dispatch/i,
];

const SENSITIVE_PATTERNS = [
  /\/api\/viability/i, /\/api\/hpc/i, /\/api\/formalization/i,
  /\/api\/serpro/i, /\/api\/revenue/i, /\/api\/integrations/i,
  /\/api\/tax-credit/i, /\/api\/analysis/i, /\/api\/simples/i,
  /\/api\/security/i,
];

// Known cloud/hosting ASNs (detected via geo lookup)
const HOSTING_ORG_PATTERNS = [
  /google cloud/i, /amazon/i, /aws/i, /azure/i, /microsoft/i,
  /digitalocean/i, /linode/i, /vultr/i, /ovh/i, /hetzner/i,
  /oracle cloud/i, /alibaba/i, /tencent/i, /scaleway/i,
  /contabo/i, /hostinger/i, /kamatera/i, /upcloud/i,
];

// ────────────────────────────────────────────────────────────────────────────
// HONEYPOT: invisible endpoints that only bots/crawlers would find
// ────────────────────────────────────────────────────────────────────────────

const HONEYPOT_PATHS = [
  '/api/v2/internal/config',
  '/api/v2/admin/export',
  '/api/v1/debug/dump',
  '/api/internal/keys',
  '/.env',
  '/wp-admin',
  '/wp-login.php',
  '/admin.php',
  '/phpmyadmin',
  '/api/graphql',
  '/api/swagger.json',
  '/api/docs',
  '/.git/config',
  '/server-status',
  '/actuator',
  '/debug/vars',
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRecord(ua: string): RequestRecord {
  return {
    count: 0, firstSeen: Date.now(), lastSeen: Date.now(),
    endpoints: new Set(), suspicionScore: 0, blocked: false,
    permanentlyBlocked: false, blockCount: 0,
    userAgent: ua, hitHoneypot: false, blockReason: '',
  };
}

function blockRecord(record: RequestRecord, reason: string, ip: string): void {
  record.blocked = true;
  record.blockCount++;
  record.blockReason = reason;
  record.suspicionScore = MAX_SCORE;

  if (record.blockCount >= PERMANENT_BLOCK_AFTER) {
    record.permanentlyBlocked = true;
    logger.warn(`[SHIELD] IP BLOQUEADO PERMANENTEMENTE: ${ip} (motivo: ${reason}, bloqueios: ${record.blockCount})`);
  }

  if (!record.geo) {
    lookupGeo(ip).then(geo => { if (geo) record.geo = geo; }).catch(() => {});
  }

  const geoStr = record.geo
    ? ` [${record.geo.city}, ${record.geo.region}, ${record.geo.country} — ISP: ${record.geo.isp}]`
    : '';

  logger.warn(`[SHIELD] BLOQUEADO: ${ip}${geoStr} | Motivo: ${reason} | UA: ${record.userAgent?.substring(0, 80)}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Score calculation
// ────────────────────────────────────────────────────────────────────────────

function calculateSuspicion(record: RequestRecord, req: Request): number {
  let score = 0;
  const elapsed = Date.now() - record.firstSeen;
  const rps = elapsed > 0 ? (record.count / (elapsed / 1000)) : 0;

  // Rate-based
  if (rps > 10) score += 30;
  else if (rps > 5) score += 20;
  else if (rps > 2) score += 10;

  // Endpoint diversity (scanning multiple routes)
  if (record.endpoints.size > 15) score += 20;
  else if (record.endpoints.size > 10) score += 15;
  else if (record.endpoints.size > 5) score += 5;

  // User-Agent analysis
  const ua = req.headers['user-agent'] || '';
  if (!ua) score += 30;
  else if (ua.length < 10) score += 25;
  if (SUSPICIOUS_UA_PATTERNS.some(p => p.test(ua))) score += 15;

  // Missing browser fingerprint headers
  if (!req.headers['accept-language']) score += 8;
  if (!req.headers['accept']) score += 8;
  if (!req.headers['accept-encoding']) score += 5;
  if (!req.headers['sec-fetch-mode'] && !req.headers['sec-fetch-site']) score += 10;
  if (!req.headers['referer'] && !req.headers['origin'] && record.count > 3) score += 5;

  // Rapid sequential
  const timeSinceLast = Date.now() - record.lastSeen;
  if (timeSinceLast < 50 && record.count > 3) score += 20;
  else if (timeSinceLast < 200 && record.count > 5) score += 10;

  // Sensitive route hammering
  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(req.path));
  if (isSensitive && rps > 1) score += 15;

  // Hosting/Cloud IP
  if (record.geo?.hosting) score += 15;
  if (record.geo?.org && HOSTING_ORG_PATTERNS.some(p => p.test(record.geo!.org))) score += 15;

  // Honeypot hit
  if (record.hitHoneypot) score += 50;

  return Math.min(score, MAX_SCORE);
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ────────────────────────────────────────────────────────────────────────────

export function antiScrapingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip health checks
  if (req.path === '/api/health' || req.path === '/api/webhook') {
    next();
    return;
  }

  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const now = Date.now();

  let record = ipTracker.get(ip);
  if (!record) {
    record = createRecord(ua);
    ipTracker.set(ip, record);
  }

  // ── LAYER 1: Permanent block check ───────────────────────────────────
  if (record.permanentlyBlocked) {
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 2: Temporary block check ───────────────────────────────────
  if (record.blocked) {
    if (now - record.lastSeen > BLOCK_DURATION_MS) {
      record.blocked = false;
      record.count = 0;
      record.firstSeen = now;
      record.endpoints.clear();
      record.suspicionScore = 0;
    } else {
      record.lastSeen = now;
      res.status(429).json({ success: false, error: 'Acesso temporariamente suspenso.' });
      return;
    }
  }

  // ── LAYER 3: Honeypot trap ───────────────────────────────────────────
  if (HONEYPOT_PATHS.some(hp => req.path.toLowerCase() === hp || req.path.toLowerCase().startsWith(hp + '/'))) {
    record.hitHoneypot = true;
    blockRecord(record, `Honeypot: ${req.path}`, ip);
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // ── LAYER 4: Instant-block bot User-Agents ───────────────────────────
  if (INSTANT_BLOCK_UA.some(p => p.test(ua))) {
    blockRecord(record, `Bot UA detectado: ${ua.substring(0, 60)}`, ip);
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 5: Empty/Missing User-Agent ────────────────────────────────
  if (!ua || ua.length < 5) {
    blockRecord(record, 'User-Agent ausente ou inválido', ip);
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 6: Sensitive route rate limiting (30 req/min) ──────────────
  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(req.path));
  if (isSensitive) {
    const rateKey = ip;
    const rateRecord = sensitiveRateTracker.get(rateKey);
    if (!rateRecord || now - rateRecord.windowStart > 60000) {
      sensitiveRateTracker.set(rateKey, { count: 1, windowStart: now });
    } else {
      rateRecord.count++;
      if (rateRecord.count > SENSITIVE_RATE_LIMIT) {
        blockRecord(record, `Rate limit em rota sensível: ${rateRecord.count} req/min em ${req.path}`, ip);
        res.status(429).json({ success: false, error: 'Limite de requisições excedido.' });
        return;
      }
    }
  }

  // ── LAYER 7: Window reset for non-blocked ────────────────────────────
  if (now - record.firstSeen > WINDOW_MS) {
    record.count = 0;
    record.firstSeen = now;
    record.endpoints.clear();
    record.suspicionScore = 0;
  }

  // ── LAYER 8: Score-based detection ───────────────────────────────────
  record.count++;
  record.lastSeen = now;
  record.userAgent = ua;
  record.endpoints.add(req.path);

  // Async geo lookup for new IPs
  if (!record.geo && record.count >= 1) {
    lookupGeo(ip).then(geo => {
      if (geo) {
        record!.geo = geo;
        // Re-evaluate hosting IPs
        if (geo.hosting || HOSTING_ORG_PATTERNS.some(p => p.test(geo.org))) {
          record!.suspicionScore = Math.min(record!.suspicionScore + 15, MAX_SCORE);
          if (record!.suspicionScore >= BLOCK_THRESHOLD) {
            blockRecord(record!, `IP de hosting/cloud detectado: ${geo.org}`, ip);
          }
        }
      }
    }).catch(() => {});
  }

  const newScore = calculateSuspicion(record, req);
  record.suspicionScore = newScore;

  if (newScore >= BLOCK_THRESHOLD) {
    blockRecord(record, `Score alto: ${newScore} (reqs=${record.count}, endpoints=${record.endpoints.size})`, ip);
    res.status(429).json({ success: false, error: 'Atividade incomum detectada. Acesso suspenso.' });
    return;
  }

  if (newScore >= 30) {
    const geoStr = record.geo ? ` [${record.geo.city}, ${record.geo.region}, ${record.geo.country}]` : '';
    logger.info(`[SHIELD] Suspeito: ${ip}${geoStr} (score=${newScore}, reqs=${record.count})`);
  }

  next();
}

// ────────────────────────────────────────────────────────────────────────────
// Geo lookup (ip-api.com — free, 45 req/min)
// ────────────────────────────────────────────────────────────────────────────

const geoCache = new Map<string, GeoInfo>();

async function lookupGeo(ip: string): Promise<GeoInfo | undefined> {
  if (geoCache.has(ip)) return geoCache.get(ip);
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return undefined;

  try {
    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://ip-api.com/json/${ip}?fields=country,regionName,city,isp,org,timezone,hosting`, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const parsed = JSON.parse(data);
    if (parsed.country) {
      const geo: GeoInfo = {
        country: parsed.country || '',
        region: parsed.regionName || '',
        city: parsed.city || '',
        isp: parsed.isp || '',
        org: parsed.org || '',
        timezone: parsed.timezone || '',
        hosting: parsed.hosting === true,
      };
      geoCache.set(ip, geo);
      return geo;
    }
  } catch { /* best-effort */ }
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Export functions for dashboard / routes
// ────────────────────────────────────────────────────────────────────────────

function serializeRecord(record: RequestRecord) {
  return {
    count: record.count,
    firstSeen: new Date(record.firstSeen).toISOString(),
    lastSeen: new Date(record.lastSeen).toISOString(),
    endpointCount: record.endpoints.size,
    endpoints: Array.from(record.endpoints).slice(0, 20),
    suspicionScore: record.suspicionScore,
    blocked: record.blocked,
    permanentlyBlocked: record.permanentlyBlocked,
    blockCount: record.blockCount,
    blockReason: record.blockReason,
    userAgent: record.userAgent,
    hitHoneypot: record.hitHoneypot,
    geo: record.geo || null,
  };
}

export function getBlockedIps(): Array<{ ip: string; record: any }> {
  const result: Array<{ ip: string; record: any }> = [];
  ipTracker.forEach((record, ip) => {
    if (record.blocked || record.permanentlyBlocked || record.suspicionScore >= 30) {
      result.push({ ip, record: serializeRecord(record) });
    }
  });
  return result.sort((a, b) => b.record.suspicionScore - a.record.suspicionScore);
}

export function getAllTrackedIps(): Array<{ ip: string; record: any }> {
  const result: Array<{ ip: string; record: any }> = [];
  ipTracker.forEach((record, ip) => {
    result.push({ ip, record: serializeRecord(record) });
  });
  return result.sort((a, b) => b.record.count - a.record.count);
}

export function unblockIp(ip: string): boolean {
  const record = ipTracker.get(ip);
  if (record) {
    record.blocked = false;
    record.permanentlyBlocked = false;
    record.suspicionScore = 0;
    record.count = 0;
    record.endpoints.clear();
    record.hitHoneypot = false;
    record.blockReason = '';
    return true;
  }
  return false;
}

export function blockIp(ip: string): void {
  const existing = ipTracker.get(ip);
  if (existing) {
    existing.blocked = true;
    existing.permanentlyBlocked = true;
    existing.suspicionScore = MAX_SCORE;
    existing.blockReason = 'Bloqueio manual (admin)';
  } else {
    const record = createRecord('manual-block');
    record.blocked = true;
    record.permanentlyBlocked = true;
    record.suspicionScore = MAX_SCORE;
    record.blockReason = 'Bloqueio manual (admin)';
    ipTracker.set(ip, record);
  }
}

// Cleanup stale records every 10min (keep blocked ones for 24h)
setInterval(() => {
  const now = Date.now();
  ipTracker.forEach((record, ip) => {
    if (record.permanentlyBlocked) return; // never auto-delete
    if (!record.blocked && (now - record.lastSeen > WINDOW_MS * 6)) {
      ipTracker.delete(ip);
    }
    if (record.blocked && !record.permanentlyBlocked && (now - record.lastSeen > 24 * 60 * 60 * 1000)) {
      ipTracker.delete(ip);
    }
  });
  sensitiveRateTracker.forEach((r, key) => {
    if (now - r.windowStart > 120000) sensitiveRateTracker.delete(key);
  });
}, 10 * 60 * 1000);
