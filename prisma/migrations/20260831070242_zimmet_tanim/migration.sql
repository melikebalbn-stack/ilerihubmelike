-- NOT: ZimmetYazilim tablosu (bir önceki PENDING migration) hiçbir zaman
-- gerçek DB'ye uygulanmadi (PENDING_zimmet_yazilim klasörü Melih Bey'e teslim
-- edilmeden bu tanımla değiştirildi) - bu yüzden burada DROP TABLE
-- "ZimmetYazilim" YOK, çünkü tablo hedef DB'de hiç var olmadı.

-- CreateTable
CREATE TABLE "ZimmetTanim" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "parentId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZimmetTanim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_zimmet_tanim_ad_parent" ON "ZimmetTanim"("ad", "parentId");

-- AddForeignKey
ALTER TABLE "ZimmetTanim" ADD CONSTRAINT "ZimmetTanim_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ZimmetTanim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
