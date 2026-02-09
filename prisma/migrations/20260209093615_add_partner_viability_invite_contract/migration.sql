-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contratoSocialUrl" TEXT,
ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "invitedByPartnerId" TEXT,
ADD COLUMN     "legalRepCpf" TEXT,
ADD COLUMN     "legalRepIdDocUrl" TEXT,
ADD COLUMN     "legalRepName" TEXT,
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oabNumber" TEXT,
    "oabState" TEXT,
    "company" TEXT,
    "cnpj" TEXT,
    "phone" TEXT,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViabilityAnalysis" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "cnpj" TEXT,
    "regime" TEXT,
    "sector" TEXT,
    "annualRevenue" DOUBLE PRECISION,
    "docsUploaded" INTEGER NOT NULL DEFAULT 0,
    "docsText" TEXT,
    "viabilityScore" INTEGER,
    "scoreLabel" TEXT,
    "estimatedCredit" DOUBLE PRECISION,
    "opportunities" TEXT,
    "aiSummary" TEXT,
    "risks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedToContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViabilityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvite" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientName" TEXT,
    "companyName" TEXT NOT NULL,
    "cnpj" TEXT,
    "viabilityAnalysisId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "setupFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "setupFeePaidAt" TIMESTAMP(3),
    "partnerSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "platformSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "contractNumber" TEXT NOT NULL,
    "contractText" TEXT,
    "partnerSignedAt" TIMESTAMP(3),
    "clientSignedAt" TIMESTAMP(3),
    "partnerSignatureIp" TEXT,
    "clientSignatureIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRecovered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partnerEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE INDEX "Partner_email_idx" ON "Partner"("email");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "ViabilityAnalysis_partnerId_idx" ON "ViabilityAnalysis"("partnerId");

-- CreateIndex
CREATE INDEX "ViabilityAnalysis_status_idx" ON "ViabilityAnalysis"("status");

-- CreateIndex
CREATE INDEX "ViabilityAnalysis_viabilityScore_idx" ON "ViabilityAnalysis"("viabilityScore");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvite_inviteCode_key" ON "ClientInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "ClientInvite_inviteCode_idx" ON "ClientInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "ClientInvite_partnerId_idx" ON "ClientInvite"("partnerId");

-- CreateIndex
CREATE INDEX "ClientInvite_status_idx" ON "ClientInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_partnerId_idx" ON "Contract"("partnerId");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "User_invitedByPartnerId_idx" ON "User"("invitedByPartnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedByPartnerId_fkey" FOREIGN KEY ("invitedByPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViabilityAnalysis" ADD CONSTRAINT "ViabilityAnalysis_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvite" ADD CONSTRAINT "ClientInvite_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
