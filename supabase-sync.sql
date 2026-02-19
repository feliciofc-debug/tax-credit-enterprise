-- ================================================================
-- SCRIPT DE SINCRONIZACAO — Schema Prisma → Supabase PostgreSQL
-- Branch: hpc-integration
-- Data: 2026-02-19
-- 
-- SEGURO: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS em tudo.
-- Pode rodar quantas vezes quiser sem quebrar nada.
-- 
-- Copie TUDO e cole no Supabase SQL Editor → Run
-- ================================================================

-- ================================================================
-- 1. TABELA "User" — Campos novos (endereco, representante, banco)
-- ================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "endereco" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "estado" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cep" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalRepRg" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalRepCargo" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalRepEmail" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalRepPhone" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAgency" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankPixKey" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankCpfCnpj" TEXT;

-- ================================================================
-- 2. TABELA "Partner" — Campos novos (endereco, banco)
-- ================================================================

ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "endereco" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "estado" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "cep" TEXT;

ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankAgency" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankPixKey" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "bankCpfCnpj" TEXT;

-- ================================================================
-- 3. TABELA "Contract" — Campos bipartite/tripartite
-- ================================================================

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "contractType" TEXT NOT NULL DEFAULT 'tripartite';
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 80;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "lawyerName" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "lawyerOab" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "escrowAgencia" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "escrowConta" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "estimatedCredits" DOUBLE PRECISION;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "setupFeePartner" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "setupFeePlatform" DOUBLE PRECISION NOT NULL DEFAULT 2000;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "consultaLiberada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "formalizacaoLiberada" BOOLEAN NOT NULL DEFAULT false;

-- Tornar partnerId opcional (para contratos bipartite)
ALTER TABLE "Contract" ALTER COLUMN "partnerId" DROP NOT NULL;

-- Recriar foreign key como SET NULL (em vez de RESTRICT)
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_partnerId_fkey";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" 
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Atualizar defaults dos splits para novo modelo
ALTER TABLE "Contract" ALTER COLUMN "partnerSplitPercent" SET DEFAULT 0;
ALTER TABLE "Contract" ALTER COLUMN "platformSplitPercent" SET DEFAULT 20;

-- Checklist de acompanhamento (JSON)
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "checklist" JSONB;

-- Indice por tipo de contrato
CREATE INDEX IF NOT EXISTS "Contract_contractType_idx" ON "Contract"("contractType");

-- ================================================================
-- 4. TABELA "SystemConfig" — Criar se nao existe
-- ================================================================

CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemConfig_key_key" ON "SystemConfig"("key");

-- ================================================================
-- 5. MARCAR MIGRATION COMO APLICADA (evita conflito no Prisma)
-- ================================================================

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
SELECT 
  gen_random_uuid()::text,
  'manual_sync_supabase',
  '20260219130617_add_contract_bipartite_tripartite',
  NOW(),
  NOW(),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" 
  WHERE migration_name = '20260219130617_add_contract_bipartite_tripartite'
);

-- ================================================================
-- 6. VERIFICACAO — Listar colunas da tabela Contract
-- ================================================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Contract'
ORDER BY ordinal_position;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================
