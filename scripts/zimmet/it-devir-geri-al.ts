/**
 * IT zimmet devir işlemlerinin (it-devir-import --apply, it-devir-temizle --apply) geri alınması.
 *
 *  1) id LIKE 'itdevir-%' ve silindiMi=false olan kayıtları soft-delete eder
 *     (imzalanmış olanlar da dahil — dry-run'da ayrıca listelenir).
 *  2) Verilen import apply raporlarındaki TASI / TASI_IMZALI / YENILE satırlarının eski kayıtlarını
 *     geri açar. Yalnız import'un sildikleri açılır: kayıt silinmiş olmalı ve son
 *     SILINDI notu ilgili önekle o ref'i göstermeli.
 *  3) it-devir-temizle'nin sildiği kayıtları (son SILINDI notu TEMIZLIK_NOTU) geri açar.
 *  Her değişiklik ZimmetDurumGecmisi'ne yazılır. BİLDİRİM YOK.
 *
 *  --sadece <ref,...>: YALNIZ verilen itdevir- kayıtları soft-delete edilir (kısmi geri alma). Temizlik
 *  geri açılmaz; rapor verilirse yalnız bu ref'lerin TASI/TASI_IMZALI/YENILE eskileri geri açılır.
 *  --not "<metin>": soft-delete geçmiş notu (varsayılan: GERI_ALMA_NOTU).
 *
 * Kullanım (worktree kökünden):
 *   npx tsx --env-file=<.env yolu> scripts/zimmet/it-devir-geri-al.ts <import-apply-rapor.csv> [<rapor2.csv> …]
 *       --islem-yapan <User.id> [--sadece <ref,...>] [--not "<metin>"] [--apply --db-name <ad>]
 *   Varsayılan DRY-RUN. --apply: tek transaction; --db-name current_database() ile aynı değilse durur.
 *   --sadece modunda rapor zorunlu değildir.
 */
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma'
import {
  argDeger,
  csvOku,
  csvYaz,
  raporYolu,
  ESKI_SILEN_KARARLAR,
  TEMIZLIK_NOTU,
} from './it-devir-ortak'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const DEGERLI_BAYRAKLAR = new Set(['--islem-yapan', '--db-name', '--sadece', '--not'])
const APPLY = process.argv.includes('--apply')
const RAPORLAR = process.argv
  .slice(2)
  .filter((a, i, arr) => !a.startsWith('--') && !(i > 0 && DEGERLI_BAYRAKLAR.has(arr[i - 1])))
const ISLEM_YAPAN = argDeger('--islem-yapan')
const DB_NAME = argDeger('--db-name')
const GERI_ALMA_NOTU = 'IT listesi 09.2026 aktarımı geri alındı'
const SADECE_ARG = process.argv.includes('--sadece') ? argDeger('--sadece') ?? '' : null
const SADECE: string[] | null =
  SADECE_ARG === null ? null : [...new Set(SADECE_ARG.split(',').map((r) => r.trim()).filter(Boolean))]
const SILME_NOTU = (process.argv.includes('--not') ? argDeger('--not') : null) ?? GERI_ALMA_NOTU

async function main() {
  if (!RAPORLAR.length && !SADECE) {
    throw new Error('Kullanım: it-devir-geri-al.ts <import-apply-rapor.csv> [...] --islem-yapan <User.id> [--sadece <ref,...>] [--apply --db-name <ad>]')
  }
  if (SADECE && !SADECE.length) throw new Error('--sadece için en az bir ref gerekli (virgülle ayrılmış)')
  if (SADECE) {
    const gecersiz = SADECE.filter((r) => !r.startsWith('itdevir-'))
    if (gecersiz.length) throw new Error(`--sadece yalnız itdevir- kayıtları kabul eder: ${gecersiz.join(', ')}`)
  }
  if (process.argv.includes('--not') && !argDeger('--not')) throw new Error('--not için metin gerekli')
  if (!ISLEM_YAPAN) throw new Error('--islem-yapan <User.id> zorunlu')

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  if (APPLY) {
    if (!DB_NAME) throw new Error('--apply için --db-name <ad> zorunlu')
    if (DB_NAME !== db) throw new Error(`GÜVENLİK DURDU: --db-name "${DB_NAME}" ≠ current_database() "${db}"`)
  }
  console.log(
    `\n=== IT zimmet devir GERİ ALMA${SADECE ? ` (--sadece ${SADECE.length} ref)` : ''} — ${APPLY ? 'APPLY (yazma)' : 'DRY-RUN (yazma yok)'} — DB: ${db} ===`,
  )
  console.log(`Silme notu: ${SILME_NOTU}`)

  const kullanici = await prisma.user.findUnique({ where: { id: ISLEM_YAPAN }, select: { id: true } })
  if (!kullanici) throw new Error(`--islem-yapan kullanıcısı bulunamadı: ${ISLEM_YAPAN}`)

  // 1) Import'un açtığı kayıtlar (--sadece: yalnız verilen ref'ler)
  const yeniKayitlar = await prisma.zimmetFormu.findMany({
    where: SADECE ? { id: { in: SADECE }, silindiMi: false } : { id: { startsWith: 'itdevir-' }, silindiMi: false },
    select: { id: true, durum: true, zimmetSahibiImzaTarihi: true, cihazDurumu: true },
    orderBy: { id: 'asc' },
  })
  if (SADECE) {
    const bulunan = new Set(yeniKayitlar.map((k) => k.id))
    const eksik = SADECE.filter((r) => !bulunan.has(r))
    if (eksik.length) throw new Error(`--sadece: silinmemiş kayıt bulunamadı (yok ya da zaten silinmiş): ${eksik.join(', ')}`)
  }

  // 2) TASI / TASI_IMZALI / YENILE ile silinen eski kayıtlar (raporlardan) — beklenen son silme notuyla
  const istekler: { ref: string; id: string; beklenenNot: string }[] = []
  for (const yol of RAPORLAR) {
    const rapor = csvOku(yol)
    if (!rapor.length || !('karar' in rapor[0]) || !('eski_kayit_idler' in rapor[0])) {
      throw new Error(`${yol}: it-devir-import raporu değil (karar / eski_kayit_idler kolonu yok)`)
    }
    for (const r of rapor) {
      const onek = ESKI_SILEN_KARARLAR[r.karar]
      if (!onek) continue
      if (SADECE && !SADECE.includes(r.ref)) continue
      for (const id of r.eski_kayit_idler.split(' ').filter(Boolean)) istekler.push({ ref: r.ref, id, beklenenNot: `${onek}${r.ref}` })
    }
  }
  // 3) it-devir-temizle'nin sildikleri (--sadece modunda geri açılmaz).
  // `not` alanı where'de kullanılamıyor (Prisma 7.2 query compiler panic: alan adı filtre
  // operatörüyle çakışıyor) — SILINDI satırları okunup not JS'te süzülür.
  const temizlenenIdler = SADECE
    ? []
    : (await prisma.zimmetDurumGecmisi.findMany({ where: { yeniDurum: 'SILINDI' }, select: { zimmetId: true, not: true } }))
        .filter((g) => g.not === TEMIZLIK_NOTU)
        .map((g) => g.zimmetId)
  for (const id of new Set(temizlenenIdler)) {
    if (!istekler.some((t) => t.id === id)) istekler.push({ ref: 'TEMIZLIK', id, beklenenNot: TEMIZLIK_NOTU })
  }

  const hedefIdler = istekler.map((t) => t.id)
  const eskiKayitlar = await prisma.zimmetFormu.findMany({
    where: { id: { in: hedefIdler } },
    select: { id: true, silindiMi: true, durum: true },
  })
  const eskiById = new Map(eskiKayitlar.map((k) => [k.id, k]))
  const sonNotlar = await prisma.zimmetDurumGecmisi.findMany({
    where: { zimmetId: { in: hedefIdler }, yeniDurum: 'SILINDI' },
    orderBy: { createdAt: 'desc' },
    select: { zimmetId: true, not: true },
  })
  const sonSilmeNotu = new Map<string, string | null>()
  for (const n of sonNotlar) if (!sonSilmeNotu.has(n.zimmetId)) sonSilmeNotu.set(n.zimmetId, n.not)

  const acilacak: { ref: string; id: string; durum: string }[] = []
  const atlanan: { ref: string; id: string; sebep: string }[] = []
  for (const t of istekler) {
    const k = eskiById.get(t.id)
    if (!k) atlanan.push({ ref: t.ref, id: t.id, sebep: 'kayıt bulunamadı' })
    else if (!k.silindiMi) atlanan.push({ ref: t.ref, id: t.id, sebep: 'zaten açık (silinmemiş)' })
    else if (sonSilmeNotu.get(t.id) !== t.beklenenNot) atlanan.push({ ref: t.ref, id: t.id, sebep: 'son silme bu işlemden değil' })
    else acilacak.push({ ref: t.ref, id: t.id, durum: k.durum })
  }

  if (APPLY) {
    const simdi = new Date()
    await prisma.$transaction(
      async (tx) => {
        for (const k of yeniKayitlar) {
          await tx.zimmetFormu.update({
            where: { id: k.id, silindiMi: false },
            data: { silindiMi: true, silinmeTarihi: simdi, silenId: ISLEM_YAPAN },
          })
          await tx.zimmetDurumGecmisi.create({
            data: { zimmetId: k.id, eskiDurum: k.durum, yeniDurum: 'SILINDI', islemYapanId: ISLEM_YAPAN!, not: SILME_NOTU },
          })
        }
        for (const a of acilacak) {
          await tx.zimmetFormu.update({
            where: { id: a.id, silindiMi: true },
            data: { silindiMi: false, silinmeTarihi: null, silenId: null },
          })
          await tx.zimmetDurumGecmisi.create({
            data: {
              zimmetId: a.id,
              eskiDurum: 'SILINDI',
              yeniDurum: a.durum,
              islemYapanId: ISLEM_YAPAN!,
              not: `${GERI_ALMA_NOTU} — ${a.ref === 'TEMIZLIK' ? 'liste dışı temizliği' : `${a.ref} işlemi`} iptal, kayıt geri açıldı`,
            },
          })
        }
      },
      { timeout: 120_000 },
    )
  }

  const cikti = raporYolu('zimmet-it-devir-geri-al', APPLY ? 'apply' : 'dry-run')
  csvYaz(cikti, ['id', 'islem', 'ref', 'not'], [
    ...yeniKayitlar.map((k) => [k.id, 'SOFT_DELETE', k.id, `${k.durum}${k.zimmetSahibiImzaTarihi ? ' · e-imzalı' : ''}`]),
    ...acilacak.map((a) => [a.id, 'GERI_AC', a.ref, a.durum]),
    ...atlanan.map((a) => [a.id, 'ATLANDI', a.ref, a.sebep]),
  ])

  const imzalilar = yeniKayitlar.filter((k) => k.durum === 'ONAYLANDI' || k.zimmetSahibiImzaTarihi)
  console.log(`\n${APPLY ? 'Soft-delete edildi' : 'Soft-delete edilecek'} (${SADECE ? '--sadece' : 'itdevir-%'}): ${yeniKayitlar.length}`)
  if (SADECE) for (const k of yeniKayitlar) console.log(`  ${k.id} (${k.durum}, ${k.cihazDurumu})`)
  if (SADECE && !RAPORLAR.length) console.log('  (rapor verilmedi — bu ref\'lerin TASI/YENILE eskileri kontrol edilmedi)')
  const depoKayitlari = yeniKayitlar.filter((k) => k.cihazDurumu === 'PASIF').length
  if (depoKayitlari) console.log(`  (bunlardan ${depoKayitlari} kayıt depo — cihazDurumu PASIF)`)
  if (imzalilar.length) {
    console.log(`  ⚠️  bunlardan ${imzalilar.length} kayıt sahibi tarafından onaylanmış/e-imzalı:`)
    for (const k of imzalilar) console.log(`     ${k.id} (${k.durum})`)
  }
  const temizlikAcilan = acilacak.filter((a) => a.ref === 'TEMIZLIK').length
  console.log(
    `${APPLY ? 'Geri açıldı' : 'Geri açılacak'}: ${acilacak.length} (TASI/TASI_IMZALI/YENILE eskileri: ${acilacak.length - temizlikAcilan}, temizlik: ${temizlikAcilan})`,
  )
  if (atlanan.length) {
    console.log(`Atlanan: ${atlanan.length}`)
    for (const a of atlanan) console.log(`  ${a.ref} → ${a.id}: ${a.sebep}`)
  }
  console.log(`Bildirim: YOK.\nRapor: ${cikti}`)
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
