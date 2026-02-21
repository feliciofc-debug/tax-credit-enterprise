-- CreateTable Procuration
CREATE TABLE "Procuration" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "clientId" TEXT NOT NULL,
    "partnerId" TEXT,
    "type" TEXT NOT NULL,
    "lawyerScenario" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "outorgadoAtom" BOOLEAN NOT NULL DEFAULT true,
    "outorgadoAdv" BOOLEAN NOT NULL DEFAULT false,
    "advogadoNome" TEXT,
    "advogadoOab" TEXT,
    "advogadoCpf" TEXT,
    "advogadoEndereco" TEXT,
    "uf" TEXT,
    "prazoAnos" INTEGER NOT NULL DEFAULT 2,
    "poderes" JSONB,
    "documentText" TEXT,
    "dataAssinatura" TIMESTAMP(3),
    "dataValidade" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Procuration_clientId_idx" ON "Procuration"("clientId");
CREATE INDEX "Procuration_contractId_idx" ON "Procuration"("contractId");
CREATE INDEX "Procuration_partnerId_idx" ON "Procuration"("partnerId");
CREATE INDEX "Procuration_status_idx" ON "Procuration"("status");
