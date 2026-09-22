-- CreateTable
CREATE TABLE "AvansTalebiGeriCekmeLog" (
    "id" TEXT NOT NULL,
    "avansTalebiId" TEXT NOT NULL,
    "islem" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvansTalebiGeriCekmeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_avans_gericekme_log" ON "AvansTalebiGeriCekmeLog"("avansTalebiId");

-- AddForeignKey
ALTER TABLE "AvansTalebiGeriCekmeLog" ADD CONSTRAINT "AvansTalebiGeriCekmeLog_avansTalebiId_fkey" FOREIGN KEY ("avansTalebiId") REFERENCES "AvansTalebi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvansTalebiGeriCekmeLog" ADD CONSTRAINT "AvansTalebiGeriCekmeLog_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
