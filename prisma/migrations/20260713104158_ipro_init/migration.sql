-- CreateTable
CREATE TABLE "ipro_plc" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "rack" INTEGER NOT NULL DEFAULT 0,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_plc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_plc_pin" (
    "id" TEXT NOT NULL,
    "kod" INTEGER NOT NULL,
    "plcId" TEXT NOT NULL,
    "inputPin" TEXT NOT NULL,
    "sayacAdresi" INTEGER NOT NULL,
    "resetAdresi" INTEGER NOT NULL,
    "durusAdresi" INTEGER NOT NULL,
    "sayacTipi" TEXT NOT NULL DEFAULT 'CTCounter',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "tezgahId" TEXT,

    CONSTRAINT "ipro_plc_pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_tezgah" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "ifsWorkCenterNo" TEXT,
    "masGrupKodu" TEXT,
    "masGrupAdi" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_tezgah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_durus_tipi" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "teepOrder" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_durus_tipi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_durus_sebebi" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "erpKodu" TEXT,
    "tipId" TEXT,
    "bitisTipi" TEXT NOT NULL,
    "renkKodu" TEXT,
    "temelSebep" TEXT,
    "planli" BOOLEAN NOT NULL DEFAULT false,
    "uretimDisi" BOOLEAN NOT NULL DEFAULT false,
    "setupDurusu" BOOLEAN NOT NULL DEFAULT false,
    "plcKilitle" BOOLEAN NOT NULL DEFAULT false,
    "askiyaAl" BOOLEAN NOT NULL DEFAULT false,
    "makineKaynakli" BOOLEAN NOT NULL DEFAULT false,
    "operatorKaynakli" BOOLEAN NOT NULL DEFAULT false,
    "yetkiliOnayGerekli" BOOLEAN NOT NULL DEFAULT false,
    "durusAktifkenIsBitirilemez" BOOLEAN NOT NULL DEFAULT false,
    "uretimdeGosterilsin" BOOLEAN NOT NULL DEFAULT true,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_durus_sebebi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_durus_tezgah" (
    "id" TEXT NOT NULL,
    "durusSebebiId" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "sikKullanilan" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ipro_durus_tezgah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_hurda_sebebi" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "erpKodu" TEXT,
    "grupKodu" TEXT,
    "grubu" TEXT,
    "uretimHurdaRework" BOOLEAN NOT NULL DEFAULT false,
    "rework" BOOLEAN NOT NULL DEFAULT false,
    "hurda" BOOLEAN NOT NULL DEFAULT true,
    "bilesenHurdaRework" BOOLEAN NOT NULL DEFAULT false,
    "oeeEtkiler" BOOLEAN NOT NULL DEFAULT true,
    "yorumZorunlu" BOOLEAN NOT NULL DEFAULT false,
    "sinyalsizGiris" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_hurda_sebebi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_hurda_tezgah" (
    "id" TEXT NOT NULL,
    "hurdaSebebiId" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,

    CONSTRAINT "ipro_hurda_tezgah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_operator_tezgah" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "kaynak" TEXT NOT NULL DEFAULT 'MAS_IMPORT',
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ipro_operator_tezgah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_operator_session" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "girisAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cikisAt" TIMESTAMP(3),

    CONSTRAINT "ipro_operator_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_production_log" (
    "id" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "ifsOperationId" TEXT,
    "ifsOrderNo" TEXT,
    "ifsOperationNo" INTEGER,
    "qtyComplete" INTEGER NOT NULL DEFAULT 0,
    "qtyScrap" INTEGER NOT NULL DEFAULT 0,
    "hurdaSebebiKod" TEXT,
    "plcSayacBaslangic" INTEGER,
    "plcSayacBitis" INTEGER,
    "ifsYazildi" BOOLEAN NOT NULL DEFAULT false,
    "ifsHata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipro_production_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_machine_downtime" (
    "id" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "durusSebebiId" TEXT,
    "personnelId" TEXT,
    "baslangic" TIMESTAMP(3) NOT NULL,
    "bitis" TIMESTAMP(3),
    "kaynak" TEXT NOT NULL DEFAULT 'PLC',
    "yorum" TEXT,

    CONSTRAINT "ipro_machine_downtime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ipro_plc_kod_key" ON "ipro_plc"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_plc_pin_kod_key" ON "ipro_plc_pin"("kod");

-- CreateIndex
CREATE INDEX "ipro_plc_pin_tezgahId_idx" ON "ipro_plc_pin"("tezgahId");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_plc_pin_plcId_sayacAdresi_key" ON "ipro_plc_pin"("plcId", "sayacAdresi");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_tezgah_kod_key" ON "ipro_tezgah"("kod");

-- CreateIndex
CREATE INDEX "ipro_tezgah_ifsWorkCenterNo_idx" ON "ipro_tezgah"("ifsWorkCenterNo");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_durus_tipi_kod_key" ON "ipro_durus_tipi"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_durus_sebebi_kod_key" ON "ipro_durus_sebebi"("kod");

-- CreateIndex
CREATE INDEX "ipro_durus_tezgah_tezgahId_sikKullanilan_idx" ON "ipro_durus_tezgah"("tezgahId", "sikKullanilan");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_durus_tezgah_durusSebebiId_tezgahId_key" ON "ipro_durus_tezgah"("durusSebebiId", "tezgahId");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_hurda_sebebi_kod_key" ON "ipro_hurda_sebebi"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_hurda_tezgah_hurdaSebebiId_tezgahId_key" ON "ipro_hurda_tezgah"("hurdaSebebiId", "tezgahId");

-- CreateIndex
CREATE INDEX "ipro_operator_tezgah_personnelId_idx" ON "ipro_operator_tezgah"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_operator_tezgah_personnelId_tezgahId_key" ON "ipro_operator_tezgah"("personnelId", "tezgahId");

-- CreateIndex
CREATE INDEX "ipro_operator_session_tezgahId_cikisAt_idx" ON "ipro_operator_session"("tezgahId", "cikisAt");

-- CreateIndex
CREATE INDEX "ipro_production_log_tezgahId_createdAt_idx" ON "ipro_production_log"("tezgahId", "createdAt");

-- CreateIndex
CREATE INDEX "ipro_production_log_ifsYazildi_idx" ON "ipro_production_log"("ifsYazildi");

-- CreateIndex
CREATE INDEX "ipro_machine_downtime_tezgahId_bitis_idx" ON "ipro_machine_downtime"("tezgahId", "bitis");

-- AddForeignKey
ALTER TABLE "ipro_plc_pin" ADD CONSTRAINT "ipro_plc_pin_plcId_fkey" FOREIGN KEY ("plcId") REFERENCES "ipro_plc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_plc_pin" ADD CONSTRAINT "ipro_plc_pin_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_durus_sebebi" ADD CONSTRAINT "ipro_durus_sebebi_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ipro_durus_tipi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_durus_tezgah" ADD CONSTRAINT "ipro_durus_tezgah_durusSebebiId_fkey" FOREIGN KEY ("durusSebebiId") REFERENCES "ipro_durus_sebebi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_durus_tezgah" ADD CONSTRAINT "ipro_durus_tezgah_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_hurda_tezgah" ADD CONSTRAINT "ipro_hurda_tezgah_hurdaSebebiId_fkey" FOREIGN KEY ("hurdaSebebiId") REFERENCES "ipro_hurda_sebebi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_hurda_tezgah" ADD CONSTRAINT "ipro_hurda_tezgah_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_operator_tezgah" ADD CONSTRAINT "ipro_operator_tezgah_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_operator_session" ADD CONSTRAINT "ipro_operator_session_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_production_log" ADD CONSTRAINT "ipro_production_log_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_machine_downtime" ADD CONSTRAINT "ipro_machine_downtime_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipro_machine_downtime" ADD CONSTRAINT "ipro_machine_downtime_durusSebebiId_fkey" FOREIGN KEY ("durusSebebiId") REFERENCES "ipro_durus_sebebi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

