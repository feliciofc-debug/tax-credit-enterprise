import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { logger } from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface GeoInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  org: string;
  timezone: string;
  hosting: boolean;
  proxy: boolean;
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
  geoChecked: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const ipTracker = new Map<string, RequestRecord>();
const WINDOW_MS = 5 * 60 * 1000;
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24h block
const PERMANENT_BLOCK_AFTER = 2;
const MAX_SCORE = 100;
const BLOCK_THRESHOLD = 50;
const SENSITIVE_RATE_LIMIT = 30;
const sensitiveRateTracker = new Map<string, { count: number; windowStart: number }>();

// Allowed countries (clients are Brazilian — allow BR and common VPN exits for legit users)
const ALLOWED_COUNTRIES = new Set(['BR', 'PT', 'US']);

// BLOCKED IP RANGES (entire subnets from known attackers)
const BLOCKED_IP_RANGES = [
  // Hetzner ranges (attacker infrastructure)
  { prefix: '178.156.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '5.161.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '5.75.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '49.13.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '65.108.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '65.109.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '95.216.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '95.217.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '135.181.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '142.132.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '116.202.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '116.203.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '128.140.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '157.90.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '159.69.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '167.235.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '168.119.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '188.34.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '195.201.', reason: 'Hetzner Cloud (faixa bloqueada)' },
  { prefix: '213.239.', reason: 'Hetzner (faixa bloqueada)' },
];

// ────────────────────────────────────────────────────────────────────────────
// INSTANT-BLOCK: Bot User-Agents
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

const SUSPICIOUS_UA_PATTERNS = [
  /mozilla\/[45]\.0.*compatible/i,
  /http_request/i, /winhttp/i, /dispatch/i,
];

const SENSITIVE_PATTERNS = [
  /\/api\/viability/i, /\/api\/hpc/i, /\/api\/formalization/i,
  /\/api\/serpro/i, /\/api\/revenue/i, /\/api\/integrations/i,
  /\/api\/tax-credit/i, /\/api\/analysis/i, /\/api\/simples/i,
  /\/api\/security/i, /\/api\/auth/i,
];

// Cloud/hosting orgs detected via geo lookup
const HOSTING_ORG_PATTERNS = [
  /google cloud/i, /google llc/i, /amazon/i, /aws/i, /azure/i, /microsoft/i,
  /digitalocean/i, /linode/i, /vultr/i, /ovh/i, /hetzner/i,
  /oracle cloud/i, /alibaba/i, /tencent/i, /scaleway/i,
  /contabo/i, /hostinger/i, /kamatera/i, /upcloud/i,
  /cloudflare/i, /fastly/i, /heroku/i, /render/i,
  /choopa/i, /buyvm/i, /leaseweb/i, /cogent/i,
  /m247/i, /quadranet/i, /psychz/i, /servermania/i,
  /hostwinds/i, /ionos/i, /aruba/i, /dreamhost/i,
];

// ────────────────────────────────────────────────────────────────────────────
// HONEYPOT: invisible endpoints only bots/crawlers find
// ────────────────────────────────────────────────────────────────────────────

const HONEYPOT_PATHS = [
  '/api/v2/internal/config', '/api/v2/admin/export', '/api/v1/debug/dump',
  '/api/internal/keys', '/.env', '/.env.local', '/.env.production',
  '/wp-admin', '/wp-login.php', '/admin.php', '/phpmyadmin',
  '/api/graphql', '/api/swagger.json', '/api/docs', '/api/openapi.json',
  '/.git/config', '/.git/HEAD', '/server-status', '/actuator', '/debug/vars',
  '/robots.txt', '/sitemap.xml', '/xmlrpc.php', '/config.json',
  '/api/v1/users', '/api/v1/export', '/api/v1/database', '/backup',
  '/console', '/admin/login', '/administrator', '/manager',
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
    userAgent: ua, hitHoneypot: false, blockReason: '', geoChecked: false,
  };
}

function blockRecord(record: RequestRecord, reason: string, ip: string): void {
  record.blocked = true;
  record.blockCount++;
  record.blockReason = reason;
  record.suspicionScore = MAX_SCORE;

  if (record.blockCount >= PERMANENT_BLOCK_AFTER) {
    record.permanentlyBlocked = true;
  }

  if (!record.geo) {
    lookupGeo(ip).then(geo => { if (geo) record.geo = geo; }).catch(() => {});
  }

  const geoStr = record.geo
    ? ` [${record.geo.city}, ${record.geo.region}, ${record.geo.country} — ${record.geo.isp}]`
    : '';
  const permStr = record.permanentlyBlocked ? ' **PERMANENTE**' : '';

  logger.warn(`[SHIELD] BLOQUEADO${permStr}: ${ip}${geoStr} | Motivo: ${reason} | UA: ${record.userAgent?.substring(0, 80)}`);
}

function isBlockedRange(ip: string): string | null {
  for (const range of BLOCKED_IP_RANGES) {
    if (ip.startsWith(range.prefix)) return range.reason;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Score calculation
// ────────────────────────────────────────────────────────────────────────────

function calculateSuspicion(record: RequestRecord, req: Request): number {
  let score = 0;
  const elapsed = Date.now() - record.firstSeen;
  const rps = elapsed > 0 ? (record.count / (elapsed / 1000)) : 0;

  if (rps > 10) score += 30;
  else if (rps > 5) score += 20;
  else if (rps > 2) score += 10;

  if (record.endpoints.size > 15) score += 20;
  else if (record.endpoints.size > 10) score += 15;
  else if (record.endpoints.size > 5) score += 5;

  const ua = req.headers['user-agent'] || '';
  if (!ua) score += 30;
  else if (ua.length < 10) score += 25;
  if (SUSPICIOUS_UA_PATTERNS.some(p => p.test(ua))) score += 15;

  if (!req.headers['accept-language']) score += 8;
  if (!req.headers['accept']) score += 8;
  if (!req.headers['accept-encoding']) score += 5;
  if (!req.headers['sec-fetch-mode'] && !req.headers['sec-fetch-site']) score += 10;
  if (!req.headers['referer'] && !req.headers['origin'] && record.count > 3) score += 5;

  const timeSinceLast = Date.now() - record.lastSeen;
  if (timeSinceLast < 50 && record.count > 3) score += 20;
  else if (timeSinceLast < 200 && record.count > 5) score += 10;

  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(req.path));
  if (isSensitive && rps > 1) score += 15;

  if (record.geo?.hosting) score += 20;
  if (record.geo?.proxy) score += 25;
  if (record.geo?.org && HOSTING_ORG_PATTERNS.some(p => p.test(record.geo!.org))) score += 20;

  // Non-Brazilian IPs from hosting get extra penalty
  if (record.geo && record.geo.countryCode !== 'BR' && (record.geo.hosting || HOSTING_ORG_PATTERNS.some(p => p.test(record.geo!.org)))) {
    score += 30;
  }

  if (record.hitHoneypot) score += 50;

  return Math.min(score, MAX_SCORE);
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ────────────────────────────────────────────────────────────────────────────

export function antiScrapingMiddleware(req: Request, res: Response, next: NextFunction): void {
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

  // ── LAYER 0: Blocked IP ranges (entire subnets) ─────────────────────
  const rangeBlock = isBlockedRange(ip);
  if (rangeBlock) {
    if (!record.blocked) blockRecord(record, rangeBlock, ip);
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 1: Permanent block ─────────────────────────────────────────
  if (record.permanentlyBlocked) {
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 2: Temporary block ─────────────────────────────────────────
  if (record.blocked) {
    if (now - record.lastSeen > BLOCK_DURATION_MS && !record.permanentlyBlocked) {
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
  const pathLower = req.path.toLowerCase();
  if (HONEYPOT_PATHS.some(hp => pathLower === hp || pathLower.startsWith(hp + '/'))) {
    record.hitHoneypot = true;
    blockRecord(record, `Honeypot: ${req.path}`, ip);
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // ── LAYER 4: Instant-block bot User-Agents ───────────────────────────
  if (INSTANT_BLOCK_UA.some(p => p.test(ua))) {
    blockRecord(record, `Bot UA: ${ua.substring(0, 60)}`, ip);
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 5: Empty/Missing User-Agent ────────────────────────────────
  if (!ua || ua.length < 5) {
    blockRecord(record, 'User-Agent ausente ou inválido', ip);
    res.status(403).json({ success: false, error: 'Acesso negado.' });
    return;
  }

  // ── LAYER 6: Sensitive route rate limiting ───────────────────────────
  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(req.path));
  if (isSensitive) {
    const rateRecord = sensitiveRateTracker.get(ip);
    if (!rateRecord || now - rateRecord.windowStart > 60000) {
      sensitiveRateTracker.set(ip, { count: 1, windowStart: now });
    } else {
      rateRecord.count++;
      if (rateRecord.count > SENSITIVE_RATE_LIMIT) {
        blockRecord(record, `Rate limit: ${rateRecord.count} req/min em ${req.path}`, ip);
        res.status(429).json({ success: false, error: 'Limite de requisições excedido.' });
        return;
      }
    }
  }

  // ── LAYER 7: Window reset ────────────────────────────────────────────
  if (now - record.firstSeen > WINDOW_MS) {
    record.count = 0;
    record.firstSeen = now;
    record.endpoints.clear();
    record.suspicionScore = 0;
  }

  // ── LAYER 8: Score-based + Geo detection ─────────────────────────────
  record.count++;
  record.lastSeen = now;
  record.userAgent = ua;
  record.endpoints.add(req.path);

  // Async geo lookup — runs once per IP, then blocks hosting/cloud IPs
  if (!record.geoChecked) {
    record.geoChecked = true;
    lookupGeo(ip).then(geo => {
      if (!geo || !record) return;
      record.geo = geo;

      // INSTANT BLOCK: hosting/cloud IP from non-allowed country
      const isHosting = geo.hosting || geo.proxy || HOSTING_ORG_PATTERNS.some(p => p.test(geo.org)) || HOSTING_ORG_PATTERNS.some(p => p.test(geo.isp));

      if (isHosting) {
        blockRecord(record, `IP de hosting/cloud: ${geo.org || geo.isp} [${geo.city}, ${geo.country}]`, ip);
        logger.warn(`[SHIELD] HOSTING BLOQUEADO: ${ip} — ${geo.org} / ${geo.isp} [${geo.city}, ${geo.region}, ${geo.country}]`);
        return;
      }

      // INSTANT BLOCK: proxy/VPN
      if (geo.proxy) {
        blockRecord(record, `Proxy/VPN detectado: ${geo.isp} [${geo.city}, ${geo.country}]`, ip);
        return;
      }

      // Non-Brazilian non-hosting: high suspicion but not instant block
      if (!ALLOWED_COUNTRIES.has(geo.countryCode)) {
        record.suspicionScore = Math.min(record.suspicionScore + 30, MAX_SCORE);
        if (record.suspicionScore >= BLOCK_THRESHOLD) {
          blockRecord(record, `País não autorizado: ${geo.country} (${geo.countryCode})`, ip);
        }
      }
    }).catch(() => {});
  }

  const newScore = calculateSuspicion(record, req);
  record.suspicionScore = newScore;

  if (newScore >= BLOCK_THRESHOLD) {
    blockRecord(record, `Score: ${newScore} (reqs=${record.count}, endpoints=${record.endpoints.size})`, ip);
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
// Geo lookup (ip-api.com — free tier, 45 req/min)
// ────────────────────────────────────────────────────────────────────────────

const geoCache = new Map<string, GeoInfo>();

async function lookupGeo(ip: string): Promise<GeoInfo | undefined> {
  if (geoCache.has(ip)) return geoCache.get(ip);
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return undefined;

  try {
    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get(
        `http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city,isp,org,timezone,hosting,proxy`,
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve(body));
        }
      );
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const parsed = JSON.parse(data);
    if (parsed.country) {
      const geo: GeoInfo = {
        country: parsed.country || '',
        countryCode: parsed.countryCode || '',
        region: parsed.regionName || '',
        city: parsed.city || '',
        isp: parsed.isp || '',
        org: parsed.org || '',
        timezone: parsed.timezone || '',
        hosting: parsed.hosting === true,
        proxy: parsed.proxy === true,
      };
      geoCache.set(ip, geo);
      return geo;
    }
  } catch { /* best-effort */ }
  return undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Export: dashboard / routes
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

export function addBlockedRange(prefix: string, reason: string): void {
  BLOCKED_IP_RANGES.push({ prefix, reason });
}

export function getBlockedRanges(): Array<{ prefix: string; reason: string }> {
  return [...BLOCKED_IP_RANGES];
}

setInterval(() => {
  const now = Date.now();
  ipTracker.forEach((record, ip) => {
    if (record.permanentlyBlocked) return;
    if (!record.blocked && (now - record.lastSeen > WINDOW_MS * 6)) {
      ipTracker.delete(ip);
    }
    if (record.blocked && !record.permanentlyBlocked && (now - record.lastSeen > 48 * 60 * 60 * 1000)) {
      ipTracker.delete(ip);
    }
  });
  sensitiveRateTracker.forEach((r, key) => {
    if (now - r.windowStart > 120000) sensitiveRateTracker.delete(key);
  });
}, 10 * 60 * 1000);
