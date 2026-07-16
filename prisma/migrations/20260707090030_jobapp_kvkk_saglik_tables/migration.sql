-- CreateTable
CREATE TABLE "JobApplicationConsent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "tcKimlikNo" TEXT NOT NULL,
    "documentCode" TEXT NOT NULL DEFAULT 'IK-T-866',
    "documentRev" TEXT NOT NULL DEFAULT '00',
    "consentTextHash" TEXT,
    "signatureImage" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplicationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicationHealth" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "gecmisHastalikNotu" TEXT,
    "ameliyatOlduMu" BOOLEAN,
    "ameliyatNotu" TEXT,
    "astimSoru1" BOOLEAN,
    "astimSoru1_1" BOOLEAN,
    "astimSoru1_2" BOOLEAN,
    "astimSoru2" BOOLEAN,
    "astimSoru3" BOOLEAN,
    "astimSoru4" BOOLEAN,
    "astimSoru5" BOOLEAN,
    "astimSoru6" BOOLEAN,
    "astimSoru7" BOOLEAN,
    "dogumTarihi" DATE,
    "testTarihi" DATE,
    "cinsiyet" TEXT,
    "telefonGunduz" TEXT,
    "telefonGece" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplicationHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicationHealthItem" (
    "id" TEXT NOT NULL,
    "healthId" TEXT NOT NULL,
    "itemNo" INTEGER NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "deger" BOOLEAN NOT NULL,

    CONSTRAINT "JobApplicationHealthItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationConsent_applicationId_key" ON "JobApplicationConsent"("applicationId");

-- CreateIndex
CREATE INDEX "JobApplicationConsent_tcKimlikNo_idx" ON "JobApplicationConsent"("tcKimlikNo");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationHealth_applicationId_key" ON "JobApplicationHealth"("applicationId");

-- CreateIndex
CREATE INDEX "JobApplicationHealthItem_healthId_idx" ON "JobApplicationHealthItem"("healthId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationHealthItem_healthId_itemNo_key" ON "JobApplicationHealthItem"("healthId", "itemNo");

-- AddForeignKey
ALTER TABLE "JobApplicationConsent" ADD CONSTRAINT "JobApplicationConsent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PublicJobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationHealth" ADD CONSTRAINT "JobApplicationHealth_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PublicJobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationHealthItem" ADD CONSTRAINT "JobApplicationHealthItem_healthId_fkey" FOREIGN KEY ("healthId") REFERENCES "JobApplicationHealth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
