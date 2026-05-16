-- Migration: Onda 2 CONSULTRI - automacao (alertas, convites, auditoria, conformidade)
-- Idempotente (IF NOT EXISTS) para rodar com seguranca em multiplos ambientes.

-- ============================================================
-- Procuration: novos campos de alerta e responsavel
-- ============================================================
ALTER TABLE "Procuration"
  ADD COLUMN IF NOT EXISTS "alert60SentAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "alert30SentAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "alert7SentAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responsavelEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "responsavelPhone" TEXT;

CREATE INDEX IF NOT EXISTS "Procuration_serproStatus_idx" ON "Procuration"("serproStatus");

-- ============================================================
-- ProcurationAudit
-- ============================================================
CREATE TABLE IF NOT EXISTS "ProcurationAudit" (
  "id"            TEXT NOT NULL,
  "procurationId" TEXT NOT NULL,
  "event"         TEXT NOT NULL,
  "message"       TEXT,
  "actorType"     TEXT,
  "actorId"       TEXT,
  "payload"       JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcurationAudit_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ProcurationAudit"
    ADD CONSTRAINT "ProcurationAudit_procurationId_fkey"
    FOREIGN KEY ("procurationId") REFERENCES "Procuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProcurationAudit_procurationId_idx" ON "ProcurationAudit"("procurationId");
CREATE INDEX IF NOT EXISTS "ProcurationAudit_event_idx"         ON "ProcurationAudit"("event");
CREATE INDEX IF NOT EXISTS "ProcurationAudit_createdAt_idx"     ON "ProcurationAudit"("createdAt");

-- ============================================================
-- ProcurationInvite (link magico)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ProcurationInvite" (
  "id"             TEXT NOT NULL,
  "procurationId"  TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "recipientName"  TEXT,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "openedAt"       TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurationInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcurationInvite_token_key" ON "ProcurationInvite"("token");

DO $$ BEGIN
  ALTER TABLE "ProcurationInvite"
    ADD CONSTRAINT "ProcurationInvite_procurationId_fkey"
    FOREIGN KEY ("procurationId") REFERENCES "Procuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProcurationInvite_procurationId_idx" ON "ProcurationInvite"("procurationId");
CREATE INDEX IF NOT EXISTS "ProcurationInvite_status_idx"        ON "ProcurationInvite"("status");
CREATE INDEX IF NOT EXISTS "ProcurationInvite_expiresAt_idx"     ON "ProcurationInvite"("expiresAt");

-- ============================================================
-- Notification (outbound centralizado)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject"   TEXT,
  "body"      TEXT NOT NULL,
  "template"  TEXT,
  "refType"   TEXT,
  "refId"     TEXT,
  "status"    TEXT NOT NULL DEFAULT 'queued',
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_channel_idx"           ON "Notification"("channel");
CREATE INDEX IF NOT EXISTS "Notification_status_idx"            ON "Notification"("status");
CREATE INDEX IF NOT EXISTS "Notification_refType_refId_idx"     ON "Notification"("refType", "refId");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"         ON "Notification"("createdAt");

-- ============================================================
-- ConformidadeSnapshot (caixa postal + sitfis + dctfweb)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ConformidadeSnapshot" (
  "id"                  TEXT NOT NULL,
  "clientId"            TEXT NOT NULL,
  "cnpj"                TEXT NOT NULL,
  "procurationId"       TEXT,
  "caixaPostalUnread"   INTEGER NOT NULL DEFAULT 0,
  "caixaPostalNewSince" TIMESTAMP(3),
  "caixaPostalSummary"  JSONB,
  "situacaoStatus"      TEXT,
  "situacaoPendencias"  INTEGER NOT NULL DEFAULT 0,
  "situacaoResumo"      TEXT,
  "dctfwebAtrasos"      INTEGER NOT NULL DEFAULT 0,
  "dctfwebUltimoPa"     TEXT,
  "score"               INTEGER,
  "raw"                 JSONB,
  "collectedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConformidadeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConformidadeSnapshot_clientId_idx"    ON "ConformidadeSnapshot"("clientId");
CREATE INDEX IF NOT EXISTS "ConformidadeSnapshot_cnpj_idx"        ON "ConformidadeSnapshot"("cnpj");
CREATE INDEX IF NOT EXISTS "ConformidadeSnapshot_collectedAt_idx" ON "ConformidadeSnapshot"("collectedAt");
CREATE INDEX IF NOT EXISTS "ConformidadeSnapshot_score_idx"       ON "ConformidadeSnapshot"("score");
