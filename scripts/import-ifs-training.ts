/**
 * IFS-2 — IFS Eğitimleri görev iskeleti import (xlsx → DB).
 *
 * Kaynak Excel: sheet = eğitim alanı, satır = görev. Her görevde Modül / Alt Modül /
 * Kullanılan IFS Ekranı / Konu (+ Referans Eğitim Dokümanı / Videosu).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-ifs-training.ts \
 *     --file "/home/rokunet/import/ifs/<dosya>.xlsx" --department "Depo-Envanter" --dry-run
 *
 *   npx tsx --env-file=.env scripts/import-ifs-training.ts \
 *     --file "..." --department "Depo-Envanter" --commit
 *
 * Dry-run DB'ye YAZMAZ; sayım + örnek + dedup + atlanan kolon raporu basar.
 * Commit modu tek transaction'da idempotent upsert (re-run güvenli).
 *
 * MAPPING:
 *   sheet  -> Course(isIfs=true, title="<Departman> · <SheetAdı>")
 *   satır  -> Content(type=GOREV, title=Konu, order=sıra, fileUrl/filePath=null)
 *             + IfsTaskMeta(modul, altModul, ifsEkran, refDocUrl, refVideoUrl)
 *   tümü   -> CoursePackage(isIfs=true, "IFS Geçiş · <Departman>") + PackageCourse
 *   DepartmentPackage / bölüm / dueDate YAPILMAZ (admin UI'dan).
 *
 * DEDUP (stable key, order DEĞİL):
 *   Course   : (isIfs=true, title)
 *   Package  : (isIfs=true, title)
 *   Content  : (courseId, norm(modul), norm(altModul), norm(ifsEkran), norm(Konu))
 *   Re-run var olanı GÜNCELLER, duplicate yaratmaz.
 *
 * Durum (Eğitimi Verildi/Uygulamalı/Örnek Yaptı) ve yorum kolonları İMPORT EDİLMEZ
 * (departman-seviyesi iskelet; per-user değerlendirme IFS-4'te). Atlananlar raporlanır.
 */
import 'dotenv/config'
import * as XLSX from 'xlsx'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

// ════════════════════════════════════════════════════════════ TYPES
interface CliArgs {
  file?: string
  department?: string
  dryRun: boolean
  commit: boolean
}

interface ColMap {
  modul: number
  altModul: number
  ifsEkran: number
  konu: number
  refDoc: number
  refVideo: number
}

interface ParsedTask {
  order: number
  modul: string | null
  altModul: string | null
  ifsEkran: string | null
  konu: string
  refDocUrl: string | null
  refVideoUrl: string | null
}

interface SheetResult {
  sheetName: string
  courseTitle: string
  headerRowIndex: number | null
  reason: string
  colMap: ColMap
  mappedCols: string[]
  skippedCols: string[]
  tasks: ParsedTask[]
}

// ════════════════════════════════════════════════════════════ HELPERS
function norm(s: unknown): string {
  return (s == null ? '' : String(s))
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function cell(s: unknown): string | null {
  const v = (s == null ? '' : String(s)).trim()
  return v.length ? v : null
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, commit: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--file') args.file = argv[++i]
    else if (a === '--department') args.department = argv[++i]
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--commit') args.commit = true
    else throw new Error(`Bilinmeyen argüman: ${a}`)
  }
  if (!args.file) throw new Error('--file <xlsx> gerekli')
  if (!args.department) throw new Error('--department "<ad>" gerekli')
  if (args.dryRun && args.commit)
    throw new Error('--dry-run ve --commit aynı anda kullanılamaz')
  if (!args.dryRun && !args.commit)
    throw new Error('--dry-run veya --commit belirtilmeli')
  return args
}

/**
 * Başlık satırını ve kolon indekslerini İSİMDEN çözer. Sabit kolon yok:
 * başlık, "modül" VE "konu" içeren ilk satırdır (üstte başlık/boş satır olabilir).
 */
function resolveColumns(row: string[]): {
  map: ColMap
  mapped: string[]
  skipped: string[]
} {
  const map: ColMap = {
    modul: -1,
    altModul: -1,
    ifsEkran: -1,
    konu: -1,
    refDoc: -1,
    refVideo: -1,
  }
  const mapped: string[] = []
  const skipped: string[] = []

  row.forEach((raw, i) => {
    const h = norm(raw)
    if (!h) return
    if (h.includes('alt mod')) {
      if (map.altModul < 0) map.altModul = i
      mapped.push(`[${i}] "${raw}" → altModul`)
    } else if (h.includes('modül') || h.includes('modul')) {
      if (map.modul < 0) map.modul = i
      mapped.push(`[${i}] "${raw}" → modul`)
    } else if (h.includes('ekran')) {
      if (map.ifsEkran < 0) map.ifsEkran = i
      mapped.push(`[${i}] "${raw}" → ifsEkran`)
    } else if (h.includes('video')) {
      if (map.refVideo < 0) map.refVideo = i
      mapped.push(`[${i}] "${raw}" → refVideoUrl`)
    } else if (
      h.includes('doküman') ||
      h.includes('dokuman') ||
      h.includes('referans')
    ) {
      if (map.refDoc < 0) map.refDoc = i
      mapped.push(`[${i}] "${raw}" → refDocUrl`)
    } else if (h.includes('konu')) {
      if (map.konu < 0) map.konu = i
      mapped.push(`[${i}] "${raw}" → konu`)
    } else if (
      h.includes('verildi') ||
      h.includes('uygulamal') ||
      h.includes('örnek') ||
      h.includes('ornek') ||
      h.includes('yorum') ||
      h.includes('proje ekib') ||
      h.includes('danış') ||
      h.includes('danis')
    ) {
      skipped.push(`[${i}] "${raw}" (durum/yorum — import edilmez)`)
    }
    // diğer/boş kolonlar sessizce yok sayılır
  })
  return { map, mapped, skipped }
}

function contentKey(t: {
  modul: string | null
  altModul: string | null
  ifsEkran: string | null
  konu: string
}): string {
  return [t.modul, t.altModul, t.ifsEkran, t.konu]
    .map((v) => norm(v ?? ''))
    .join('')
}

// ════════════════════════════════════════════════════════════ PARSE
function parseSheet(
  sheetName: string,
  aoa: string[][],
  department: string
): SheetResult {
  const courseTitle = `${department} · ${sheetName.trim()}`
  const base: SheetResult = {
    sheetName,
    courseTitle,
    headerRowIndex: null,
    reason: '',
    colMap: {
      modul: -1,
      altModul: -1,
      ifsEkran: -1,
      konu: -1,
      refDoc: -1,
      refVideo: -1,
    },
    mappedCols: [],
    skippedCols: [],
    tasks: [],
  }

  // Başlık satırını bul: "modül" ve "konu" birlikte geçen ilk satır
  let headerRowIndex = -1
  let resolved: ReturnType<typeof resolveColumns> | null = null
  for (let r = 0; r < aoa.length; r++) {
    const res = resolveColumns(aoa[r] ?? [])
    if (res.map.modul >= 0 && res.map.konu >= 0) {
      headerRowIndex = r
      resolved = res
      break
    }
  }

  if (headerRowIndex < 0 || !resolved) {
    base.reason = 'Başlık satırı bulunamadı (Modül + Konu kolonları yok) → sheet atlandı'
    return base
  }

  base.headerRowIndex = headerRowIndex
  base.colMap = resolved.map
  base.mappedCols = resolved.mapped
  base.skippedCols = resolved.skipped
  const m = resolved.map

  // Veri satırları: başlığın altındakiler; yalnız Konu DOLU olanlar
  let order = 0
  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? []
    const konu = cell(row[m.konu])
    if (!konu) continue // boş/trailing satır
    order += 1
    base.tasks.push({
      order,
      modul: m.modul >= 0 ? cell(row[m.modul]) : null,
      altModul: m.altModul >= 0 ? cell(row[m.altModul]) : null,
      ifsEkran: m.ifsEkran >= 0 ? cell(row[m.ifsEkran]) : null,
      konu,
      refDocUrl: m.refDoc >= 0 ? cell(row[m.refDoc]) : null,
      refVideoUrl: m.refVideo >= 0 ? cell(row[m.refVideo]) : null,
    })
  }

  base.reason = `OK (${base.tasks.length} görev)`
  return base
}

// ════════════════════════════════════════════════════════════ REPORT
function printDryRun(
  args: CliArgs,
  sheets: SheetResult[],
  packageTitle: string,
  existing: {
    courseExists: Set<string>
    contentCounts: Map<string, { existing: number }>
  }
) {
  const line = '─'.repeat(70)
  console.log(`\n${line}\nIFS IMPORT — DRY RUN (DB'ye yazılmadı)\n${line}`)
  console.log(`Dosya     : ${args.file}`)
  console.log(`Departman : ${args.department}`)
  console.log(`Paket     : "${packageTitle}" (isIfs=true)`)
  console.log(
    `Dedup     : Course=(isIfs,title) · Package=(isIfs,title) · ` +
      `Content=(courseId, norm[modul,altModul,ifsEkran,Konu]) — order DEĞİL`
  )

  let totalTasks = 0
  let createdCourses = 0
  for (const s of sheets) {
    console.log(`\n${line}\nSHEET: "${s.sheetName}"`)
    if (s.headerRowIndex == null) {
      console.log(`  ⚠ ${s.reason}`)
      continue
    }
    const courseNew = !existing.courseExists.has(norm(s.courseTitle))
    if (courseNew) createdCourses++
    totalTasks += s.tasks.length
    console.log(`  Kurs       : "${s.courseTitle}"  [${courseNew ? 'YENİ' : 'MEVCUT (güncellenecek)'}]`)
    console.log(`  Başlık satırı: index ${s.headerRowIndex}`)
    console.log(`  Görev sayısı : ${s.tasks.length}`)
    console.log(`  Eşlenen kolonlar:`)
    s.mappedCols.forEach((c) => console.log(`     ${c}`))
    if (s.colMap.refVideo < 0) console.log(`     (Video kolonu YOK → refVideoUrl=null)`)
    if (s.skippedCols.length) {
      console.log(`  Atlanan kolonlar (durum/yorum):`)
      s.skippedCols.forEach((c) => console.log(`     ${c}`))
    } else {
      console.log(`  Atlanan kolon: yok`)
    }
    const ec = existing.contentCounts.get(norm(s.courseTitle))
    console.log(
      `  Dedup      : bu kursta mevcut görev = ${ec?.existing ?? 0}; ` +
        `parse edilen = ${s.tasks.length}`
    )
    console.log(`  Örnek görevler (ilk 5):`)
    s.tasks.slice(0, 5).forEach((t) =>
      console.log(
        `     #${t.order} | Modül="${t.modul ?? ''}" / Alt="${t.altModul ?? ''}" / ` +
          `Ekran="${t.ifsEkran ?? ''}" / Konu="${t.konu}" | ` +
          `doc=${t.refDocUrl ? 'var' : '—'} video=${t.refVideoUrl ? 'var' : '—'}`
      )
    )
  }

  console.log(`\n${line}\nÖZET`)
  console.log(`  Sheet (kurs)   : ${sheets.filter((s) => s.headerRowIndex != null).length} (${createdCourses} yeni)`)
  console.log(`  Toplam görev   : ${totalTasks}`)
  console.log(`  Paket          : "${packageTitle}" + ${sheets.filter((s) => s.headerRowIndex != null).length} kurs`)
  console.log(`  Atlanan sheet  : ${sheets.filter((s) => s.headerRowIndex == null).length}`)
  console.log(`${line}\nDRY-RUN: hiçbir şey yazılmadı. Onaylarsanız --commit ile uygulayın.\n`)
}

// ════════════════════════════════════════════════════════════ MAIN
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const department = args.department!.trim()
  const packageTitle = `IFS Geçiş · ${department}`

  // Workbook oku
  const wb = XLSX.readFile(args.file!, { cellDates: false })
  const sheets: SheetResult[] = wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
    })
    return parseSheet(name, aoa, department)
  })

  const valid = sheets.filter((s) => s.headerRowIndex != null && s.tasks.length > 0)

  // DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // Mevcut durum (dry-run raporu + commit dedup için)
    const courseExists = new Set<string>()
    const contentCounts = new Map<string, { existing: number }>()
    for (const s of valid) {
      const course = await prisma.course.findFirst({
        where: { isIfs: true, title: s.courseTitle },
        select: { id: true, _count: { select: { contents: true } } },
      })
      if (course) {
        courseExists.add(norm(s.courseTitle))
        contentCounts.set(norm(s.courseTitle), { existing: course._count.contents })
      }
    }

    if (args.dryRun) {
      printDryRun(args, sheets, packageTitle, { courseExists, contentCounts })
      return
    }

    // ── COMMIT: tek transaction, idempotent upsert ──
    const result = await prisma.$transaction(async (tx) => {
      // Paket (isIfs, title)
      let pkg = await tx.coursePackage.findFirst({
        where: { isIfs: true, name: packageTitle },
        select: { id: true },
      })
      if (!pkg) {
        pkg = await tx.coursePackage.create({
          data: { name: packageTitle, isIfs: true },
          select: { id: true },
        })
      }

      let createdCourses = 0
      let createdContents = 0
      let updatedContents = 0
      let pkgLinks = 0

      for (let si = 0; si < valid.length; si++) {
        const s = valid[si]
        // Course (isIfs, title)
        let course = await tx.course.findFirst({
          where: { isIfs: true, title: s.courseTitle },
          select: { id: true },
        })
        if (!course) {
          course = await tx.course.create({
            data: { title: s.courseTitle, isIfs: true },
            select: { id: true },
          })
          createdCourses++
        }

        // PackageCourse (packageId, courseId) @@unique
        const link = await tx.packageCourse.findUnique({
          where: { packageId_courseId: { packageId: pkg.id, courseId: course.id } },
          select: { id: true },
        })
        if (!link) {
          await tx.packageCourse.create({
            data: { packageId: pkg.id, courseId: course.id, order: si },
          })
          pkgLinks++
        }

        // Mevcut içerikleri stable key ile indeksle
        const existingContents = await tx.content.findMany({
          where: { courseId: course.id },
          select: {
            id: true,
            title: true,
            ifsMeta: { select: { modul: true, altModul: true, ifsEkran: true } },
          },
        })
        const byKey = new Map<string, string>() // key -> contentId
        for (const c of existingContents) {
          byKey.set(
            contentKey({
              modul: c.ifsMeta?.modul ?? null,
              altModul: c.ifsMeta?.altModul ?? null,
              ifsEkran: c.ifsMeta?.ifsEkran ?? null,
              konu: c.title,
            }),
            c.id
          )
        }

        for (const t of s.tasks) {
          const key = contentKey(t)
          const existingId = byKey.get(key)
          if (existingId) {
            await tx.content.update({
              where: { id: existingId },
              data: { title: t.konu, type: 'GOREV', order: t.order, isActive: true },
            })
            await tx.ifsTaskMeta.upsert({
              where: { contentId: existingId },
              create: {
                contentId: existingId,
                modul: t.modul,
                altModul: t.altModul,
                ifsEkran: t.ifsEkran,
                refDocUrl: t.refDocUrl,
                refVideoUrl: t.refVideoUrl,
              },
              update: {
                modul: t.modul,
                altModul: t.altModul,
                ifsEkran: t.ifsEkran,
                refDocUrl: t.refDocUrl,
                refVideoUrl: t.refVideoUrl,
              },
            })
            updatedContents++
          } else {
            const created = await tx.content.create({
              data: {
                courseId: course.id,
                title: t.konu,
                type: 'GOREV',
                order: t.order,
                ifsMeta: {
                  create: {
                    modul: t.modul,
                    altModul: t.altModul,
                    ifsEkran: t.ifsEkran,
                    refDocUrl: t.refDocUrl,
                    refVideoUrl: t.refVideoUrl,
                  },
                },
              },
              select: { id: true },
            })
            byKey.set(key, created.id)
            createdContents++
          }
        }
      }

      return { createdCourses, createdContents, updatedContents, pkgLinks, packageId: pkg.id }
    })

    console.log(`\nIFS IMPORT — COMMIT OK`)
    console.log(`  Paket           : "${packageTitle}" (${result.packageId})`)
    console.log(`  Yeni kurs       : ${result.createdCourses}`)
    console.log(`  Pakete eklenen  : ${result.pkgLinks} kurs`)
    console.log(`  Yeni görev      : ${result.createdContents}`)
    console.log(`  Güncellenen görev: ${result.updatedContents}`)
    console.log(`  (DepartmentPackage / dueDate YAPILMADI — admin UI'dan)\n`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('HATA:', e)
  process.exit(1)
})
