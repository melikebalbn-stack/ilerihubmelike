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
  console.log("=== User-Personnel Link Verification ===\n");

  const total = await prisma.user.count();
  const linked = await prisma.user.count({ where: { personnelId: { not: null } } });
  const unlinked = total - linked;

  console.log(`Toplam user: ${total}`);
  console.log(`Bağlı:       ${linked}`);
  console.log(`Bağlı değil: ${unlinked}\n`);

  const linkedWithBolum = await prisma.user.findMany({
    where: { personnelId: { not: null } },
    select: {
      id: true,
      name: true,
      personnel: { select: { bolum: true } },
    },
  });

  const bolumCounts = new Map<string, number>();
  linkedWithBolum.forEach((u) => {
    const bolum = u.personnel?.bolum ?? "(bolum NULL)";
    bolumCounts.set(bolum, (bolumCounts.get(bolum) ?? 0) + 1);
  });

  console.log(`Bolum dağılımı (bağlı ${linkedWithBolum.length} user):`);
  [...bolumCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .forEach(([b, c]) => console.log(`  ${b.padEnd(40)} ${c}`));

  const unlinkedSample = await prisma.user.findMany({
    where: { personnelId: null },
    select: { id: true, name: true, email: true, employeeId: true },
    take: 20,
  });

  console.log(`\nBağlı değil (örnek 20):`);
  unlinkedSample.forEach((u) =>
    console.log(
      `  ${u.id.padEnd(30)} ${(u.name ?? "").padEnd(30)} eid=${u.employeeId ?? "-"}`
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
