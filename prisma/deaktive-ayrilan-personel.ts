/**
 * Ayrılmış personelin açık kalan portal hesaplarını kapatır (CLI).
 *
 * Mantık src/lib/offboarding/deaktive-ayrilan.ts'te — gecelik cron ucu
 * (/api/cron/deaktive-ayrilan-personel) de aynı servisi çağırır; bu dosya
 * yalnız CLI kabuğudur (argüman ayrıştırma, DB kapısı, çıktı).
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/deaktive-ayrilan-personel.ts --db=ilerihub
 *   npx tsx --env-file=.env prisma/deaktive-ayrilan-personel.ts --db=ilerihub --apply
 *
 * Varsayılan DRY-RUN'dır; --apply verilmeden hiçbir yazma yapılmaz.
 * Yalnız isActive=false yazar — ROL SİLMEZ (hesap geri açılırsa yetki kaybı olmasın).
 */
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import {
  DEACTIVATION_ABORT_LIMIT,
  adayOzet,
  deaktiveAyrilanPersonel,
} from '../src/lib/offboarding/deaktive-ayrilan';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const DB_ARG = process.argv.find((a) => a.startsWith('--db='))?.slice('--db='.length);

async function main() {
  // ── DB kapısı: --db zorunlu, bağlanılan veritabanıyla birebir eşleşmeli ──
  if (!DB_ARG) {
    console.error('❌ --db=<veritabani_adi> zorunlu. Örn: --db=ilerihub');
    process.exit(1);
  }
  const [{ current_database: bagliDb }] =
    await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (bagliDb !== DB_ARG) {
    console.error(`❌ DB kapısı: --db=${DB_ARG} verildi ama bağlı veritabanı "${bagliDb}". İptal.`);
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log(`Ayrılan personel hesap kapatma — ${APPLY ? '⚠️  APPLY (YAZAR)' : 'DRY-RUN (yazma yok)'}`);
  console.log(`Veritabanı: ${bagliDb}`);
  console.log('═'.repeat(70));

  const sonuc = await deaktiveAyrilanPersonel(prisma, { dryRun: !APPLY });

  console.log(`\nBulunan: ${sonuc.bulundu} hesap\n`);

  if (sonuc.abortedLimit) {
    console.error(
      `❌ GÜVENLİK AĞI: ${sonuc.hedefler.length} hesap kapatılacaktı ` +
        `(limit ${DEACTIVATION_ABORT_LIMIT}) — HİÇBİRİ kapatılmadı.`,
    );
    console.error('   Muhtemel hatalı toplu pasifleştirme. Liste:');
    for (const a of sonuc.hedefler) console.error(`   - ${adayOzet(a)}`);
    process.exit(1);
  }

  for (const a of sonuc.hedefler) {
    console.log(adayOzet(a));
    console.log(APPLY ? '   ✅ kapatıldı (isActive=false, roller korundu)' : '   → kapatılacak (dry-run, yazma yok)');
    console.log('');
  }

  for (const a of sonuc.atlananlar) {
    console.log(adayOzet(a));
    console.log('   ⚠️  ATLANDI — ayrılma SONRASI giriş var, elle karar gerekiyor');
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log(
    `ÖZET  bulundu: ${sonuc.bulundu}  |  ${APPLY ? 'güncellendi' : 'kapatılacak'}: ` +
      `${APPLY ? sonuc.kapatildi : sonuc.hedefler.length}  |  atlandı: ${sonuc.atlananlar.length}`,
  );
  if (sonuc.atlananlar.length) {
    console.log('\nElle karar gerekenler (ayrılma sonrası giriş):');
    for (const a of sonuc.atlananlar) console.log(`  - ${adayOzet(a)}`);
  }
  if (!APPLY) console.log('\nDRY-RUN — hiçbir yazma yapılmadı. Uygulamak için: --apply');
  console.log('═'.repeat(70));
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
