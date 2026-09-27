/**
 * İzin Faz 2 — açılış bakiyesi import'u (plan §5). Mantık: src/lib/izin/acilis-import.ts (ekranla ortak).
 *
 * Kullanım:
 *   npx tsx --env-file=.env scripts/izin/acilis-ice-aktar.ts --db=ilerihub --dosya=<İV.xlsx> --tarih=YYYY-MM-DD
 *   npx tsx --env-file=.env scripts/izin/acilis-ice-aktar.ts --db=ilerihub --dosya=<İV.xlsx> --tarih=YYYY-MM-DD --apply --aktor=<User.id>
 *
 * - Varsayılan DRY-RUN: bağlantı Postgres düzeyinde SALT OKUNUR (default_transaction_read_only=on).
 * - --db=<ad> zorunlu; bağlanılan veritabanıyla birebir eşleşmeli.
 * - --tarih: açılış (= geçiş) tarihi. Excel'deki kalan bu tarih İTİBARIYLA; bu tarihe kadarki yıldönümleri
 *   Excel'de sayılmış kabul edilir. Apply SystemSetting izin_gecis_tarihi'ni yazar (varsa ve farklıysa DURUR).
 * - Rapor: <repo>/uploads/izin/ (dizin 700, dosyalar 600). KİŞİ VERİSİ — public/ ASLA.
 * - --apply: eşleşmeyen oranı --esik'i (varsayılan 0.10) aşarsa DURUR. --aktor gerçek User.id (denetim FK).
 * - GERÇEK apply canlıya geçiş gününde (Melih 27.09); öncesinde yalnız dry-run.
 */
import 'dotenv/config'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma'
import {
  ACILIS_SINIFLARI,
  ESLESMEYEN_ESIK_VARSAYILAN,
  acilisExcelOku,
  acilisHubVerisi,
  acilisKapisi,
  acilisRaporDizini,
  acilisRaporYaz,
  acilisSiniflandir,
  acilisUygula,
} from '../../src/lib/izin/acilis-import'

const arg = (ad: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3)
const APPLY = process.argv.includes('--apply')
const DB_ARG = arg('db')
const DOSYA = arg('dosya')
const TARIH = arg('tarih')
const AKTOR = arg('aktor') ?? 'sistem'
const ESIK = arg('esik') !== undefined ? Number(arg('esik')) : ESLESMEYEN_ESIK_VARSAYILAN

async function main() {
  if (!DB_ARG) throw new Error('--db=<veritabani_adi> zorunlu (örn. --db=ilerihub)')
  if (!DOSYA) throw new Error('--dosya=<İV açılış Excel yolu> zorunlu')
  if (!TARIH || !/^\d{4}-\d{2}-\d{2}$/.test(TARIH)) throw new Error('--tarih=YYYY-MM-DD zorunlu (açılış = geçiş tarihi)')
  if (!(ESIK >= 0 && ESIK <= 1)) throw new Error('--esik 0 ile 1 arasında olmalı (örn. 0.1)')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL yok')

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(APPLY ? {} : { options: '-c default_transaction_read_only=on' }),
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const [{ db, ro }] = await prisma.$queryRawUnsafe<{ db: string; ro: string }[]>(
      "select current_database() as db, current_setting('default_transaction_read_only') as ro",
    )
    if (db !== DB_ARG) throw new Error(`--db=${DB_ARG} ama bağlanılan veritabanı "${db}" — DURDU`)
    console.log(`DB: ${db}  mod: ${APPLY ? 'APPLY' : 'DRY-RUN'}  salt-okunur oturum: ${ro}`)
    if (!APPLY && ro !== 'on') throw new Error('dry-run oturumu salt-okunur açılamadı — DURDU')

    const kaynak = path.resolve(DOSYA)
    const buf = fs.readFileSync(kaynak)
    const sha = createHash('sha256').update(buf).digest('hex')
    const okuma = acilisExcelOku(buf)
    const hub = await acilisHubVerisi(prisma)
    const sonuc = acilisSiniflandir(okuma.satirlar, hub.personeller, hub.acilisiOlanlar)
    const etiket = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${APPLY ? 'apply' : 'dryrun'}`
    const { csv, json } = acilisRaporYaz(acilisRaporDizini(), sonuc, {
      mod: APPLY ? 'APPLY' : 'DRY-RUN', db, kaynak: path.basename(kaynak), kaynakSha256: sha, tarih: TARIH,
      baslikSatiri: okuma.baslikSatiri, sicilSutunu: okuma.sicilSutunu, kalanSutunu: okuma.kalanSutunu, esik: ESIK, zaman: new Date().toISOString(),
    }, etiket)

    console.log(`Kaynak: ${path.basename(kaynak)} (sha256 ${sha.slice(0, 12)}) — başlık ${okuma.baslikSatiri}. satır ` +
      `[sicil: "${okuma.sicilSutunu}", kalan: "${okuma.kalanSutunu}"], ${okuma.satirlar.length} veri satırı`)
    console.log(`Açılış tarihi: ${TARIH}  kayıtlı geçiş tarihi: ${hub.gecisTarihi ?? '(yok)'}`)
    console.log('Sınıflar:')
    for (const k of ACILIS_SINIFLARI) console.log(`  ${k.padEnd(18)} ${sonuc.ozet[k]}`)
    console.log(`  ${'HUB_AKTIF_DOSYADA_YOK'.padEnd(18)} ${sonuc.hubAktifDosyadaYok.length}`)
    console.log(`Yazılacak toplam gün: ${sonuc.toplamGun}`)
    const e = sonuc.eslesmeyen
    console.log(`Eşleşmeyen oranı: ${e.pay}/${e.payda} = ${(e.oran * 100).toFixed(1)}%  (eşik ${(ESIK * 100).toFixed(0)}%)`)
    console.log(`Rapor: ${csv}\n       ${json}`)

    if (!APPLY) {
      console.log(`\nDRY-RUN — DB'ye yazılmadı. Yazılacak kişi: ${sonuc.ozet.ESLESEN}`)
      return
    }
    const kapi = acilisKapisi(sonuc, ESIK)
    if (kapi) throw new Error(`${kapi} — APPLY DURDU, hiçbir şey yazılmadı`)
    const r = await acilisUygula(prisma, { sonuc, tarih: TARIH, yillikTurId: hub.yillikTurId, aktorId: AKTOR, rapor: csv, kaynakSha256: sha })
    console.log(`\nAPPLY — ${r.yazilan} kişiye toplam ${r.toplamGun} gün açılış yazıldı (tarih ${TARIH}, aktör ${AKTOR}).`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
