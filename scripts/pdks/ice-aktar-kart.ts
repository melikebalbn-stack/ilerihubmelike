/**
 * PDKS Faz 2 — BizManager kart listesi import'u (plan §6.1). Mantık: src/lib/pdks/kart-import.ts
 *
 * Kullanım:
 *   npx tsx --env-file=.env scripts/pdks/ice-aktar-kart.ts --db=ilerihub --dosya=<PDKS.xlsx>
 *   npx tsx --env-file=.env scripts/pdks/ice-aktar-kart.ts --db=ilerihub --dosya=<PDKS.xlsx> --apply --aktor=<User.id>
 *
 * - Varsayılan DRY-RUN: bağlantı Postgres düzeyinde SALT OKUNUR açılır
 *   (default_transaction_read_only=on) — kod hatası olsa bile yazma yapılamaz.
 * - --db=<ad> zorunlu; bağlanılan veritabanıyla birebir eşleşmeli (deaktive-ayrilan deseni).
 * - Rapor: kaynak dosyanın dizinine (uploads/pdks/, 700) CSV + JSON (600). KİŞİ VERİSİ.
 * - --apply: eşleşmeyen oranı --esik'i (varsayılan 0.10) aşarsa DURUR. --aktor gerçek User.id
 *   olmalı (denetim FK); verilmezse 'sistem'.
 */
import 'dotenv/config'
import * as path from 'node:path'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma'
import {
  ESLESMEYEN_ESIK_VARSAYILAN,
  bizManagerOku,
  hubVerisiOku,
  raporYaz,
  siniflandir,
  uygula,
} from '../../src/lib/pdks/kart-import'
import { kartNoBicimiOku } from '../../src/lib/pdks/kart-no'

const arg = (ad: string) => process.argv.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3)
const APPLY = process.argv.includes('--apply')
const DB_ARG = arg('db')
const DOSYA = arg('dosya')
const AKTOR = arg('aktor') ?? 'sistem'
const ESIK = arg('esik') !== undefined ? Number(arg('esik')) : ESLESMEYEN_ESIK_VARSAYILAN

async function main() {
  if (!DB_ARG) throw new Error('--db=<veritabani_adi> zorunlu (örn. --db=ilerihub)')
  if (!DOSYA) throw new Error('--dosya=<BizManager PDKS.xlsx yolu> zorunlu')
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
    const okuma = bizManagerOku(kaynak)
    const bicim = await kartNoBicimiOku(prisma)
    const hub = await hubVerisiOku(prisma)
    const sonuc = siniflandir(okuma.satirlar, hub.personeller, hub.aktifKartlar)

    const etiket = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${APPLY ? 'apply' : 'dryrun'}`
    const { csv, json } = raporYaz(
      path.dirname(kaynak),
      sonuc,
      {
        mod: APPLY ? 'APPLY' : 'DRY-RUN',
        db,
        kaynak: path.basename(kaynak),
        baslikSatiri: okuma.baslikSatiri,
        atlananToplamSatiri: okuma.atlananToplamSatiri,
        satir: okuma.satirlar.length,
        kartNoBicimi: bicim,
        esik: ESIK,
        zaman: new Date().toISOString(),
      },
      etiket,
    )

    const o = sonuc.ozet
    const e = sonuc.eslesmeyen
    console.log(`Kaynak: ${path.basename(kaynak)} — başlık ${okuma.baslikSatiri}. satır, ${okuma.satirlar.length} veri satırı` +
      (okuma.atlananToplamSatiri ? `, "Toplam" satırı (${okuma.atlananToplamSatiri}) atlandı` : ''))
    console.log(`Kart no biçimi (panele): ${bicim}`)
    console.log('Sınıflar:')
    for (const [k, v] of Object.entries(o)) console.log(`  ${k.padEnd(26)} ${v}`)
    console.log(`  ${'HUB_AKTIF_KARTSIZ'.padEnd(26)} ${sonuc.hubAktifKartsiz.length}`)
    console.log(`Güvenlik bulgusu (Hub'da pasif/yok ama kartlı): ${o.HUBDA_PASIF_KARTLI + o.HUBDA_YOK}` +
      ` — bunlardan BizManager'da AKTİF görünen: ${sonuc.kayitlar.filter((k) => k.guvenlikBulgusu && !k.ayrildi).length}`)
    console.log(`Eşleşmeyen oranı: ${e.pay}/${e.payda} = ${(e.oran * 100).toFixed(1)}%  (eşik ${(ESIK * 100).toFixed(0)}%)`)
    console.log(`Rapor: ${csv}\n       ${json}`)

    if (!APPLY) {
      console.log(`\nDRY-RUN — DB'ye yazılmadı. Yazılacak kart: ${o.ESLESEN}`)
      return
    }
    if (e.oran > ESIK) {
      throw new Error(`eşleşmeyen oranı %${(e.oran * 100).toFixed(1)} > eşik %${(ESIK * 100).toFixed(0)} — APPLY DURDU, hiçbir şey yazılmadı`)
    }
    const { yazilan } = await uygula(prisma, sonuc.kayitlar, bicim, AKTOR, csv)
    console.log(`\nAPPLY — ${yazilan} kart yazıldı (kaynak BIZMANAGER_IMPORT, aktör ${AKTOR}).`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
