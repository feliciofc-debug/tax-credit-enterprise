-- CreateTable
CREATE TABLE "TeseJurisprudencia" (
    "id" TEXT NOT NULL,
    "teseId" TEXT,
    "teseCodigo" TEXT NOT NULL,
    "temaVinculante" TEXT,
    "tribunal" TEXT,
    "dataJulgamento" TIMESTAMP(3),
    "resultado" TEXT NOT NULL,
    "probabilidadeMaxima" INTEGER,
    "modulacao" TEXT,
    "notas" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeseJurisprudencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeseJurisprudencia_teseCodigo_idx" ON "TeseJurisprudencia"("teseCodigo");

-- CreateIndex
CREATE INDEX "TeseJurisprudencia_ativo_idx" ON "TeseJurisprudencia"("ativo");

-- Insert seed: Tese 20 SM (3.2) - desfavorável STJ
INSERT INTO "TeseJurisprudencia" ("id", "teseCodigo", "temaVinculante", "tribunal", "dataJulgamento", "resultado", "probabilidadeMaxima", "modulacao", "notas", "ativo", "createdAt", "updatedAt")
VALUES (
    'tese_jur_20sm_001',
    '3.2',
    'Tema 1.079 e 1.390',
    'STJ',
    '2023-10-25',
    'DESFAVORAVEL',
    10,
    'Preserva direitos apenas de quem tinha decisão favorável até 25/10/2023',
    'Contribuições a terceiros (20 SM) - limite não se aplica às parafiscais',
    true,
    NOW(),
    NOW()
);
