-- CreateTable TaxThesis
CREATE TABLE "TaxThesis" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tributo" TEXT NOT NULL,
    "fundamentacao" TEXT NOT NULL,
    "tribunal" TEXT,
    "tema" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "risco" TEXT NOT NULL DEFAULT 'medio',
    "probabilidade" INTEGER NOT NULL DEFAULT 70,
    "setoresAplicaveis" TEXT,
    "regimesAplicaveis" TEXT,
    "formulaCalculo" TEXT,
    "fonte" TEXT,
    "dataDecisao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxThesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable ThesisUpdate
CREATE TABLE "ThesisUpdate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "tribunal" TEXT,
    "relevance" TEXT NOT NULL DEFAULT 'medium',
    "thesisCode" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThesisUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxThesis_code_key" ON "TaxThesis"("code");
CREATE INDEX "TaxThesis_tributo_idx" ON "TaxThesis"("tributo");
CREATE INDEX "TaxThesis_status_idx" ON "TaxThesis"("status");
CREATE INDEX "TaxThesis_ativo_idx" ON "TaxThesis"("ativo");
CREATE INDEX "ThesisUpdate_reviewed_idx" ON "ThesisUpdate"("reviewed");
CREATE INDEX "ThesisUpdate_relevance_idx" ON "ThesisUpdate"("relevance");
