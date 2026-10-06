-- CreateTable
CREATE TABLE "ifs_key_users" (
    "id" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "atayanId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifs_key_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ifs_key_users_bolum_idx" ON "ifs_key_users"("bolum");

-- CreateIndex
CREATE INDEX "ifs_key_users_userId_idx" ON "ifs_key_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_key_users_bolum_userId_key" ON "ifs_key_users"("bolum", "userId");

-- AddForeignKey
ALTER TABLE "ifs_key_users" ADD CONSTRAINT "ifs_key_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

