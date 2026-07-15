/**
 * Mesai Performans FAZ 1 — OvertimeForm.periodStart/periodEnd backfill.
 *
 * Kural (keşifte kanıtlandı — vardiya-hafta sabit 5 gece, Pzt-Cuma):
 *   vardiyaHaftaMi=false → periodStart = periodEnd = date        (tek gün)
 *   vardiyaHaftaMi=true  → periodStart = date (Pzt),
 *                          periodEnd   = date + 4 gün (Cum)       (5 günlük dönem)
 *
 * VARSAYILAN: DRY-RUN (yazmaz). Yazmak için --commit (migration UYGULANDIKTAN sonra).
 * İdempotent: update mevcut satırı hesaplanan değerle YENİDEN yazar (mükerrer yok).
 *
 * ⚠ Bu script yeni kolonları (periodStart/periodEnd) SELECT ETMEZ; yalnız {id,date,
 *   vardiyaHaftaMi} okur → migration uygulanmadan da DRY-RUN çalışır. --commit ise
 *   periodStart/periodEnd YAZAR → yalnız migration uygulandıktan sonra çalıştırılmalı.
 *
 * Kullanım:
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-staging/.env scripts/backfill-overtime-period.ts
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-staging/.env scripts/backfill-overtime-period.ts --commit
 */
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const COMMIT = process.argv.includes('--commit');
const TAG = COMMIT ? '[COMMIT ]' : '[DRY-RUN]';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** @db.Date değerine (UTC gün başı) n gün ekle — DST'siz, gün-bazlı. */
function addDaysUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}
/** date'i UTC gün başına normalize et (periodStart için). */
function dayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log(`${TAG} DB: ${(process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@')}`);

  // ⚠ Explicit select — yeni kolonları OKUMAZ, migration'sız da çalışır.
  const forms = await prisma.overtimeForm.findMany({
    select: { id: true, date: true, vardiyaHaftaMi: true },
  });

  let vardiyaHafta = 0;
  const plan = forms.map((f) => {
    const start = dayUTC(f.date);
    const end = f.vardiyaHaftaMi ? addDaysUTC(f.date, 4) : dayUTC(f.date);
    if (f.vardiyaHaftaMi) vardiyaHafta++;
    return { id: f.id, start, end, vardiya: f.vardiyaHaftaMi };
  });

  console.log(`\n── BACKFILL PLANI ──`);
  console.log(`  Toplam OvertimeForm      : ${forms.length}`);
  console.log(`  vardiyaHaftaMi=false     : ${forms.length - vardiyaHafta}  (periodStart=periodEnd=date)`);
  console.log(`  vardiyaHaftaMi=true      : ${vardiyaHafta}  (periodStart=Pzt, periodEnd=Pzt+4=Cum)`);
  if (vardiyaHafta > 0) {
    console.log(`  Vardiya-hafta örnekleri:`);
    for (const p of plan.filter((x) => x.vardiya).slice(0, 5)) {
      console.log(`     ${p.id}: ${iso(p.start)} → ${iso(p.end)}`);
    }
  }

  // BAKIMHANE DepartmentDefinition (uretimYapar=false yapılacak — AYRI adım, Melih onayı).
  // Explicit select {id,name} — uretimYapar kolonunu OKUMAZ (migration'sız çalışır).
  const bakim = await prisma.departmentDefinition.findMany({
    where: { OR: [{ name: { contains: 'bakım', mode: 'insensitive' } }, { name: { contains: 'bakim', mode: 'insensitive' } }] },
    select: { id: true, name: true },
  });
  console.log(`\n── BAKIMHANE (uretimYapar=false yapılacak — AYRI adım) ──`);
  for (const b of bakim) console.log(`  ${b.id}  ${b.name}`);
  if (bakim.length === 0) console.log('  (bulunamadı)');

  if (!COMMIT) {
    console.log(`\n${TAG} Veri YAZILMADI. Migration UYGULANDIKTAN sonra --commit ile çalıştır.\n`);
    return;
  }

  // ── COMMIT: periodStart/periodEnd yaz (yeni kolonlar → migration uygulanmış OLMALI) ──
  let written = 0;
  for (const p of plan) {
    await prisma.overtimeForm.update({
      where: { id: p.id },
      data: { periodStart: p.start, periodEnd: p.end },
    });
    written++;
  }
  console.log(`\n${TAG} Yazıldı: ${written} form (periodStart/periodEnd).`);

  // Doğrulama: null kalan var mı?
  const nullKalan = await prisma.overtimeForm.count({ where: { OR: [{ periodStart: null }, { periodEnd: null }] } });
  console.log(`  Doğrulama: periodStart/periodEnd null kalan = ${nullKalan} (0 olmalı)\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
