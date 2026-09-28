/**
 * "Sadece IT listesi kalsın" temizliği: silindiMi=false ve id NOT LIKE 'itdevir-%'
 * olan ZimmetFormu kayıtlarını soft-delete eder. İKİ İSTİSNA korunur:
 *   KORUNDU_ATLA_IMZALI     listede olup aynı sahipte imzalı kayıt (import raporunda ATLA_IMZALI)
 *   KORUNDU_IMZALI_YAZILIM  imzalı (ONAYLANDI / e-imzalı) yazılım/lisans kaydı
 * İmzasız yazılım kayıtları (onay bekleyen + reddedilmiş) silinir.
 * Silinen her kayda ZimmetDurumGecmisi SILINDI satırı yazılır (not: TEMIZLIK_NOTU).
 * BİLDİRİM YOK. Geri alma: it-devir-geri-al.ts bu notlu kayıtları geri açar.
 *
 * Kullanım (worktree kökünden):
 *   npx tsx --env-file=<.env yolu> scripts/zimmet/it-devir-temizle.ts --islem-yapan <User.id>
 *       --import-rapor <import-raporu.csv> [--varsay] [--apply --db-name <ad>]
 *   --import-rapor zorunlu: ATLA_IMZALI eski kayıtları buradan okunur (korunur).
 *   --varsay (yalnız dry-run): import raporundaki TASI/TASI_IMZALI/YENILE eski kayıtları zaten silinmiş sayılır —
 *   import --apply'dan ÖNCE temizliğin son hâlini görmek için.
 *   Varsayılan DRY-RUN. --apply: tek transaction; --db-name current_database() ile aynı değilse durur.
 */
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, ZimmetKaynak, ZimmetOnayDurumu, ZimmetTuru } from '../../src/generated/prisma'
import { esitlikIcinNormalize } from '../../src/lib/zimmet/arama'
import { argDeger, csvOku, csvYaz, ESKI_SILEN_KARARLAR, raporYolu, TEMIZLIK_NOTU } from './it-devir-ortak'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const APPLY = process.argv.includes('--apply')
const VARSAY = process.argv.includes('--varsay')
const DB_NAME = argDeger('--db-name')
const ISLEM_YAPAN = argDeger('--islem-yapan')
const IMPORT_RAPOR = argDeger('--import-rapor')
const YAZILIM_KOK_ADI = 'Yazılım'

type Grup = 'MANUEL' | 'YAZILIM' | 'DONANIM'
type Karar = 'SIL' | 'KORUNDU_ATLA_IMZALI' | 'KORUNDU_IMZALI_YAZILIM'

async function main() {
  if (!ISLEM_YAPAN) throw new Error('--islem-yapan <User.id> zorunlu')
  if (!IMPORT_RAPOR) throw new Error('--import-rapor <import-raporu.csv> zorunlu (ATLA_IMZALI koruması için)')
  if (APPLY && VARSAY) throw new Error('--varsay yalnız dry-run içindir; --apply ile kullanılamaz')

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  if (APPLY) {
    if (!DB_NAME) throw new Error('--apply için --db-name <ad> zorunlu')
    if (DB_NAME !== db) throw new Error(`GÜVENLİK DURDU: --db-name "${DB_NAME}" ≠ current_database() "${db}"`)
  }
  console.log(`\n=== IT zimmet devir TEMİZLİK — ${APPLY ? 'APPLY (yazma)' : 'DRY-RUN (yazma yok)'} — DB: ${db} ===`)

  const kullanici = await prisma.user.findUnique({ where: { id: ISLEM_YAPAN }, select: { id: true } })
  if (!kullanici) throw new Error(`--islem-yapan kullanıcısı bulunamadı: ${ISLEM_YAPAN}`)

  const importRaporu = csvOku(IMPORT_RAPOR)
  if (!importRaporu.length || !('karar' in importRaporu[0]) || !('eski_kayit_idler' in importRaporu[0])) {
    throw new Error(`${IMPORT_RAPOR}: it-devir-import raporu değil (karar / eski_kayit_idler kolonu yok)`)
  }
  const idler = (kararlar: string[]) =>
    new Set(importRaporu.filter((r) => kararlar.includes(r.karar)).flatMap((r) => r.eski_kayit_idler.split(' ').filter(Boolean)))
  const atlaImzali = idler(['ATLA_IMZALI'])
  const varsayilanSilinmis = VARSAY ? idler(Object.keys(ESKI_SILEN_KARARLAR)) : new Set<string>()
  console.log(`Import raporu: ${IMPORT_RAPOR} — ATLA_IMZALI: ${atlaImzali.size}${VARSAY ? ` · varsayım: ${varsayilanSilinmis.size} TASI/TASI_IMZALI/YENILE eski kaydı silinmiş sayıldı` : ''}`)

  // Yazılım/lisans ayrımı: OFFICE_365 veya DIGER + turDiger "Yazılım" kökünün bir çocuğu.
  const kok = await prisma.zimmetTanim.findFirst({ where: { ad: YAZILIM_KOK_ADI, parentId: null }, select: { id: true } })
  const yazilimAdlari = new Set(
    kok
      ? (await prisma.zimmetTanim.findMany({ where: { parentId: kok.id }, select: { ad: true } })).map((t) => esitlikIcinNormalize(t.ad))
      : [],
  )

  const kayitlar = (
    await prisma.zimmetFormu.findMany({
      where: { silindiMi: false, NOT: { id: { startsWith: 'itdevir-' } } },
      select: {
        id: true,
        tur: true,
        turDiger: true,
        seriNumarasi: true,
        kaynak: true,
        durum: true,
        zimmetSahibiImzaTarihi: true,
        zimmetSahibi: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: [{ tur: 'asc' }, { id: 'asc' }],
    })
  ).filter((k) => !varsayilanSilinmis.has(k.id))
  type Kayit = (typeof kayitlar)[number]

  const grupBul = (k: Kayit): Grup => {
    if (k.kaynak === ZimmetKaynak.MANUEL) return 'MANUEL'
    if (k.tur === ZimmetTuru.OFFICE_365) return 'YAZILIM'
    if (k.tur === ZimmetTuru.DIGER && k.turDiger && yazilimAdlari.has(esitlikIcinNormalize(k.turDiger))) return 'YAZILIM'
    return 'DONANIM'
  }
  const imzali = (k: Kayit) => k.durum === ZimmetOnayDurumu.ONAYLANDI || k.zimmetSahibiImzaTarihi !== null
  const kararBul = (k: Kayit): Karar => {
    if (atlaImzali.has(k.id)) return 'KORUNDU_ATLA_IMZALI'
    if (imzali(k) && grupBul(k) === 'YAZILIM') return 'KORUNDU_IMZALI_YAZILIM'
    return 'SIL'
  }
  const silinecek = kayitlar.filter((k) => kararBul(k) === 'SIL')
  const korunan = kayitlar.filter((k) => kararBul(k) !== 'SIL')

  if (APPLY) {
    const simdi = new Date()
    await prisma.$transaction(
      async (tx) => {
        for (const k of silinecek) {
          await tx.zimmetFormu.update({
            where: { id: k.id, silindiMi: false },
            data: { silindiMi: true, silinmeTarihi: simdi, silenId: ISLEM_YAPAN },
          })
          await tx.zimmetDurumGecmisi.create({
            data: { zimmetId: k.id, eskiDurum: k.durum, yeniDurum: 'SILINDI', islemYapanId: ISLEM_YAPAN!, not: TEMIZLIK_NOTU },
          })
        }
      },
      { timeout: 120_000 },
    )
  }

  const satir = (k: Kayit) => [
    k.id,
    kararBul(k),
    grupBul(k),
    k.tur + (k.turDiger ? `/${k.turDiger}` : ''),
    k.seriNumarasi ?? '',
    k.zimmetSahibi?.name ?? '',
    k.kaynak,
    k.durum,
    imzali(k) ? 'evet' : 'hayır',
    String(k._count.tickets),
  ]
  const rapor = raporYolu('zimmet-it-devir-temizle', APPLY ? 'apply' : 'dry-run')
  csvYaz(rapor, ['id', 'karar', 'grup', 'tur', 'seri', 'sahip', 'kaynak', 'durum', 'imzali', 'ticket'], kayitlar.map(satir))

  const yaz = (baslik: string, liste: Kayit[]) => {
    console.log(`\n${baslik} (${liste.length}):`)
    for (const k of liste) console.log(`  ${satir(k).filter((_, i) => i !== 1 && i !== 2).join(' | ')}`)
  }
  console.log(`\n${APPLY ? 'Soft-delete edildi' : 'Soft-delete edilecek'}: ${silinecek.length} kayıt · korunan: ${korunan.length}. Bildirim: YOK.`)
  console.log('  (kolonlar: id | tür | seri | sahip | kaynak | durum | imzalı | ticket)')
  yaz('KORUNAN — aynı sahipte imzalı (ATLA_IMZALI)', korunan.filter((k) => kararBul(k) === 'KORUNDU_ATLA_IMZALI'))
  yaz('KORUNAN — imzalı yazılım/lisans', korunan.filter((k) => kararBul(k) === 'KORUNDU_IMZALI_YAZILIM'))
  yaz('SİL — yazılım / lisans (imzasız)', silinecek.filter((k) => grupBul(k) === 'YAZILIM'))
  yaz('SİL — donanım (el terminali, yazıcı ve listede olmayan diğer)', silinecek.filter((k) => grupBul(k) === 'DONANIM'))
  yaz('SİL — MANUEL / test', silinecek.filter((k) => grupBul(k) === 'MANUEL'))
  yaz('SİL — İMZALI (gruplardan bağımsız)', silinecek.filter(imzali))
  yaz('Ticket bağı olan (tümü; soft-delete bağı koparmaz)', kayitlar.filter((k) => k._count.tickets > 0))
  console.log(`\nRapor: ${rapor}`)
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
