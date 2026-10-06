/**
 * Mevcut itdevir- kayıtlarının zimmet sahibini (ve altZimmetSahibi'ni) CSV'deki yeni değerlere göre
 * yeniden atar — ekrandaki Düzenle (PATCH /api/zimmet-formu/[id]) ile aynı mantık:
 *   - yeni sahip gerçek bir User olmalı; durum DEĞİŞMEZ; departman ve diğer alanlara DOKUNULMAZ
 *   - ZimmetDurumGecmisi'ne eskiDurum = yeniDurum satırı, "Zimmet sahibi değiştirildi: A → B" notuyla
 * Yalnız ONAY_BEKLIYOR ve imzasız (onaylayan/imza tarihi boş) kayıtlar atanır. BİLDİRİM YOK;
 * sonBildirimTarihi değişmez.
 *
 * Kararlar: ATA · ZATEN_ATANMIS (sahip ve alt sahip zaten aynı) · ATLA_<sebep> (atanamaz).
 * --apply fail-closed: ATA / ZATEN_ATANMIS dışında tek bir karar bile varsa hiçbir şey yazılmaz.
 *
 * Kullanım (worktree kökünden):
 *   npx tsx --env-file=<.env yolu> scripts/zimmet/it-devir-yeniden-ata.ts <csv> --refs <ref,...>
 *       --islem-yapan <User.id> [--override <json>] [--not "<metin>"] [--apply --db-name <ad>]
 *   Sahip: CSV'de zimmet_sahibi_eslestir (boşsa zimmet_sahibi_excel), import ile aynı eşleştirme kuralı.
 *   Varsayılan DRY-RUN. --apply: tek transaction; --db-name current_database() ile aynı değilse durur.
 */
import os from 'os'
import path from 'path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, ZimmetOnayDurumu } from '../../src/generated/prisma'
import {
  argDeger,
  csvOku,
  csvYaz,
  raporYolu,
  KULLANICI_SELECT,
  overrideYukle,
  sahipEslestirici,
  type Kullanici,
} from './it-devir-ortak'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const APPLY = process.argv.includes('--apply')
const CSV_YOLU = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const REFS = (argDeger('--refs') ?? '').split(',').map((r) => r.trim()).filter(Boolean)
const ISLEM_YAPAN = argDeger('--islem-yapan')
const DB_NAME = argDeger('--db-name')
const OVERRIDE_ARG = argDeger('--override')
const OVERRIDE_VARSAYILAN = path.join(os.homedir(), 'zimmet_kisi_eslestirme.json')
const NOT_ONEKI = (process.argv.includes('--not') ? argDeger('--not') : null) ?? 'IT listesi 09.2026 – sorumluya yeniden atandı'

type Karar = 'ATA' | 'ZATEN_ATANMIS' | 'ATLA_KAYIT_YOK' | 'ATLA_SILINMIS' | 'ATLA_DURUM' | 'ATLA_IMZALI' | 'ATLA_SAHIP_BELIRSIZ' | 'ATLA_CSV_YOK'
type Sonuc = {
  ref: string
  karar: Karar
  eskiSahipId: string
  eskiSahip: string
  yeniSahipId: string
  yeniSahip: string
  eskiAlt: string | null
  yeniAlt: string | null
  departman: string | null
  durum: string
  sebep: string
}

const bos = (v: string | undefined): string | null => {
  const s = (v ?? '').trim()
  return s ? s : null
}

async function main() {
  if (!CSV_YOLU) throw new Error('Kullanım: it-devir-yeniden-ata.ts <csv> --refs <ref,...> --islem-yapan <User.id> [--apply --db-name <ad>]')
  if (!REFS.length) throw new Error('--refs <ref,...> zorunlu')
  const gecersiz = REFS.filter((r) => !r.startsWith('itdevir-'))
  if (gecersiz.length) throw new Error(`--refs yalnız itdevir- kayıtları kabul eder: ${gecersiz.join(', ')}`)
  if (!ISLEM_YAPAN) throw new Error('--islem-yapan <User.id> zorunlu')
  if (process.argv.includes('--not') && !argDeger('--not')) throw new Error('--not için metin gerekli')

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  if (APPLY) {
    if (!DB_NAME) throw new Error('--apply için --db-name <ad> zorunlu')
    if (DB_NAME !== db) throw new Error(`GÜVENLİK DURDU: --db-name "${DB_NAME}" ≠ current_database() "${db}"`)
  }
  console.log(`\n=== IT zimmet devir YENİDEN ATAMA — ${APPLY ? 'APPLY (yazma)' : 'DRY-RUN (yazma yok)'} — DB: ${db} ===`)
  console.log(`CSV: ${CSV_YOLU} · ref: ${REFS.length} · not: ${NOT_ONEKI}`)

  const islemYapan = await prisma.user.findUnique({ where: { id: ISLEM_YAPAN }, select: { id: true } })
  if (!islemYapan) throw new Error(`--islem-yapan kullanıcısı bulunamadı: ${ISLEM_YAPAN}`)

  const satirByRef = new Map(csvOku(CSV_YOLU).map((s) => [s.ref, s]))
  const kullanicilar: Kullanici[] = await prisma.user.findMany({ select: KULLANICI_SELECT })
  const kullaniciById = new Map(kullanicilar.map((u) => [u.id, u]))
  const sahipBul = sahipEslestirici(kullanicilar, overrideYukle(OVERRIDE_ARG, OVERRIDE_VARSAYILAN))

  const kayitlar = await prisma.zimmetFormu.findMany({
    where: { id: { in: REFS } },
    select: {
      id: true,
      durum: true,
      silindiMi: true,
      zimmetSahibiId: true,
      altZimmetSahibi: true,
      departman: true,
      onaylayanId: true,
      zimmetSahibiImzaTarihi: true,
    },
  })
  const kayitById = new Map(kayitlar.map((k) => [k.id, k]))

  const ad = (id: string) => kullaniciById.get(id)?.name ?? id
  const sonuclar: Sonuc[] = REFS.map((ref) => {
    const k = kayitById.get(ref)
    const s = satirByRef.get(ref)
    const temel = {
      ref,
      eskiSahipId: k?.zimmetSahibiId ?? '',
      eskiSahip: k ? ad(k.zimmetSahibiId) : '',
      yeniSahipId: '',
      yeniSahip: '',
      eskiAlt: k?.altZimmetSahibi ?? null,
      yeniAlt: bos(s?.altZimmetSahibi),
      departman: k?.departman ?? null,
      durum: k?.durum ?? '',
    }
    if (!s) return { ...temel, karar: 'ATLA_CSV_YOK', sebep: 'CSV\'de bu ref yok' }
    if (!k) return { ...temel, karar: 'ATLA_KAYIT_YOK', sebep: 'DB\'de kayıt yok' }
    if (k.silindiMi) return { ...temel, karar: 'ATLA_SILINMIS', sebep: 'kayıt soft-delete edilmiş' }
    if (k.durum !== ZimmetOnayDurumu.ONAY_BEKLIYOR) return { ...temel, karar: 'ATLA_DURUM', sebep: `durum ${k.durum}` }
    if (k.onaylayanId || k.zimmetSahibiImzaTarihi) return { ...temel, karar: 'ATLA_IMZALI', sebep: 'onaylanmış / e-imzalı' }
    const { user, sebep } = sahipBul(s.zimmet_sahibi_eslestir || s.zimmet_sahibi_excel)
    if (!user) return { ...temel, karar: 'ATLA_SAHIP_BELIRSIZ', sebep }
    const sonuc = { ...temel, yeniSahipId: user.id, yeniSahip: user.name ?? user.id }
    if (user.id === k.zimmetSahibiId && temel.yeniAlt === k.altZimmetSahibi) {
      return { ...sonuc, karar: 'ZATEN_ATANMIS', sebep: `sahip ve alt sahip zaten aynı (${sebep})` }
    }
    return { ...sonuc, karar: 'ATA', sebep }
  })

  const atanacak = sonuclar.filter((r) => r.karar === 'ATA')
  const engel = sonuclar.filter((r) => r.karar !== 'ATA' && r.karar !== 'ZATEN_ATANMIS')

  if (APPLY) {
    if (engel.length) {
      throw new Error(`GÜVENLİK DURDU: ${engel.length} ref atanamaz (${engel.map((r) => `${r.ref}: ${r.karar}`).join('; ')}) — hiçbir şey yazılmadı`)
    }
    await prisma.$transaction(
      async (tx) => {
        for (const r of atanacak) {
          await tx.zimmetFormu.update({
            where: { id: r.ref, silindiMi: false, durum: ZimmetOnayDurumu.ONAY_BEKLIYOR },
            data: { zimmetSahibiId: r.yeniSahipId, altZimmetSahibi: r.yeniAlt },
          })
          const degisiklikler: string[] = []
          if (r.eskiSahipId !== r.yeniSahipId) degisiklikler.push(`Zimmet sahibi değiştirildi: ${r.eskiSahip} → ${r.yeniSahip}`)
          if (r.eskiAlt !== r.yeniAlt) degisiklikler.push(`Alt zimmet sahibi: "${r.eskiAlt ?? '—'}" → "${r.yeniAlt ?? '—'}"`)
          await tx.zimmetDurumGecmisi.create({
            data: {
              zimmetId: r.ref,
              eskiDurum: r.durum,
              yeniDurum: r.durum,
              islemYapanId: ISLEM_YAPAN!,
              not: `${NOT_ONEKI}: ${degisiklikler.join('; ')}`,
            },
          })
        }
      },
      { timeout: 120_000 },
    )
  }

  const rapor = raporYolu('zimmet-it-devir-yeniden-ata', APPLY ? 'apply' : 'dry-run')
  csvYaz(
    rapor,
    ['ref', 'karar', 'eski_sahip_id', 'eski_sahip', 'yeni_sahip_id', 'yeni_sahip', 'eski_alt', 'yeni_alt', 'departman', 'durum', 'sebep'],
    sonuclar.map((r) => [r.ref, r.karar, r.eskiSahipId, r.eskiSahip, r.yeniSahipId, r.yeniSahip, r.eskiAlt ?? '', r.yeniAlt ?? '', r.departman ?? '', r.durum, r.sebep]),
  )

  console.log('\nref | karar | eski sahip → yeni sahip | alt zimmet sahibi | departman | eşleşme')
  for (const r of sonuclar) {
    console.log(`  ${r.ref} | ${r.karar} | ${r.eskiSahip} → ${r.yeniSahip || '—'} | ${r.eskiAlt ?? '—'} → ${r.yeniAlt ?? '—'} | ${r.departman ?? '—'} | ${r.sebep}`)
  }
  console.log(
    `\n${APPLY ? 'Atandı' : 'Atanacak'}: ${atanacak.length} · zaten atanmış: ${sonuclar.filter((r) => r.karar === 'ZATEN_ATANMIS').length} · atanamaz: ${engel.length}. Bildirim: YOK.`,
  )
  console.log(`Rapor: ${rapor}`)
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
