-- CreateEnum
CREATE TYPE "InventoryReviewStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "inventory_review" (
    "id" TEXT NOT NULL,
    "tutanak_no" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "review_date" DATE NOT NULL,
    "next_review_date" DATE NOT NULL,
    "hardware_count" INTEGER,
    "software_count" INTEGER,
    "information_count" INTEGER,
    "amac" TEXT NOT NULL,
    "kapsam" TEXT NOT NULL,
    "surec_tarihcesi" TEXT NOT NULL,
    "bulgular" TEXT NOT NULL,
    "sonuc_aksiyonlar" JSONB NOT NULL,
    "iliskili_dokuman_ids" TEXT[],
    "hazirlayan_id" TEXT NOT NULL,
    "hazirlayan_ad" TEXT NOT NULL,
    "hazirlayan_unvan" TEXT NOT NULL,
    "onaylayan_id" TEXT,
    "onaylayan_ad" TEXT,
    "onaylayan_unvan" TEXT,
    "hazirlanma_tarihi" TIMESTAMP(3),
    "onay_tarihi" TIMESTAMP(3),
    "durum" "InventoryReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_review_tutanak_no_key" ON "inventory_review"("tutanak_no");

-- CreateIndex
CREATE INDEX "inventory_review_durum_idx" ON "inventory_review"("durum");

-- CreateIndex
CREATE INDEX "inventory_review_review_date_idx" ON "inventory_review"("review_date" DESC);

-- AddForeignKey
ALTER TABLE "inventory_review" ADD CONSTRAINT "inventory_review_hazirlayan_id_fkey" FOREIGN KEY ("hazirlayan_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_review" ADD CONSTRAINT "inventory_review_onaylayan_id_fkey" FOREIGN KEY ("onaylayan_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
