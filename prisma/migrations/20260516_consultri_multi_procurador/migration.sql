-- Onda 4D — Multi-procurador
-- Adiciona modelo ProcuradorEntity + FK opcional em Procuration.

CREATE TABLE IF NOT EXISTS "ProcuradorEntity" (
  "id" TEXT PRIMARY KEY,
  "cnpj" TEXT NOT NULL UNIQUE,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "presetKey" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "cor" TEXT,
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProcuradorEntity_ativo_idx" ON "ProcuradorEntity"("ativo");

ALTER TABLE "Procuration"
  ADD COLUMN IF NOT EXISTS "procuradorEntityId" TEXT;

CREATE INDEX IF NOT EXISTS "Procuration_procuradorEntityId_idx" ON "Procuration"("procuradorEntityId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Procuration_procuradorEntityId_fkey'
  ) THEN
    ALTER TABLE "Procuration"
      ADD CONSTRAINT "Procuration_procuradorEntityId_fkey"
      FOREIGN KEY ("procuradorEntityId") REFERENCES "ProcuradorEntity"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
