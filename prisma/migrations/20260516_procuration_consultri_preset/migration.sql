-- Migration: adiciona suporte a presets (CONSULTRI) + verificacao SERPRO na Procuration
-- Gerada manualmente pois o DB local nao estava acessivel no momento da geracao
-- (rodar `npx prisma migrate resolve --applied 20260516_procuration_consultri_preset`
--  caso queira reconciliar historico, ou simplesmente `prisma migrate deploy`)

ALTER TABLE "Procuration"
  ADD COLUMN IF NOT EXISTS "presetKey"         TEXT,
  ADD COLUMN IF NOT EXISTS "procuradorCnpj"    TEXT,
  ADD COLUMN IF NOT EXISTS "procuradorNome"    TEXT,
  ADD COLUMN IF NOT EXISTS "lastSerproCheckAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serproStatus"      TEXT,
  ADD COLUMN IF NOT EXISTS "serproDiff"        JSONB,
  ADD COLUMN IF NOT EXISTS "serproRaw"         JSONB;

CREATE INDEX IF NOT EXISTS "Procuration_presetKey_idx"    ON "Procuration"("presetKey");
CREATE INDEX IF NOT EXISTS "Procuration_dataValidade_idx" ON "Procuration"("dataValidade");
