/**
 * Kaynak enum → sözlük GÖÇÜ (idempotent, dry-run öncelikli).
 * 1) ReferralSourceDef seed (5 kayıt, Türkçe ad). 2) Mevcut başvuruların referralSource
 *    enum değerini karşılık gelen sözlük kaydına bağla (referralSourceId doldur).
 * NULL enum → NULL kalır ("Belirtilmemiş"). Eski enum kolonuna DOKUNULMAZ.
 * Çalıştırma:  npx tsx scripts/migrate-referral-source.ts           (DRY-RUN)
 *              npx tsx scripts/migrate-referral-source.ts --commit   (uygula)
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const COMMIT = process.argv.includes("--commit");

// enum değeri → Türkçe sözlük adı + sıra
const ESLEME: { enum: string; ad: string; order: number }[] = [
  { enum: "AGENCY", ad: "Aracı Kurum", order: 1 },
  { enum: "ISKUR", ad: "İŞKUR", order: 2 },
  { enum: "WEBSITE", ad: "Web Sitesi", order: 3 },
  { enum: "REFERENCE", ad: "Referans", order: 4 },
  { enum: "OTHER", ad: "Diğer", order: 5 },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    console.log(`\n=== KAYNAK GÖÇÜ ${COMMIT ? "(COMMIT)" : "(DRY-RUN)"} ===`);

    // (1) Sözlük seed (idempotent — ada göre upsert)
    const adToId = new Map<string, string>();
    for (const e of ESLEME) {
      if (COMMIT) {
        const rec = await prisma.referralSourceDef.upsert({
          where: { name: e.ad }, create: { name: e.ad, order: e.order }, update: {},
        });
        adToId.set(e.ad, rec.id);
      }
    }
    console.log(`Sözlük kaydı: ${ESLEME.length} (Aracı Kurum, İŞKUR, Web Sitesi, Referans, Diğer)`);

    // (2) Başvuru göçü — enum dolu + referralSourceId boş olanlar
    let baglanacak = 0;
    const dagilim: Record<string, number> = {};
    for (const e of ESLEME) {
      const adet = await prisma.publicJobApplication.count({
        where: { referralSource: e.enum as never, referralSourceId: null },
      });
      if (adet > 0) { dagilim[e.ad] = adet; baglanacak += adet; }
      if (COMMIT && adet > 0) {
        await prisma.publicJobApplication.updateMany({
          where: { referralSource: e.enum as never, referralSourceId: null },
          data: { referralSourceId: adToId.get(e.ad)! },
        });
      }
    }
    const nullKalan = await prisma.publicJobApplication.count({ where: { referralSource: null } });

    console.log(`Bağlanacak (enum dolu): ${baglanacak} → ${JSON.stringify(dagilim)}`);
    console.log(`NULL kalan (Belirtilmemiş): ${nullKalan}`);
    console.log(COMMIT ? "UYGULANDI." : "DRY-RUN — yazılmadı. Uygulamak için --commit");
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
