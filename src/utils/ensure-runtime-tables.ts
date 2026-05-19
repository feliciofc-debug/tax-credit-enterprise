// Garante que tabelas críticas do schema existam em runtime, mesmo
// quando `prisma db push` falha no startup (timeout, sem TTY, CLI ausente).
// Idempotente — todos os DDL usam IF NOT EXISTS / DO NOTHING.

import { prisma } from './prisma';
import { logger } from './logger';

const RUNTIME_DDL: Array<{ name: string; sql: string }> = [
  // ─── SerproConnection ──────────────────────────────────────────
  {
    name: 'SerproConnection',
    sql: `CREATE TABLE IF NOT EXISTS "SerproConnection" (
      "id"             TEXT PRIMARY KEY,
      "cnpj"           TEXT NOT NULL,
      "companyName"    TEXT NOT NULL,
      "consumerKey"    TEXT NOT NULL,
      "consumerSecret" TEXT NOT NULL,
      "certBase64"     TEXT,
      "certPassword"   TEXT,
      "status"         TEXT NOT NULL DEFAULT 'pending',
      "environment"    TEXT NOT NULL DEFAULT 'trial',
      "lastSyncAt"     TIMESTAMP(3),
      "lastError"      TEXT,
      "procuracaoOk"   BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  { name: 'SerproConnection_cnpj_idx',   sql: `CREATE INDEX IF NOT EXISTS "SerproConnection_cnpj_idx"   ON "SerproConnection"("cnpj");` },
  { name: 'SerproConnection_status_idx', sql: `CREATE INDEX IF NOT EXISTS "SerproConnection_status_idx" ON "SerproConnection"("status");` },

  // ─── SerproLog ─────────────────────────────────────────────────
  {
    name: 'SerproLog',
    sql: `CREATE TABLE IF NOT EXISTS "SerproLog" (
      "id"            TEXT PRIMARY KEY,
      "connectionId"  TEXT NOT NULL,
      "service"       TEXT NOT NULL,
      "endpoint"      TEXT NOT NULL,
      "statusCode"    INTEGER,
      "success"       BOOLEAN NOT NULL DEFAULT FALSE,
      "responseData"  JSONB,
      "errorMessage"  TEXT,
      "durationMs"    INTEGER,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  { name: 'SerproLog_connectionId_idx', sql: `CREATE INDEX IF NOT EXISTS "SerproLog_connectionId_idx" ON "SerproLog"("connectionId");` },
  { name: 'SerproLog_service_idx',      sql: `CREATE INDEX IF NOT EXISTS "SerproLog_service_idx"      ON "SerproLog"("service");` },
  { name: 'SerproLog_createdAt_idx',    sql: `CREATE INDEX IF NOT EXISTS "SerproLog_createdAt_idx"    ON "SerproLog"("createdAt");` },
  {
    name: 'SerproLog_fk',
    sql: `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'SerproLog_connectionId_fkey'
      ) THEN
        ALTER TABLE "SerproLog"
          ADD CONSTRAINT "SerproLog_connectionId_fkey"
          FOREIGN KEY ("connectionId")
          REFERENCES "SerproConnection"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;`,
  },

  // ─── SecurityEvent ─────────────────────────────────────────────
  {
    name: 'SecurityEvent',
    sql: `CREATE TABLE IF NOT EXISTS "SecurityEvent" (
      "id"        TEXT PRIMARY KEY,
      "ip"        TEXT NOT NULL,
      "action"    TEXT NOT NULL,
      "reason"    TEXT NOT NULL,
      "userAgent" TEXT,
      "path"      TEXT,
      "score"     INTEGER NOT NULL DEFAULT 100,
      "country"   TEXT,
      "region"    TEXT,
      "city"      TEXT,
      "isp"       TEXT,
      "org"       TEXT,
      "hosting"   BOOLEAN NOT NULL DEFAULT FALSE,
      "proxy"     BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  { name: 'SecurityEvent_ip_idx',        sql: `CREATE INDEX IF NOT EXISTS "SecurityEvent_ip_idx"        ON "SecurityEvent"("ip");` },
  { name: 'SecurityEvent_createdAt_idx', sql: `CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");` },
  { name: 'SecurityEvent_action_idx',    sql: `CREATE INDEX IF NOT EXISTS "SecurityEvent_action_idx"    ON "SecurityEvent"("action");` },

  // ─── DeceptionEvent ────────────────────────────────────────────
  {
    name: 'DeceptionEvent',
    sql: `CREATE TABLE IF NOT EXISTS "DeceptionEvent" (
      "id"           TEXT PRIMARY KEY,
      "ip"           TEXT NOT NULL,
      "path"         TEXT NOT NULL,
      "userAgent"    TEXT,
      "baitType"     TEXT NOT NULL,
      "canaryToken"  TEXT,
      "responseSize" INTEGER NOT NULL DEFAULT 0,
      "durationMs"   INTEGER,
      "country"      TEXT,
      "region"       TEXT,
      "city"         TEXT,
      "isp"          TEXT,
      "org"          TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  },
  { name: 'DeceptionEvent_ip_idx',          sql: `CREATE INDEX IF NOT EXISTS "DeceptionEvent_ip_idx"          ON "DeceptionEvent"("ip");` },
  { name: 'DeceptionEvent_canaryToken_idx', sql: `CREATE INDEX IF NOT EXISTS "DeceptionEvent_canaryToken_idx" ON "DeceptionEvent"("canaryToken");` },
  { name: 'DeceptionEvent_baitType_idx',    sql: `CREATE INDEX IF NOT EXISTS "DeceptionEvent_baitType_idx"    ON "DeceptionEvent"("baitType");` },
  { name: 'DeceptionEvent_createdAt_idx',   sql: `CREATE INDEX IF NOT EXISTS "DeceptionEvent_createdAt_idx"   ON "DeceptionEvent"("createdAt");` },

  // ─── CanaryToken ───────────────────────────────────────────────
  {
    name: 'CanaryToken',
    sql: `CREATE TABLE IF NOT EXISTS "CanaryToken" (
      "id"            TEXT PRIMARY KEY,
      "token"         TEXT NOT NULL UNIQUE,
      "servedToIp"    TEXT NOT NULL,
      "baitType"      TEXT NOT NULL,
      "servedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "triggeredAt"   TIMESTAMP(3),
      "triggerSource" TEXT,
      "triggerNote"   TEXT
    );`,
  },
  { name: 'CanaryToken_token_idx',       sql: `CREATE INDEX IF NOT EXISTS "CanaryToken_token_idx"       ON "CanaryToken"("token");` },
  { name: 'CanaryToken_servedToIp_idx',  sql: `CREATE INDEX IF NOT EXISTS "CanaryToken_servedToIp_idx"  ON "CanaryToken"("servedToIp");` },
  { name: 'CanaryToken_triggeredAt_idx', sql: `CREATE INDEX IF NOT EXISTS "CanaryToken_triggeredAt_idx" ON "CanaryToken"("triggeredAt");` },
];

export async function ensureRuntimeTables(): Promise<void> {
  let ok = 0;
  let failed = 0;
  for (const stmt of RUNTIME_DDL) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
      ok++;
    } catch (err: any) {
      failed++;
      logger.warn(`[DB] Falha em DDL "${stmt.name}": ${err?.message || err}`);
    }
  }
  if (failed === 0) {
    logger.info(`[DB] Tabelas runtime OK (${ok} statements idempotentes aplicados)`);
  } else {
    logger.warn(`[DB] Tabelas runtime: ${ok} ok, ${failed} falharam`);
  }
}
