/**
 * ============================================================================
 * SERVİS TANIM PAKETİ — yerleşke · firma · güzergâh · durak · araç · sefer dilimi
 * ============================================================================
 *
 * Prod'da bu tablolar BOŞ. Göç script'i (--apply) tanım verisi YARATMAZ,
 * yalnız `kod`/`plaka` ile arar; bu paket o boşluğu doldurur.
 *
 * 🔴 ŞOFÖR EKLENMEDİ — kişisel veri, git'e girmez (Elif kararı, 2026-09-29).
 * Güzergâh→araç ANA varsayılan ataması da BOŞ — bkz. servis-tanim-verisi.ts
 * GUZERGAH_ARAC_ANA_ATAMA yorumu (liste ayrıca gelecek, gelene kadar yazılmaz).
 *
 * 🔴 BOOTSTRAP-ONLY + IDEMPOTENT (emsal: prisma/seed-permissions.ts)
 * Her kayıt `kod` ile aranır: VARSA DOKUNULMAZ, yoksa oluşturulur.
 * İki kez koşarsa zarar vermez, mevcut kaydın adını/alanını EZMEZ.
 * Satır SİLMEZ — kodda karşılığı kalmayan kayıt uyarı olarak listelenir.
 *
 * 🔴 DURAK KODU tek kaynaktan: src/lib/servis-yonetimi/servis-durak-kodu.ts
 * Göç script'i de aynı fonksiyonu kullanır (Melih'in kuralı, bkz. o dosyanın
 * birleştirme notu).
 *
 * 🔴 YERLEŞKE PARAMETRE — yer tutucu GÖMÜLMEDİ. Verilmezse script DURUR
 * (dry-run dahil; ServisGuzergah.yerleskeId NOT NULL). Melih gerçek adı
 * İdari İşler'den alıyor.
 *   npx tsx prisma/seed-servis-tanim.ts \
 *     --db=<veritabani> \
 *     --yerleske-kod=<kod> --yerleske-ad="<ad>"
 *
 * 🔴 FİRMA VE ARAÇ YAZILMAZ. --firma-ad KALDIRILDI. Araç verisi (ARACLAR)
 * gerçek firma adı gelene kadar BOŞ; boşken ne araç ne firma sorgusu/yazımı
 * yapılır. Araç/firma adında "PLACEHOLDER" geçen veri DB'ye dokunmadan
 * hata verir.
 *
 * 🔴 TEK PLAN, İKİ MOD: dry-run ve apply AYNI planla() planını kullanır
 * (src/lib/servis-yonetimi/servis-tanim-seed-mantigi.ts). Plan, apply'da
 * oluşacak HER satırı varlık türüne göre sayar (yerleşke, firma, güzergâh,
 * durak, bağ, araç, sefer dilimi). Apply gerçek create sayısını plana
 * karşı doğrular; fark varsa hata verir.
 *
 * 🔴 --apply OLMADAN HİÇBİR ŞEY YAZMAZ (göç script'iyle aynı desen).
 *
 * KAYNAK: veri iki katmanlı (bkz. servis-tanim-verisi.ts):
 *   1. dev DB'den okunan yerleşmiş tanım verisi — 9 güzergâh, 106 durak
 *   2. İdari İşler eşleme tablosundan gelen yeni duraklar → toplam 138
 * 🔴 Yeni durakların SIRASI GERÇEK DEĞİL: güzergâhtaki fiziksel sırası
 * bilinmediği için mevcut max'tan devam ettirildi. Atama ve kapasite
 * sıradan bağımsız olduğu için FAZ 1+2 çekirdeği etkilenmiyor; yalnız
 * ekrandaki görünüm sırası yanlış. TODO(elif).
 *
 * 🔴 AÇIK 6 MADDE — İdari İşler'e soruldu, cevap BEKLENİYOR.
 * Aşağıda `TODO(idari-isler)` ile işaretli. Hiçbirine varsayılan
 * UYDURULMADI; cevap gelene kadar o satırlar bu dosyada YOK.
 *   1. GÜL PASTANESİ (2 kişi) ve KARAKOL (1) — cevapsız
 *   2. ŞEKERPINAR — sayfa 1 iki ad, sayfa 2 "tek durak" çelişkisi (5 kişi)
 *   3. MEZBAHANE — "FARKLI AD" yazılmış, anlaşılmadı (2 kişi)
 *   4. AKSE üçlüsü — kanonik ad hangisi (3 kişi)
 *   5. ERİŞ kümesi — 5 metin kaç durak (5 kişi)
 *   6. GÜNSAŞ FIRIN — ad teyidi (1 kişi)
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'
import {
  TUM_GUZERGAHLAR,
  TEYIT_BEKLIYOR,
  ARACLAR,
  SEFER_DILIMLERI,
  GUZERGAH_ARAC_ANA_ATAMA,
} from '../src/lib/servis-yonetimi/servis-tanim-verisi'
import {
  SAYIM_ANAHTARLARI,
  TanimHatasi,
  cliCoz,
  placeholderKontrol,
  planSayimi,
  planla,
  uygula,
  type TanimPrisma,
} from '../src/lib/servis-yonetimi/servis-tanim-seed-mantigi'

export * from '../src/lib/servis-yonetimi/servis-tanim-verisi'

// ----------------------------------------------------------------------------
// ANA AKIŞ
// ----------------------------------------------------------------------------

async function main() {
  // DB'ye dokunmadan ÖNCE: parametreler (yerleşke dahil, dry-run'da da) ve
  // araç/firma verisinde yer tutucu kontrolü.
  const { db, yerleskeKod, yerleskeAd, apply: APPLY } = cliCoz(process.argv.slice(2))
  placeholderKontrol(ARACLAR)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    // --- Güvenlik kapısı: yalnız beklenen DB (göç script'iyle aynı desen) ---
    const [{ current_database: gercekDb }] = await prisma.$queryRaw<{ current_database: string }[]>`
      SELECT current_database()
    `
    if (gercekDb !== db) {
      console.error(`❌ Bağlanılan veritabanı ("${gercekDb}") --db ile verilen ("${db}") ile UYUŞMUYOR. Durduruldu.`)
      process.exit(1)
    }
    console.log(`✅ Veritabanı doğrulandı: ${gercekDb}${APPLY ? ' — APPLY MODU' : ' — DRY-RUN'}\n`)

    // --- PLAN (yalnız okur; dry-run ve apply için ORTAK) ---------------------
    const tprisma = prisma as unknown as TanimPrisma
    const plan = await planla(tprisma, {
      yerleskeKod,
      yerleskeAd,
      guzergahlar: TUM_GUZERGAHLAR,
      araclar: ARACLAR,
      dilimler: SEFER_DILIMLERI,
    })
    const { olusturulacak, mevcut } = planSayimi(plan)

    console.log('═══ PLAN ═══')
    for (const k of SAYIM_ANAHTARLARI) {
      console.log(`  ${k.padEnd(10)} oluşturulacak: ${String(olusturulacak[k]).padStart(4)} · mevcut korundu: ${mevcut[k]}`)
    }

    if (APPLY) {
      const yazilan = await uygula(tprisma, plan)
      console.log('\n═══ UYGULANDI ═══')
      for (const k of SAYIM_ANAHTARLARI) console.log(`  ${k.padEnd(10)} yazılan: ${String(yazilan[k]).padStart(4)}`)
      const fark = SAYIM_ANAHTARLARI.filter((k) => yazilan[k] !== olusturulacak[k])
      if (fark.length > 0) {
        throw new Error(`Plan ile uygulama sayıları FARKLI: ${fark.join(', ')}`)
      }
    } else {
      console.log('\n(DRY-RUN — hiçbir şey yazılmadı. --apply ile gerçek yazım yapılır.)')
    }

    // 🔴 Güzergâh → araç ANA varsayılan ataması: Elif güzergah/plaka listesini
    // AYRICA iletecek (bkz. servis-tanim-verisi.ts). Liste gelene kadar BOŞ —
    // seed burada hiçbir create() ÇAĞIRMAZ, yalnız durumu raporlar.
    console.log(
      `\n(Güzergâh→araç ANA atama: ${GUZERGAH_ARAC_ANA_ATAMA.length} kayıt — liste bekleniyor, seed yazmadı.)`,
    )

    // 🔴 ServisDurak'ta not/açıklama alanı YOK (schema.prisma, migration
    // açılmadı) — bu liste DB'ye YAZILMAZ, yalnız burada, konsolda basılır.
    // Kalıcı takip TEYIT_BEKLIYOR sabitinde (servis-tanim-verisi.ts).
    console.log(`\n═══ TEYIT BEKLİYOR (${TEYIT_BEKLIYOR.length} madde — DB'ye yazılmadı, yalnız bu raporda) ═══`)
    for (const t of TEYIT_BEKLIYOR) {
      console.log(`  ${t.madde.padEnd(4)} ${t.guzergah.padEnd(22)} ${t.durum.padEnd(28)} ${t.konu}`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  if (e instanceof TanimHatasi) console.error(`❌ ${e.message}`)
  else console.error(e)
  process.exitCode = 1
})
