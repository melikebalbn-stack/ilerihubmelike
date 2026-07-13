/**
 * IPRO import ortak yardımcıları.
 *
 * Repo npm tabanlı. Çalıştırma:
 *   npx tsx --env-file=.env scripts/ipro/import-<x>.ts [--dry-run]
 *
 * VARSAYILAN: veri YAZAR (idempotent upsert/createMany-skipDuplicates).
 * Önizleme için --dry-run — hiçbir şey yazmaz, yalnız sayım + rapor basar.
 *
 * Prisma import: ../../src/generated/prisma  (@prisma/client ASLA)
 * Kaynak Excel adlarında boşluk/alt-çizgi farkı olabilir → dosyalar regex/glob ile bulunur.
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../src/generated/prisma'

export const MAS_DIR = '/home/rokunet/ipro-mas-export'

export function createPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  return {
    prisma,
    async disconnect() {
      await prisma.$disconnect()
      await pool.end()
    },
  }
}
export type Prisma = ReturnType<typeof createPrisma>['prisma']

/** Klasörde regex ile TEK .xlsx bul (boşluk/alt-çizgi farkını aşar). 0 veya >1 eşleşme => DUR. */
export function findFile(pattern: RegExp): string {
  const matches = fs
    .readdirSync(MAS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && pattern.test(f))
  if (matches.length === 0) throw new Error(`DUR: ${pattern} ile eşleşen .xlsx YOK (${MAS_DIR})`)
  if (matches.length > 1) throw new Error(`DUR: ${pattern} ile ${matches.length} dosya eşleşti: ${matches.join(', ')}`)
  return path.join(MAS_DIR, matches[0])
}

/** İlk sheet'i satır-nesnesi dizisi olarak oku; tamamen boş satırları at. */
export function readRows(file: string): Record<string, any>[] {
  const wb = XLSX.readFile(file)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null })
  return rows.filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''))
}

export const isEvet = (v: any) => String(v ?? '').trim().toUpperCase() === 'EVET'
export const asBool = (v: any) => String(v ?? '').trim().toLowerCase() === 'true'
export const clean = (v: any): string | null => {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}
export const asInt = (v: any): number | null => {
  const s = clean(v)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
/** Virgülle ayrılmış tezgah kodu listesi → trim + boş-eleme + dedupe (sıra korunur). */
export function splitCodes(v: any): string[] {
  const s = clean(v)
  if (s === null) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of s.split(',')) {
    const c = part.trim()
    if (c && !seen.has(c)) {
      seen.add(c)
      out.push(c)
    }
  }
  return out
}

export function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

/**
 * GEÇİCİ — MAS kaynak verisinde mükerrer kod var (canlı sisteme dokunulmuyor).
 * MAS'ta düzeltilene kadar import sırasında AD üzerinden yeniden kodlanıyor.
 * MAS düzeltilip yeni export alındığında BU TABLO SİLİNECEK.
 *
 * Eşleştirme AD üzerinden yapılır (kod zaten çakışık, ayırt edici değil).
 */
export const DUPLICATE_CODE_OVERRIDES = {
  durusSebebi: [
    { kod: '101', ad: 'Malzeme Temizleme', yeniKod: '101-B' },
  ],
  hurdaSebebi: [
    { kod: '32', ad: 'YUZEYDE BEYAZLAMA', yeniKod: '32-B' },
  ],
} as const

type OverrideRule = { readonly kod: string; readonly ad: string; readonly yeniKod: string }

/**
 * Mükerrer kodları AD ile yeniden kodlar. Excel okuması SONRASI, assertUniqueKeys ÖNCESİ çağrılır.
 * Eşleşme (kod + ad); ad trim + tr-locale case-insensitive denenir. Tutmazsa DUR (sessiz atlama YOK).
 * Yeniden kodlanan kayıt eşleme dosyalarında (Downtime/hurda_is_merkezi eski kodu taşır) TEZGAHSIZ kalır.
 */
export function applyDuplicateOverrides<T extends { kod: string; ad: string }>(
  rows: T[],
  overrides: ReadonlyArray<OverrideRule>,
  label: string,
): void {
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR')
  for (const ov of overrides) {
    const matches = rows.filter((r) => r.kod === ov.kod && norm(r.ad) === norm(ov.ad))
    if (matches.length === 0) {
      throw new Error(`OVERRIDE eşleşmedi: ${label} kod=${ov.kod} ad="${ov.ad}" bulunamadı — ad değişmiş olabilir, override güncellenmeli (sessizce atlanmaz)`)
    }
    if (matches.length > 1) {
      throw new Error(`OVERRIDE belirsiz: ${label} kod=${ov.kod} ad="${ov.ad}" → ${matches.length} kayda uyuyor`)
    }
    matches[0].kod = ov.yeniKod
    console.warn(`  ⚠️ OVERRIDE: ${label} '${ov.ad}' kodu ${ov.kod} → ${ov.yeniKod} (MAS'ta mükerrer)`)
    console.log(`     ℹ️ eşleme dosyaları hâlâ ${ov.kod} taşıyor → ${ov.yeniKod} TEZGAHSIZ kalır (doğru; MAS eşlemesi vermiyor, uydurulmuyor)`)
  }
}

/**
 * @unique alana yazmadan ÖNCE mükerrer anahtar denetimi. Excel'de aynı kod birden çok
 * satırda geçerse upsert son-kazanır ile SESSİZCE birleştirir → gerçek kayıt kaybolur.
 * Tekrar varsa çakışan kayıtları TAM basar ve throw eder (runCli → exit 1, zincir DURUR).
 * Dry-run'da da çalışır — dry-run'ın işi tam da bunu yakalamak.
 */
export function assertUniqueKeys<T>(
  rows: T[],
  keyFn: (r: T) => string,
  label: string,
  describe: (r: T) => string = (r) => JSON.stringify(r),
): void {
  const byKey = new Map<string, T[]>()
  for (const r of rows) {
    const k = keyFn(r)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(r)
  }
  const dups = [...byKey.entries()].filter(([, v]) => v.length > 1)
  if (dups.length === 0) return
  console.error(`\n⛔ ${label}: MÜKERRER KOD (${dups.length}) — @unique alan, sessiz birleşme riski:`)
  for (const [k, recs] of dups) {
    console.error(`   kod "${k}" ×${recs.length}:`)
    for (const r of recs) console.error(`      - ${describe(r)}`)
  }
  throw new Error(`${label}: ${dups.length} mükerrer kod bulundu — kaynak düzeltilmeli (report-duplicates.ts'e bak)`)
}
/** Bu dosya doğrudan mı çalıştırıldı? (CJS-güvenli: import.meta yok, argv[1] basename'i karşılaştır) */
export function isEntry(scriptBaseName: string): boolean {
  const entry = process.argv[1] ? path.basename(process.argv[1]).replace(/\.[cm]?[tj]s$/i, '') : ''
  return entry === scriptBaseName
}

/** createMany'i skipDuplicates ile parça parça çalıştır; toplam eklenen sayısını döndür. */
export async function createManyBatched(
  model: { createMany: (a: any) => Promise<{ count: number }> },
  data: any[],
  batch = 5000,
): Promise<number> {
  let inserted = 0
  for (let i = 0; i < data.length; i += batch) {
    const res = await model.createMany({ data: data.slice(i, i + batch), skipDuplicates: true })
    inserted += res.count
  }
  return inserted
}

export function banner(title: string, dryRun: boolean) {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  ${title}   [${dryRun ? 'DRY-RUN (yazma yok)' : 'YAZMA'}]`)
  console.log('═'.repeat(64))
}
export function summary(rows: Array<[string, any]>) {
  console.log('  ── özet ──')
  for (const [k, v] of rows) console.log(`     ${String(k).padEnd(38)} ${v}`)
}

/**
 * Standalone CLI koşucu. Yalnız dosya DOĞRUDAN çalıştırılınca (basename eşleşince) bootstrap eder;
 * import-all tarafından import edilince tetiklenmez. Top-level await YOK (repo CJS — tsx cjs derler);
 * fire-and-forget: pending DB handle'ları event loop'u ayakta tutar, .finally disconnect edince çıkar.
 */
export function runCli(scriptBaseName: string, fn: (prisma: Prisma, dryRun: boolean) => Promise<any>) {
  if (!isEntry(scriptBaseName)) return
  const dryRun = parseDryRun()
  const { prisma, disconnect } = createPrisma()
  fn(prisma, dryRun)
    .catch((e) => {
      console.error('\n⛔ DUR:', e instanceof Error ? e.message : e)
      process.exitCode = 1
    })
    .finally(() => disconnect())
}
