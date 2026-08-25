/**
 * Ayrılmış personelin açık kalan portal hesaplarını kapatır.
 *
 * Neden: ilişik kesme (offboarding) akışı User.isActive'e dokunmuyor; kod
 * tabanında hesabı kapatan tek yol src/lib/ldap-sync.ts (AD-disabled debounce).
 * Mavi yaka hesaplarının AD karşılığı olmadığı için o yol onları hiç kapatmıyor.
 *
 * Hedef SORGUYLA bulunur (sabit liste değil): Personnel.aktif=false + User.isActive=true.
 * Böylece tekrar koşturulduğunda yeni düşenleri de yakalar; idempotenttir —
 * kapatılan kayıt bir sonraki turda sorguya girmez.
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

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const DB_ARG = process.argv.find((a) => a.startsWith('--db='))?.slice('--db='.length);

type Aday = {
  userId: string;
  email: string;
  adSoyad: string;
  sicilNo: string | null;
  roller: string[];
  sonGiris: Date | null;
  pasiflestirme: Date;
};

function sicil(s: string | null): string {
  return s ?? '(sicil yok)';
}

function tarih(d: Date | null): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—';
}

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

  // ── Hedefler: personel pasif, portal hesabı hâlâ açık ──
  const kayitlar = await prisma.user.findMany({
    where: { isActive: true, personnel: { aktif: false } },
    select: {
      id: true,
      email: true,
      lastLoginAt: true,
      personnel: { select: { sicilNo: true, adSoyad: true, updatedAt: true } },
      userRoles: { select: { role: { select: { slug: true } } } },
    },
  });

  const adaylar: Aday[] = kayitlar
    .filter((u) => u.personnel !== null)
    .map((u) => ({
      userId: u.id,
      email: u.email,
      adSoyad: u.personnel!.adSoyad,
      sicilNo: u.personnel!.sicilNo,
      roller: u.userRoles.map((ur) => ur.role.slug).sort(),
      sonGiris: u.lastLoginAt,
      // Personnel'de ayrılma tarihi sütunu yok; pasifleştirme anı için tek vekil updatedAt.
      pasiflestirme: u.personnel!.updatedAt,
    }))
    .sort((a, b) => b.pasiflestirme.getTime() - a.pasiflestirme.getTime());

  console.log(`\nBulunan: ${adaylar.length} hesap\n`);

  let guncellendi = 0;
  const atlananlar: Aday[] = [];

  for (const a of adaylar) {
    // Ayrılma SONRASI giriş varsa dokunma — elle karar gerektirir (ayrılma tarihi
    // yanlış girilmiş ya da kişi hâlâ çalışıyor olabilir).
    const ayrilmaSonrasiGiris = a.sonGiris !== null && a.sonGiris > a.pasiflestirme;

    console.log(`${sicil(a.sicilNo)}  ${a.adSoyad}`);
    console.log(`   e-posta      : ${a.email}`);
    console.log(`   roller       : ${a.roller.length ? a.roller.join(', ') : '(rol yok)'}`);
    console.log(`   son giriş    : ${tarih(a.sonGiris)}`);
    console.log(`   pasifleştirme: ${tarih(a.pasiflestirme)}`);

    if (ayrilmaSonrasiGiris) {
      atlananlar.push(a);
      console.log('   ⚠️  ATLANDI — ayrılma SONRASI giriş var, elle karar gerekiyor');
      console.log('');
      continue;
    }

    if (APPLY) {
      // Yalnız isActive; rol bağları korunuyor.
      await prisma.user.update({ where: { id: a.userId }, data: { isActive: false } });
      guncellendi++;
      console.log('   ✅ kapatıldı (isActive=false, roller korundu)');
    } else {
      console.log('   → kapatılacak (dry-run, yazma yok)');
    }
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log(`ÖZET  bulundu: ${adaylar.length}  |  ${APPLY ? 'güncellendi' : 'kapatılacak'}: ${APPLY ? guncellendi : adaylar.length - atlananlar.length}  |  atlandı: ${atlananlar.length}`);
  if (atlananlar.length) {
    console.log('\nElle karar gerekenler (ayrılma sonrası giriş):');
    for (const a of atlananlar) console.log(`  - ${sicil(a.sicilNo)} ${a.adSoyad} <${a.email}> son giriş ${tarih(a.sonGiris)}`);
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
