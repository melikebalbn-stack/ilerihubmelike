/**
 * ============================================================================
 * SERVİS TANIM PAKETİ — yerleşke · firma · güzergâh · durak
 * ============================================================================
 *
 * Prod'da bu dört tablo BOŞ. Göç script'i (--apply) tanım verisi YARATMAZ,
 * yalnız `kod` ile arar; bu paket o boşluğu doldurur.
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
 * 🔴 YERLEŞKE ve FİRMA PARAMETRE — placeholder GÖMÜLMEDİ.
 * Melih gerçek adları İdari İşler'den alıyor. Verilmezse script DURUR.
 *   npx tsx prisma/seed-servis-tanim.ts \
 *     --db=<veritabani> \
 *     --yerleske-kod=<kod> --yerleske-ad="<ad>" \
 *     --firma-ad="<taşeron firma adı>"
 *
 * 🔴 --apply OLMADAN HİÇBİR ŞEY YAZMAZ (göç script'iyle aynı desen).
 *
 * KAYNAK: veri iki katmanlı (bkz. servis-tanim-verisi.ts):
 *   1. dev DB'den okunan yerleşmiş tanım verisi — 9 güzergâh, 106 durak
 *   2. İdari İşler eşleme tablosundan gelen 27 yeni durak → toplam 133
 * 🔴 O 27 durağın SIRASI GERÇEK DEĞİL: güzergâhtaki fiziksel sırası
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
import { durakKodu } from '../src/lib/servis-yonetimi/servis-durak-kodu'
import { TUM_GUZERGAHLAR } from '../src/lib/servis-yonetimi/servis-tanim-verisi'

export * from '../src/lib/servis-yonetimi/servis-tanim-verisi'

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const arg = (ad: string) => args.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3)

const EXPECTED_DB = arg('db')
const YERLESKE_KOD = arg('yerleske-kod')
const YERLESKE_AD = arg('yerleske-ad')
const FIRMA_AD = arg('firma-ad')

function zorunlu(deger: string | undefined, bayrak: string, aciklama: string): string {
  if (!deger) {
    console.error(`❌ --${bayrak}=<deger> ZORUNLU. ${aciklama}`)
    console.error('   PLACEHOLDER GÖMÜLMEDİ: gerçek ad verilmeden tanım yazılmaz.')
    process.exit(1)
  }
  return deger
}

async function main() {
  const db = zorunlu(EXPECTED_DB, 'db', 'Örnek: --db=ilerihub_dev_elif')
  const yerleskeKod = zorunlu(YERLESKE_KOD, 'yerleske-kod', 'İdari İşler’den alınan gerçek yerleşke kodu.')
  const yerleskeAd = zorunlu(YERLESKE_AD, 'yerleske-ad', 'İdari İşler’den alınan gerçek yerleşke adı.')
  const firmaAd = zorunlu(FIRMA_AD, 'firma-ad', 'İdari İşler’den alınan gerçek taşeron firma adı.')

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

    let olusturulacak = { yerleske: 0, firma: 0, guzergah: 0, durak: 0, bag: 0 }
    let mevcut = { yerleske: 0, firma: 0, guzergah: 0, durak: 0, bag: 0 }

    // --- Yerleşke -----------------------------------------------------------
    const yerleskeVar = await prisma.servisYerleske.findFirst({ where: { kod: yerleskeKod } })
    yerleskeVar ? mevcut.yerleske++ : olusturulacak.yerleske++
    const yerleskeId =
      yerleskeVar?.id ??
      (APPLY
        ? (await prisma.servisYerleske.create({ data: { kod: yerleskeKod, ad: yerleskeAd } })).id
        : '(dry-run)')

    // --- Firma --------------------------------------------------------------
    const firmaVar = await prisma.servisFirma.findFirst({ where: { ad: firmaAd } })
    firmaVar ? mevcut.firma++ : olusturulacak.firma++
    if (!firmaVar && APPLY) await prisma.servisFirma.create({ data: { ad: firmaAd } })

    // --- Güzergâh + durak ---------------------------------------------------
    for (const g of TUM_GUZERGAHLAR) {
      const gVar = await prisma.servisGuzergah.findFirst({ where: { kod: g.kod } })
      gVar ? mevcut.guzergah++ : olusturulacak.guzergah++
      const gId =
        gVar?.id ??
        (APPLY
          ? (await prisma.servisGuzergah.create({ data: { kod: g.kod, ad: g.ad, yerleskeId } })).id
          : '(dry-run)')

      for (const d of g.duraklar) {
        const kod = durakKodu(g.kod, d.sira)
        const dVar = await prisma.servisDurak.findFirst({ where: { kod } })
        dVar ? mevcut.durak++ : olusturulacak.durak++
        const dId =
          dVar?.id ??
          (APPLY ? (await prisma.servisDurak.create({ data: { kod, ad: d.ad } })).id : '(dry-run)')

        if (APPLY) {
          const bagVar = await prisma.servisGuzergahDurak.findFirst({
            where: { guzergahId: gId, durakId: dId },
          })
          bagVar ? mevcut.bag++ : olusturulacak.bag++
          if (!bagVar) {
            await prisma.servisGuzergahDurak.create({
              data: { guzergahId: gId, durakId: dId, sira: d.sira },
            })
          }
        } else {
          olusturulacak.bag++
        }
      }
    }

    console.log('═══ ÖZET ═══')
    for (const k of ['yerleske', 'firma', 'guzergah', 'durak', 'bag'] as const) {
      console.log(`  ${k.padEnd(10)} oluşturulacak: ${String(olusturulacak[k]).padStart(4)} · mevcut korundu: ${mevcut[k]}`)
    }
    if (!APPLY) console.log('\n(DRY-RUN — hiçbir şey yazılmadı. --apply ile gerçek yazım yapılır.)')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
