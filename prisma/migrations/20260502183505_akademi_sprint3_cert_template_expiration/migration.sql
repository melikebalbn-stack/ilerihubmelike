-- AkademiCertificate: validUntil eklendi (null = sınırsız)
ALTER TABLE "akademi_certificates" ADD COLUMN "validUntil" TIMESTAMP(3);

-- AkademiCertificateTemplate: tasarım + geçerlilik alanları eklendi
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "description" TEXT;
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "logoPath" TEXT;
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#0d2659';
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#b38c26';
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "defaultValidityMonths" INTEGER;
ALTER TABLE "akademi_certificate_templates" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
