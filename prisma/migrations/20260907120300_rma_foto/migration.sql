-- RMA/SMA kaydına çoklu fotoğraf. Dosyalar public/uploads/kalite/rma/<YYYY>/<MM>/
-- altına yazılır (paylaşımlı uploads symlink'i), servis /api/files/... üzerinden.
--
-- yukleyenId User'a FK DEĞİL: RmaKayit.olusturanId / guncelleyenId ile aynı audit
-- deseni (User FK/back-ref eklemez). rmaKayitId cascade — başlık silinince fotoğraf
-- kayıtları da düşer (disk dosyaları uygulama tarafında silinir).

-- CreateTable
CREATE TABLE "RmaFoto" (
    "id" TEXT NOT NULL,
    "rmaKayitId" TEXT NOT NULL,
    "dosyaYolu" TEXT NOT NULL,
    "dosyaAdi" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "yukleyenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RmaFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RmaFoto_rmaKayitId_idx" ON "RmaFoto"("rmaKayitId");

-- AddForeignKey
ALTER TABLE "RmaFoto" ADD CONSTRAINT "RmaFoto_rmaKayitId_fkey" FOREIGN KEY ("rmaKayitId") REFERENCES "RmaKayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
