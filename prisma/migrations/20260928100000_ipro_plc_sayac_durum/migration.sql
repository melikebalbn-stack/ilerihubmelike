-- Pin başına son mutlak sayaç değeri — poller restart/reconnect sonrası kayıpsız delta seed'i.
-- CreateTable
CREATE TABLE "ipro_plc_sayac_durum" (
    "pinId" TEXT NOT NULL,
    "sonDeger" BIGINT NOT NULL,
    "sonOkumaAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_plc_sayac_durum_pkey" PRIMARY KEY ("pinId")
);
