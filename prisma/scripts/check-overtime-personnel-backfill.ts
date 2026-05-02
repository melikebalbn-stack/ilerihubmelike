import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const legacy = await prisma.overtimePersonnel.findMany({
    where: { personnelId: null, userId: { not: null } },
    select: { id: true, userId: true, overtimeFormId: true },
  });

  console.log(`\n[CHECK] Legacy kayıt sayısı: ${legacy.length}`);
  if (legacy.length === 0) {
    console.log("[CHECK] Backfill yapılacak kayıt yok — sıfır iş.");
    return;
  }

  const report: Array<{
    overtimePersonnelId: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    resolvedPersonnelId: string | null;
    personnelName: string | null;
    sicilNo: string | null;
    durum: "OK" | "USER_UNLINKED";
  }> = [];

  for (const row of legacy) {
    const user = await prisma.user.findUnique({
      where: { id: row.userId! },
      select: {
        id: true,
        name: true,
        email: true,
        personnelId: true,
        personnel: { select: { id: true, adSoyad: true, sicilNo: true } },
      },
    });

    report.push({
      overtimePersonnelId: row.id,
      userId: row.userId!,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      resolvedPersonnelId: user?.personnelId ?? null,
      personnelName: user?.personnel?.adSoyad ?? null,
      sicilNo: user?.personnel?.sicilNo ?? null,
      durum: user?.personnelId ? "OK" : "USER_UNLINKED",
    });
  }

  console.log("\n[REPORT]");
  console.table(report);

  const unlinked = report.filter((r) => r.durum === "USER_UNLINKED");
  if (unlinked.length > 0) {
    console.error(
      `\n[ABORT] ${unlinked.length} kayıt User.personnelId üzerinden çözülemiyor.`
    );
    console.error("Önce şu User'ları Personnel'a bağla, sonra backfill yap:");
    unlinked.forEach((u) =>
      console.error(`  - User ${u.userId} (${u.userName} / ${u.userEmail})`)
    );
    process.exit(1);
  }

  console.log(`\n[OK] ${report.length} kayıt çözülebilir, backfill güvenli.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
