-- IV-FR-03 · TUTANAK FORMU (08.10.2026) — ADDITIVE.
-- Yeni tablolar + yeni enum'lar; MEVCUT tablolara dokunulmaz, veri taşınmaz.
-- Modül yayın kapısı GIZLI olarak başlar (son blok).

CREATE TYPE "TutanakSebep" AS ENUM ('ISG_KURALLARINA_UYMAMA', 'DISIPLIN', 'HATALI_ISLEM_URETIM', 'DEVAMSIZLIK');
CREATE TYPE "TutanakDurum" AS ENUM ('TASLAK', 'SAHIT_BEKLIYOR', 'YONETICI_BEKLIYOR', 'IK_BEKLIYOR', 'TAMAMLANDI', 'REDDEDILDI');
CREATE TYPE "TutanakSahitDurum" AS ENUM ('BEKLIYOR', 'ONAYLADI', 'REDDETTI');
CREATE TYPE "TutanakKarar" AS ENUM ('ONAYLADI', 'REDDETTI');
CREATE TYPE "TutanakAcanRol" AS ENUM ('MUDUR', 'MUDUR_YRD', 'IV');
CREATE TYPE "TutanakGecmisAdim" AS ENUM ('OLUSTURULDU', 'GONDERILDI', 'SAHIT_ONAYLADI', 'SAHIT_REDDETTI', 'YONETICI_ONAYLADI', 'YONETICI_REDDETTI', 'SON_YONETICI_BILGILENDIRILDI', 'IV_KAPATTI');

CREATE TABLE "tutanak" (
    "id" TEXT NOT NULL,
    "tutanakNo" TEXT NOT NULL,
    "tutanakTarihi" DATE NOT NULL,
    "personnelId" TEXT NOT NULL,
    "bolumSnapshot" TEXT NOT NULL,
    "gorevSnapshot" TEXT,
    "sicilSnapshot" TEXT,
    "adSoyadSnapshot" TEXT NOT NULL,
    "sebep" "TutanakSebep" NOT NULL,
    "aciklama" TEXT NOT NULL,
    "yoneticiId" TEXT NOT NULL,
    "yoneticiKademe" INTEGER NOT NULL,
    "yoneticiKarar" "TutanakKarar",
    "yoneticiNot" TEXT,
    "yoneticiKararAt" TIMESTAMP(3),
    "bilgilendirilenSonYoneticiId" TEXT,
    "sonYoneticiBildirimAt" TIMESTAMP(3),
    "ivKapatanId" TEXT,
    "ivKapanisAt" TIMESTAMP(3),
    "ivNot" TEXT,
    "durum" "TutanakDurum" NOT NULL DEFAULT 'TASLAK',
    "gonderildiAt" TIMESTAMP(3),
    "redSebebi" TEXT,
    "acanUserId" TEXT NOT NULL,
    "acanPersonnelId" TEXT,
    "acanRol" "TutanakAcanRol" NOT NULL,
    "acanBolum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tutanak_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutanak_sahit" (
    "id" TEXT NOT NULL,
    "tutanakId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "bolumSnapshot" TEXT NOT NULL,
    "durum" "TutanakSahitDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "not" TEXT,
    "kararAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tutanak_sahit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutanak_gecmis" (
    "id" TEXT NOT NULL,
    "tutanakId" TEXT NOT NULL,
    "adim" "TutanakGecmisAdim" NOT NULL,
    "aktorId" TEXT,
    "aktorAd" TEXT NOT NULL,
    "not" TEXT,
    "oncekiDurum" "TutanakDurum",
    "yeniDurum" "TutanakDurum",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tutanak_gecmis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tutanak_tutanakNo_key" ON "tutanak"("tutanakNo");
CREATE INDEX "tutanak_durum_idx" ON "tutanak"("durum");
CREATE INDEX "tutanak_personnelId_idx" ON "tutanak"("personnelId");
CREATE INDEX "tutanak_acanUserId_idx" ON "tutanak"("acanUserId");
CREATE INDEX "tutanak_yoneticiId_idx" ON "tutanak"("yoneticiId");
CREATE INDEX "tutanak_bolumSnapshot_idx" ON "tutanak"("bolumSnapshot");
CREATE INDEX "tutanak_sebep_idx" ON "tutanak"("sebep");

CREATE UNIQUE INDEX "tutanak_sahit_tutanakId_personnelId_key" ON "tutanak_sahit"("tutanakId", "personnelId");
CREATE INDEX "tutanak_sahit_personnelId_idx" ON "tutanak_sahit"("personnelId");

CREATE INDEX "tutanak_gecmis_tutanakId_createdAt_idx" ON "tutanak_gecmis"("tutanakId", "createdAt");

-- Personel/yönetici kayıtları RESTRICT: tutanağı olan personel silinemez (kanıt kaybı).
ALTER TABLE "tutanak" ADD CONSTRAINT "tutanak_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tutanak" ADD CONSTRAINT "tutanak_yoneticiId_fkey" FOREIGN KEY ("yoneticiId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tutanak" ADD CONSTRAINT "tutanak_bilgilendirilenSonYoneticiId_fkey" FOREIGN KEY ("bilgilendirilenSonYoneticiId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tutanak" ADD CONSTRAINT "tutanak_acanUserId_fkey" FOREIGN KEY ("acanUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutanak_sahit" ADD CONSTRAINT "tutanak_sahit_tutanakId_fkey" FOREIGN KEY ("tutanakId") REFERENCES "tutanak"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutanak_sahit" ADD CONSTRAINT "tutanak_sahit_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutanak_gecmis" ADD CONSTRAINT "tutanak_gecmis_tutanakId_fkey" FOREIGN KEY ("tutanakId") REFERENCES "tutanak"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tutanak_gecmis" ADD CONSTRAINT "tutanak_gecmis_aktorId_fkey" FOREIGN KEY ("aktorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Modül yayın kapısı: GIZLI (yalnız SUPER_ADMIN görür). Satır varsa dokunulmaz.
INSERT INTO "SystemSetting" ("id", "key", "value", "category", "updatedAt")
VALUES (gen_random_uuid()::text, 'modul_durum_tutanak', 'GIZLI', 'modul', NOW())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "SystemSetting" ("id", "key", "value", "category", "updatedAt")
VALUES (gen_random_uuid()::text, 'modul_pilot_tutanak', '', 'modul', NOW())
ON CONFLICT ("key") DO NOTHING;
