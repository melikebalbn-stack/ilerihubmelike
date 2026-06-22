-- CreateTable
CREATE TABLE "ldap_group_role_map" (
    "id" TEXT NOT NULL,
    "group_cn" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldap_group_role_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ldap_group_role_map_group_cn_key" ON "ldap_group_role_map"("group_cn");

-- CreateIndex
CREATE INDEX "ldap_group_role_map_role_id_idx" ON "ldap_group_role_map"("role_id");

-- AddForeignKey
ALTER TABLE "ldap_group_role_map" ADD CONSTRAINT "ldap_group_role_map_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
