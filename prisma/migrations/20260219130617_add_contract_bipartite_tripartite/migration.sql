-- AlterTable: Contract - adicionar campos para bipartite/tripartite
-- contractType, clientSplitPercent, campos escrow/advogado, estimatedCredits, clientEarnings

-- Adicionar novas colunas com defaults
ALTER TABLE "Contract" ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'tripartite';
ALTER TABLE "Contract" ADD COLUMN "clientSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 80;
ALTER TABLE "Contract" ADD COLUMN "lawyerName" TEXT;
ALTER TABLE "Contract" ADD COLUMN "lawyerOab" TEXT;
ALTER TABLE "Contract" ADD COLUMN "escrowAgencia" TEXT;
ALTER TABLE "Contract" ADD COLUMN "escrowConta" TEXT;
ALTER TABLE "Contract" ADD COLUMN "estimatedCredits" DOUBLE PRECISION;
ALTER TABLE "Contract" ADD COLUMN "clientEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "setupFeePartner" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "setupFeePlatform" DOUBLE PRECISION NOT NULL DEFAULT 2000;
ALTER TABLE "Contract" ADD COLUMN "consultaLiberada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "formalizacaoLiberada" BOOLEAN NOT NULL DEFAULT false;

-- Tornar partnerId opcional (para contratos bipartite)
ALTER TABLE "Contract" ALTER COLUMN "partnerId" DROP NOT NULL;

-- Remover foreign key antiga (RESTRICT) e recriar como SET NULL
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_partnerId_fkey";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Atualizar defaults dos splits
ALTER TABLE "Contract" ALTER COLUMN "partnerSplitPercent" SET DEFAULT 0;
ALTER TABLE "Contract" ALTER COLUMN "platformSplitPercent" SET DEFAULT 20;

-- Indice por tipo de contrato
CREATE INDEX "Contract_contractType_idx" ON "Contract"("contractType");
