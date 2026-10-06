-- Avans dönem kapatma kilidi — iki yeni tablo (additive, mevcut tabloya
-- dokunmaz, enum YOK → düz psql -f ile uygulanabilir, --single-transaction
-- kısıtı geçerli değil). PENDING: prod'a Melih uygulayacak.
--
--   AvansDonemKapanis    : "bu (yil,ay) kapalı mı" tek doğruluk kaynağı (@@unique)
--   AvansDonemKapanisLog : kapat/aç denetim geçmişi (açılışta satır silindiği
--                          için "kim açtı" burada kalıcı durur)

-- CreateTable
CREATE TABLE "AvansDonemKapanis" (
    "id" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "ay" INTEGER NOT NULL,
    "kapatanId" TEXT NOT NULL,
    "kapatmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    CONSTRAINT "AvansDonemKapanis_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AvansDonemKapanisLog" (
    "id" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "ay" INTEGER NOT NULL,
    "islem" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    CONSTRAINT "AvansDonemKapanisLog_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "idx_avans_donem_kapanis" ON "AvansDonemKapanis"("yil", "ay");
-- CreateIndex
CREATE UNIQUE INDEX "uq_avans_donem_kapanis" ON "AvansDonemKapanis"("yil", "ay");
-- CreateIndex
CREATE INDEX "idx_avans_donem_log" ON "AvansDonemKapanisLog"("yil", "ay");
-- AddForeignKey
ALTER TABLE "AvansDonemKapanis" ADD CONSTRAINT "AvansDonemKapanis_kapatanId_fkey" FOREIGN KEY ("kapatanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AvansDonemKapanisLog" ADD CONSTRAINT "AvansDonemKapanisLog_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
