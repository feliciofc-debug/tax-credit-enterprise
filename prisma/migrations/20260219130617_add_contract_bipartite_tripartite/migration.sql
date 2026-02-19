-- AlterTable: Contract - adicionar campos para bipartite/tripartite
-- Usando IF NOT EXISTS para evitar conflito com colunas ja existentes (db push)

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

-- Remover foreign key antiga (RESTRICT) e recriar como SET NULL
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_partnerId_fkey";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Atualizar defaults dos splits
ALTER TABLE "Contract" ALTER COLUMN "partnerSplitPercent" SET DEFAULT 0;
ALTER TABLE "Contract" ALTER COLUMN "platformSplitPercent" SET DEFAULT 20;

-- Indice por tipo de contrato
CREATE INDEX IF NOT EXISTS "Contract_contractType_idx" ON "Contract"("contractType");
