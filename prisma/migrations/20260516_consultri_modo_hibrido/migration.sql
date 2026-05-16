-- Migration: CONSULTRI modo hibrido (outorga automatica via SERPRO AUTENTICAPROCURADOR)
-- Idempotente

ALTER TABLE "Procuration"
  ADD COLUMN IF NOT EXISTS "grantMode"             TEXT,
  ADD COLUMN IF NOT EXISTS "autoGrantStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "autoGrantAttemptedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoGrantError"        TEXT,
  ADD COLUMN IF NOT EXISTS "autoGrantProtocol"     TEXT,
  ADD COLUMN IF NOT EXISTS "revocationDetectedAt"  TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Procuration_grantMode_idx" ON "Procuration"("grantMode");
