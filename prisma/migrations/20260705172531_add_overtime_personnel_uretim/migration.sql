-- CreateTable
CREATE TABLE "OvertimePersonnelUretim" (
    "id" TEXT NOT NULL,
    "overtimePersonnelId" TEXT NOT NULL,
    "parcaKodu" TEXT NOT NULL,
    "mesaiNedeni" TEXT,
    "hedefAdet" INTEGER NOT NULL,
    "gerceklesenAdet" INTEGER,
    "gerceklesenNote" TEXT,
    "hurdaAdet" INTEGER,
    "sira" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OvertimePersonnelUretim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimePersonnelUretim_overtimePersonnelId_idx" ON "OvertimePersonnelUretim"("overtimePersonnelId");

-- AddForeignKey
ALTER TABLE "OvertimePersonnelUretim" ADD CONSTRAINT "OvertimePersonnelUretim_overtimePersonnelId_fkey" FOREIGN KEY ("overtimePersonnelId") REFERENCES "OvertimePersonnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
