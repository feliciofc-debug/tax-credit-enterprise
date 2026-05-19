-- Migration: SERPRO Integra Contador + Shield (security/deception/canary)
-- Cria as 5 tabelas que estavam no schema.prisma mas nunca foram migradas:
--   SerproConnection, SerproLog, SecurityEvent, DeceptionEvent, CanaryToken
-- Idempotente — pode rodar varias vezes sem quebrar.

-- =========================================================
-- SERPRO Integra Contador
-- =========================================================
CREATE TABLE IF NOT EXISTS "SerproConnection" (
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
);

CREATE INDEX IF NOT EXISTS "SerproConnection_cnpj_idx"   ON "SerproConnection"("cnpj");
CREATE INDEX IF NOT EXISTS "SerproConnection_status_idx" ON "SerproConnection"("status");

CREATE TABLE IF NOT EXISTS "SerproLog" (
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
);

CREATE INDEX IF NOT EXISTS "SerproLog_connectionId_idx" ON "SerproLog"("connectionId");
CREATE INDEX IF NOT EXISTS "SerproLog_service_idx"      ON "SerproLog"("service");
CREATE INDEX IF NOT EXISTS "SerproLog_createdAt_idx"    ON "SerproLog"("createdAt");

DO $$
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
END $$;

-- =========================================================
-- Shield: SecurityEvent (bloqueios anti-scraping)
-- =========================================================
CREATE TABLE IF NOT EXISTS "SecurityEvent" (
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
);

CREATE INDEX IF NOT EXISTS "SecurityEvent_ip_idx"        ON "SecurityEvent"("ip");
CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "SecurityEvent_action_idx"    ON "SecurityEvent"("action");

-- =========================================================
-- Shield: DeceptionEvent (honeypot/baits servidos)
-- =========================================================
CREATE TABLE IF NOT EXISTS "DeceptionEvent" (
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
);

CREATE INDEX IF NOT EXISTS "DeceptionEvent_ip_idx"          ON "DeceptionEvent"("ip");
CREATE INDEX IF NOT EXISTS "DeceptionEvent_canaryToken_idx" ON "DeceptionEvent"("canaryToken");
CREATE INDEX IF NOT EXISTS "DeceptionEvent_baitType_idx"    ON "DeceptionEvent"("baitType");
CREATE INDEX IF NOT EXISTS "DeceptionEvent_createdAt_idx"   ON "DeceptionEvent"("createdAt");

-- =========================================================
-- Shield: CanaryToken (tokens unicos rastreaveis)
-- =========================================================
CREATE TABLE IF NOT EXISTS "CanaryToken" (
  "id"            TEXT PRIMARY KEY,
  "token"         TEXT NOT NULL UNIQUE,
  "servedToIp"    TEXT NOT NULL,
  "baitType"      TEXT NOT NULL,
  "servedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "triggeredAt"   TIMESTAMP(3),
  "triggerSource" TEXT,
  "triggerNote"   TEXT
);

CREATE INDEX IF NOT EXISTS "CanaryToken_token_idx"       ON "CanaryToken"("token");
CREATE INDEX IF NOT EXISTS "CanaryToken_servedToIp_idx"  ON "CanaryToken"("servedToIp");
CREATE INDEX IF NOT EXISTS "CanaryToken_triggeredAt_idx" ON "CanaryToken"("triggeredAt");
