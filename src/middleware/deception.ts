// src/middleware/deception.ts
// Defensive deception: serve fake data from honeypot endpoints, track canary
// tokens, and tarpit known attackers. ALL legal — operates only on this server.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { blockIp } from './antiScraping';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type BaitType =
  | 'env_file'
  | 'env_local'
  | 'env_production'
  | 'wp_config'
  | 'git_config'
  | 'admin_panel'
  | 'phpmyadmin'
  | 'fake_api_users'
  | 'fake_api_export'
  | 'fake_api_database'
  | 'fake_api_keys'
  | 'fake_api_internal'
  | 'fake_swagger'
  | 'fake_graphql'
  | 'config_json'
  | 'backup_file'
  | 'server_status';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function genCanaryToken(prefix: string = 'ck'): string {
  const rand = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${rand}`;
}

function genFakeAwsKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let key = 'AKIA';
  for (let i = 0; i < 16; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function genFakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin',
    name: 'System Administrator',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const sig = crypto.randomBytes(32).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

function tarpitDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logDeception(
  ip: string,
  path: string,
  userAgent: string | undefined,
  baitType: BaitType,
  canaryToken: string | null,
  responseSize: number,
  durationMs: number,
): Promise<void> {
  try {
    await prisma.deceptionEvent.create({
      data: {
        ip,
        path,
        userAgent: userAgent?.substring(0, 500) || null,
        baitType,
        canaryToken,
        responseSize,
        durationMs,
      },
    });
    if (canaryToken) {
      await prisma.canaryToken.create({
        data: {
          token: canaryToken,
          servedToIp: ip,
          baitType,
        },
      });
    }
  } catch (err: any) {
    logger.warn(`[DECEPTION] DB log falhou: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Bait generators — fake but plausible content
// ────────────────────────────────────────────────────────────────────────────

function generateFakeEnvFile(canary: string): string {
  return `# Production environment
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://app_user:${crypto.randomBytes(8).toString('hex')}@db-prod-${crypto.randomBytes(4).toString('hex')}.internal:5432/app_production
REDIS_URL=redis://:${crypto.randomBytes(12).toString('hex')}@redis.internal:6379

# AWS
AWS_ACCESS_KEY_ID=${genFakeAwsKey()}
AWS_SECRET_ACCESS_KEY=${crypto.randomBytes(20).toString('base64')}
AWS_REGION=sa-east-1
S3_BUCKET=app-prod-uploads-${crypto.randomBytes(4).toString('hex')}

# JWT
JWT_SECRET=${canary}
JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString('hex')}

# API Keys (DO NOT SHARE)
STRIPE_SECRET_KEY=sk_live_${crypto.randomBytes(24).toString('hex')}
SENDGRID_API_KEY=SG.${crypto.randomBytes(11).toString('base64url')}.${crypto.randomBytes(22).toString('base64url')}
ANTHROPIC_API_KEY=sk-ant-api03-${crypto.randomBytes(40).toString('base64url')}

# OAuth
GOOGLE_CLIENT_ID=${Math.floor(Math.random() * 1e12)}.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-${crypto.randomBytes(20).toString('base64url')}

# Internal
ADMIN_PASSWORD=${crypto.randomBytes(12).toString('base64')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
`;
}

function generateFakeWpConfig(canary: string): string {
  return `<?php
// WordPress configuration
define('DB_NAME',     'wp_production');
define('DB_USER',     'wpadmin');
define('DB_PASSWORD', '${crypto.randomBytes(10).toString('base64')}');
define('DB_HOST',     'localhost');
define('DB_CHARSET',  'utf8mb4');
define('DB_COLLATE',  '');

\$table_prefix = 'wp_';

define('AUTH_KEY',         '${canary}');
define('SECURE_AUTH_KEY',  '${crypto.randomBytes(32).toString('hex')}');
define('LOGGED_IN_KEY',    '${crypto.randomBytes(32).toString('hex')}');
define('NONCE_KEY',        '${crypto.randomBytes(32).toString('hex')}');

define('WP_DEBUG', false);
require_once(ABSPATH . 'wp-settings.php');
`;
}

function generateFakeGitConfig(): string {
  return `[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = false
\tlogallrefupdates = true
[remote "origin"]
\turl = https://github.com/internal-org/legacy-app.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
\tmerge = refs/heads/main
[user]
\tname = Deploy Bot
\temail = deploy@internal.local
`;
}

function generateFakeUsers(canary: string): any {
  const firstNames = ['Carlos', 'Ana', 'Joao', 'Maria', 'Pedro', 'Lucia', 'Rafael', 'Beatriz', 'Felipe', 'Camila'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Almeida', 'Rodrigues'];
  const users = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    email: `user${i + 1}@${['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'][i % 4]}`,
    name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
    role: i === 0 ? 'admin' : (i < 3 ? 'manager' : 'user'),
    createdAt: new Date(Date.now() - i * 86400000 * 30).toISOString(),
    lastLogin: new Date(Date.now() - i * 3600000).toISOString(),
    apiToken: i === 0 ? canary : `usr_${crypto.randomBytes(16).toString('hex')}`,
  }));
  return { total: 25, page: 1, pageSize: 25, users };
}

function generateFakeApiKeys(canary: string): any {
  return {
    keys: [
      {
        id: 'key_1',
        name: 'Production API Key',
        key: canary,
        scopes: ['read', 'write', 'admin'],
        createdAt: '2024-01-15T10:00:00Z',
        lastUsed: new Date().toISOString(),
      },
      {
        id: 'key_2',
        name: 'Backup Service',
        key: `bs_${crypto.randomBytes(24).toString('hex')}`,
        scopes: ['read', 'backup'],
        createdAt: '2024-03-22T14:30:00Z',
      },
      {
        id: 'key_3',
        name: 'Mobile App Key',
        key: `app_${crypto.randomBytes(24).toString('hex')}`,
        scopes: ['read'],
        createdAt: '2024-06-10T08:15:00Z',
      },
    ],
  };
}

function generateFakeDatabaseDump(): any {
  return {
    error: false,
    message: 'Database dump in progress',
    estimatedSize: '2.3 GB',
    estimatedTimeMinutes: 18,
    queueId: `dump_${crypto.randomBytes(12).toString('hex')}`,
    tables: ['users', 'orders', 'products', 'sessions', 'logs', 'transactions'],
    note: 'You will receive an email when ready',
  };
}

function generateFakeServerStatus(): string {
  return `Apache Server Status

Server Version: Apache/2.4.41 (Ubuntu)
Server MPM: event
Server Built: 2023-08-14T10:00:00
Current Time: ${new Date().toISOString()}
Restart Time: ${new Date(Date.now() - 3600000 * 72).toISOString()}
Parent Server Config. Generation: 1
Server uptime: 3 days 2 hours 15 minutes 33 seconds
Server load: 0.42 0.38 0.35
Total accesses: 1284592 - Total Traffic: 23.4 GB
CPU Usage: u12.3 s4.1 cu0 cs0 - .19% CPU load
1.34 requests/sec - 4.2 kB/second - 18.2 kB/request
185 requests currently being processed, 65 idle workers
`;
}

function generateFakeSwagger(canary: string): any {
  return {
    swagger: '2.0',
    info: {
      title: 'Internal API',
      version: '1.0.0',
      description: 'Internal services',
      contact: { email: 'api@internal.local' },
    },
    host: 'internal-api.local',
    basePath: '/v1',
    schemes: ['https'],
    securityDefinitions: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        'x-example': canary,
      },
    },
    paths: {
      '/users': { get: { summary: 'List users', security: [{ ApiKeyAuth: [] }] } },
      '/users/{id}': { get: { summary: 'Get user', security: [{ ApiKeyAuth: [] }] } },
      '/orders': { get: { summary: 'List orders', security: [{ ApiKeyAuth: [] }] } },
      '/admin/dashboard': { get: { summary: 'Admin dashboard', security: [{ ApiKeyAuth: [] }] } },
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bait routing — maps honeypot path to bait type
// ────────────────────────────────────────────────────────────────────────────

interface BaitConfig {
  match: RegExp;
  type: BaitType;
  contentType: string;
  generator: (canary: string) => string | object;
}

const BAITS: BaitConfig[] = [
  { match: /^\/\.env(\.local|\.production|\.development)?$/i, type: 'env_file', contentType: 'text/plain', generator: c => generateFakeEnvFile(c) },
  { match: /^\/wp-config(\.php)?$/i, type: 'wp_config', contentType: 'application/x-httpd-php', generator: c => generateFakeWpConfig(c) },
  { match: /^\/\.git\/config$/i, type: 'git_config', contentType: 'text/plain', generator: () => generateFakeGitConfig() },
  { match: /^\/\.git\/HEAD$/i, type: 'git_config', contentType: 'text/plain', generator: () => 'ref: refs/heads/main\n' },
  { match: /^\/(wp-admin|wp-login\.php|administrator|admin\.php)/i, type: 'admin_panel', contentType: 'text/html', generator: () => '<!DOCTYPE html><html><head><title>Login</title></head><body><form><input name="username" placeholder="Username"><input name="password" type="password" placeholder="Password"><button>Sign in</button></form></body></html>' },
  { match: /^\/phpmyadmin/i, type: 'phpmyadmin', contentType: 'text/html', generator: () => '<!DOCTYPE html><html><head><title>phpMyAdmin</title></head><body><h1>Welcome to phpMyAdmin</h1><form><input name="pma_username"><input name="pma_password" type="password"><button>Go</button></form></body></html>' },
  { match: /^\/api\/v[0-9]+\/users($|\/)/i, type: 'fake_api_users', contentType: 'application/json', generator: c => generateFakeUsers(c) },
  { match: /^\/api\/v[0-9]+\/(export|database)/i, type: 'fake_api_database', contentType: 'application/json', generator: () => generateFakeDatabaseDump() },
  { match: /^\/api\/(internal|v[0-9]+\/internal)\/keys/i, type: 'fake_api_keys', contentType: 'application/json', generator: c => generateFakeApiKeys(c) },
  { match: /^\/api\/(swagger|openapi|api-docs|docs)/i, type: 'fake_swagger', contentType: 'application/json', generator: c => generateFakeSwagger(c) },
  { match: /^\/api\/graphql/i, type: 'fake_graphql', contentType: 'application/json', generator: () => ({ data: null, errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }] }) },
  { match: /^\/server-status/i, type: 'server_status', contentType: 'text/plain', generator: () => generateFakeServerStatus() },
  { match: /^\/(config\.json|configuration\.json)$/i, type: 'config_json', contentType: 'application/json', generator: c => ({ env: 'production', version: '2.4.1', database: { host: 'db.internal', port: 5432, name: 'app_prod' }, secrets: { jwtSecret: c, encryptionKey: crypto.randomBytes(32).toString('hex') } }) },
  { match: /^\/(backup|backup\.sql|backup\.zip|backup\.tar|database\.bak|dump\.sql)$/i, type: 'backup_file', contentType: 'application/octet-stream', generator: () => generateFakeServerStatus() },
];

// ────────────────────────────────────────────────────────────────────────────
// Tarpit configuration — slow response for known attackers
// ────────────────────────────────────────────────────────────────────────────

const TARPIT_DELAY_MS = 8000;        // 8 segundos por padrao
const TARPIT_MAX_DELAY_MS = 30000;   // ate 30s para reincidentes
const ipHitCount = new Map<string, number>();

function getTarpitDelay(ip: string): number {
  const hits = (ipHitCount.get(ip) || 0) + 1;
  ipHitCount.set(ip, hits);
  // Mais hits = mais lento (1x=8s, 2x=12s, 3x=18s, 4x+=30s)
  return Math.min(TARPIT_DELAY_MS + (hits - 1) * 5000, TARPIT_MAX_DELAY_MS);
}

setInterval(() => {
  // limpa contadores antigos a cada hora
  ipHitCount.clear();
}, 60 * 60 * 1000);

// ────────────────────────────────────────────────────────────────────────────
// Main middleware
// ────────────────────────────────────────────────────────────────────────────

export async function deceptionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path;
  const bait = BAITS.find(b => b.match.test(path));

  if (!bait) {
    next();
    return;
  }

  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const start = Date.now();

  // Tarpit: delay artificial pra fazer scanner perder tempo
  const delay = getTarpitDelay(ip);
  await tarpitDelay(delay);

  // Generate canary token + bait content
  const canary = genCanaryToken('ck_live');
  const content = bait.generator(canary);
  const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const responseSize = Buffer.byteLength(body, 'utf8');
  const durationMs = Date.now() - start;

  // Log forense
  logDeception(ip, path, ua, bait.type, canary, responseSize, durationMs).catch(() => {});

  logger.warn(`[DECEPTION] ${ip} mordeu o bait: ${path} (${bait.type}) — canary=${canary} delay=${delay}ms size=${responseSize}b`);

  // Apos servir o bait, bloquear permanentemente o IP — proximas requests dele
  // levam 403 instantaneo do antiScraping
  try { blockIp(ip); } catch { /* ignore */ }

  // Headers convincentes
  res.setHeader('Content-Type', bait.contentType);
  res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
  res.setHeader('X-Powered-By', 'PHP/7.4.3');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(body);
}

// ────────────────────────────────────────────────────────────────────────────
// Canary trigger detection — chamado se aparecer em login attempts
// ────────────────────────────────────────────────────────────────────────────

export async function checkCanaryTrigger(input: string, sourceIp: string, note: string): Promise<boolean> {
  if (!input || input.length < 10) return false;
  try {
    const canary = await prisma.canaryToken.findUnique({ where: { token: input } });
    if (!canary) return false;
    if (canary.triggeredAt) return true; // already triggered

    await prisma.canaryToken.update({
      where: { id: canary.id },
      data: {
        triggeredAt: new Date(),
        triggerSource: sourceIp,
        triggerNote: note,
      },
    });

    logger.error(`[CANARY TRIGGERED] Token ${input.substring(0, 16)}... vazado de ${canary.servedToIp} foi usado por ${sourceIp} | Note: ${note}`);
    return true;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Reports for dashboard
// ────────────────────────────────────────────────────────────────────────────

export async function getDeceptionReport(): Promise<any> {
  try {
    const [events, canaries, totalEvents] = await Promise.all([
      prisma.deceptionEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.canaryToken.findMany({
        where: { triggeredAt: { not: null } },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
      }),
      prisma.deceptionEvent.count(),
    ]);

    const byBaitType: Record<string, number> = {};
    const byIp: Record<string, number> = {};
    const totalBytesServed = events.reduce((sum, e) => sum + (e.responseSize || 0), 0);
    const totalTarpitTime = events.reduce((sum, e) => sum + (e.durationMs || 0), 0);

    events.forEach(e => {
      byBaitType[e.baitType] = (byBaitType[e.baitType] || 0) + 1;
      byIp[e.ip] = (byIp[e.ip] || 0) + 1;
    });

    return {
      totalEvents,
      totalBytesServed,
      totalTarpitMinutes: Math.round(totalTarpitTime / 60000 * 10) / 10,
      byBaitType,
      topVictims: Object.entries(byIp).map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      triggeredCanaries: canaries.map(c => ({
        token: c.token.substring(0, 20) + '...',
        baitType: c.baitType,
        servedToIp: c.servedToIp,
        servedAt: c.servedAt,
        triggeredAt: c.triggeredAt,
        triggerSource: c.triggerSource,
        triggerNote: c.triggerNote,
      })),
      recentEvents: events.slice(0, 100).map(e => ({
        ip: e.ip,
        path: e.path,
        baitType: e.baitType,
        responseSize: e.responseSize,
        durationMs: e.durationMs,
        userAgent: e.userAgent?.substring(0, 80),
        timestamp: e.createdAt,
      })),
    };
  } catch (err: any) {
    return { totalEvents: 0, error: err?.message || 'unknown error' };
  }
}
