-- Syteline → IFS değer çevirici (feat/syteline-cevirici)
CREATE TABLE "syte_esleme" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "kaynakDeger" TEXT NOT NULL,
    "hedefDeger" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "syte_esleme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "syte_esleme_entity_tip_kaynakDeger_key" ON "syte_esleme"("entity", "tip", "kaynakDeger");
