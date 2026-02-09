-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "cnpj" TEXT,
    "regime" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "processedDocs" INTEGER NOT NULL DEFAULT 0,
    "failedDocs" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOpportunities" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consolidatedReport" TEXT,

    CONSTRAINT "BatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchJobId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "extractedPeriod" TEXT,
    "extractedYear" INTEGER,
    "extractedMonth" INTEGER,
    "extractedQuarter" INTEGER,
    "companyName" TEXT,
    "cnpj" TEXT,
    "regime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "extractedText" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "opportunities" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "totalEstimatedValue" DOUBLE PRECISION NOT NULL,
    "recommendations" TEXT NOT NULL,
    "alerts" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCreditProcess" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "opportunityIndex" INTEGER NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'docs_generated',
    "docsGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "docsZipPath" TEXT,
    "protocolNumber" TEXT,
    "protocolDate" TIMESTAMP(3),
    "responseStatus" TEXT,
    "recoveredValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCreditProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "BatchJob_userId_status_idx" ON "BatchJob"("userId", "status");

-- CreateIndex
CREATE INDEX "BatchJob_createdAt_idx" ON "BatchJob"("createdAt");

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");

-- CreateIndex
CREATE INDEX "Document_batchJobId_idx" ON "Document"("batchJobId");

-- CreateIndex
CREATE INDEX "Document_extractedYear_extractedMonth_idx" ON "Document"("extractedYear", "extractedMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Analysis_documentId_key" ON "Analysis"("documentId");

-- CreateIndex
CREATE INDEX "Analysis_totalEstimatedValue_idx" ON "Analysis"("totalEstimatedValue");

-- CreateIndex
CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt");

-- CreateIndex
CREATE INDEX "TaxCreditProcess_status_idx" ON "TaxCreditProcess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "BatchJob" ADD CONSTRAINT "BatchJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCreditProcess" ADD CONSTRAINT "TaxCreditProcess_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
