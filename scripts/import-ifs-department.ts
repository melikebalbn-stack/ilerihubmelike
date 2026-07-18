/**
 * IFS departman import / reconcile script (xlsx).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-ifs-department.ts \
 *     --dept "Depo-Envanter" --file "scripts/import-data/DEPO ENVANTER EĞİTİM DEĞERLENDİRME.xlsx" --dry-run
 *
 *   (bayraksız = gerçek uygular)
 *
 * Excel sözleşmesi:
 *   - Her sheet = bir ALAN (Course). Sheet adı = alan adı. İlk sheet sortOrder 1.
 *   - Her satırdaki "Konu" = bir görev (Content type=GOREV). Boş Konu satırları atlanır.
 *   - "Modül" / "Alt Modül" / "Kullanılan IFS Ekranı" → IfsTaskMeta(modul/altModul/ifsEkran).
 *   - "Referans Eğitim Dokümanı" / "Referans Eğitim Videosu" doluysa → refDocUrl / refVideoUrl.
 *   - Değerlendirme sütunları (Eğitimi Verildi / Uygulamalı / Örnek Yaptı / yorumlar)
 *     ŞABLON değil RUNTIME verisidir; IMPORT EDİLMEZ.
 *
 * Davranış — idempotent RECONCILE (atomik, tek $transaction):
 *   - Departman (CoursePackage isIfs) yoksa oluşturulur.
 *   - Paketin ALANLARI Excel ile eşitlenir: Excel'dekiler create/update, görevleri
 *     senkronlanır; Excel'de OLMAYAN alanlar (yanlış eklenenler) görevleriyle SİLİNİR.
 *   - KORUNUR: paket kapak görseli (coverImageUrl) + PackageReferenceDoc (PDF) +
 *     paket metadata (name dışı). Yalnız Course + görev (Content/IfsTaskMeta) reconcile.
 *
 * Adlandırma (display helper'larıyla uyumlu — src/lib/akademi-ifs.ts):
 *   - Paket adı   = <dept>                  → stripDeptPrefix → <dept>
 *   - Kurs başlığı = "<dept> · <sheet>"     → stripAreaPrefix → <sheet>
 *
 * Prisma: ../src/generated/prisma + PrismaPg adapter (referans:
 * scripts/import-quality-templates.ts).
 */
import 'dotenv/config'
import * as fs from 'node:fs'
import * as XLSX from 'xlsx'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

// ════════════════════════════════════════════════════════════ TYPES
interface CliArgs {
  dept: string
  /** Paket adı (lookup/create). Verilmezse dept'e eşit. Mevcut paket adı kurs
   *  prefix'inden farklıysa kullanılır (ör. paket "IFS · Depo-Envanter",
   *  kurs prefix "Depo-Envanter · "). */
  pkgName: string
  file: string
  dryRun: boolean
}

interface TaskInput {
  title: string
  modul: string | null
  altModul: string | null
  ifsEkran: string | null
  refDocUrl: string | null
  refVideoUrl: string | null
  order: number
}

interface AreaInput {
  sheetName: string
  courseTitle: string
  sortOrder: number
  tasks: TaskInput[]
}

// ════════════════════════════════════════════════════════════ HELPERS
function parseArgs(argv: string[]): CliArgs {
  let dept = ''
  let pkgName = ''
  let file = ''
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dept') dept = argv[++i] ?? ''
    else if (a === '--package') pkgName = argv[++i] ?? ''
    else if (a === '--file') file = argv[++i] ?? ''
    else if (a === '--dry-run') dryRun = true
    else if (!dept) dept = a
    else if (!file) file = a
  }
  if (!dept || !file) {
    throw new Error(
      'Kullanım: --dept "<KursPrefix>" [--package "<PaketAdı>"] --file "<excel.xlsx>" [--dry-run]'
    )
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Excel bulunamadı: ${file}`)
  }
  // Paket adı verilmezse dept ile aynı (geriye uyum).
  return { dept, pkgName: pkgName || dept, file, dryRun }
}

/** Boş/whitespace → null; aksi halde trim'li string. */
const str = (v: unknown): string | null => {
  const s = String(v ?? '').trim()
  return s.length ? s : null
}

/** Header anahtarlarındaki sondaki/baştaki boşlukları kırparak normalize eder. */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(row)) out[k.trim()] = row[k]
  return out
}

function parseExcel(file: string, dept: string): AreaInput[] {
  const wb = XLSX.readFile(file)
  return wb.SheetNames.map((sheetName, idx) => {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: null,
    }) as Record<string, unknown>[]
    const tasks: TaskInput[] = []
    const seen = new Set<string>()
    for (const raw of data) {
      const r = normalizeRow(raw)
      const title = str(r['Konu'])
      if (!title) continue // boş Konu = ayraç satırı, atla
      if (seen.has(title)) continue // aynı sheet içinde Konu tekrarını dedupe et
      seen.add(title)
      tasks.push({
        title,
        modul: str(r['Modül']),
        altModul: str(r['Alt Modül']),
        ifsEkran: str(r['Kullanılan IFS Ekranı']),
        refDocUrl: str(r['Referans Eğitim Dokümanı']),
        refVideoUrl: str(r['Referans Eğitim Videosu']),
        order: tasks.length + 1,
      })
    }
    return {
      sheetName: sheetName.trim(),
      courseTitle: `${dept} · ${sheetName.trim()}`,
      sortOrder: idx + 1,
      tasks,
    }
  })
}

// ════════════════════════════════════════════════════════════ MAIN
async function main() {
  const { dept, pkgName, file, dryRun } = parseArgs(process.argv.slice(2))
  const areas = parseExcel(file, dept)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  // Hedeflenen DB'yi göster (yanlışlıkla prod'a koşmayı önler).
  const dbName = (process.env.DATABASE_URL || '').split('/').pop()?.split('?')[0]
  console.log('════════════════════════════════════════════════')
  console.log(`IFS import/reconcile  —  ${dryRun ? 'DRY-RUN (yazma yok)' : 'COMMIT (gerçek)'}`)
  console.log(`Paket adı : ${pkgName}`)
  console.log(`Kurs prefix: ${dept} ·`)
  console.log(`Excel     : ${file}`)
  console.log(`Veritabanı: ${dbName}`)
  console.log('════════════════════════════════════════════════')
  console.log(`Excel'den okunan: ${areas.length} alan`)
  for (const a of areas) {
    console.log(`  - ${a.sheetName} (sortOrder ${a.sortOrder}) → ${a.tasks.length} görev  [kurs: "${a.courseTitle}"]`)
  }

  try {
    // ── Mevcut durum (read-only; plan + reconcile için) ──
    const pkg = await prisma.coursePackage.findFirst({
      where: { name: pkgName, isIfs: true },
      include: {
        packageCourses: {
          include: {
            course: {
              include: {
                contents: { where: { type: 'GOREV' }, select: { id: true, title: true } },
                _count: { select: { packageCourses: true } },
              },
            },
          },
        },
      },
    })

    const desiredCourseTitles = new Set(areas.map((a) => a.courseTitle))
    const existingLinks = pkg?.packageCourses ?? []

    // Silinecek alanlar = pakette olup Excel'de olmayanlar
    const toDeleteAreas = existingLinks.filter(
      (l) => !desiredCourseTitles.has(l.course.title)
    )
    const deleteTaskCount = toDeleteAreas.reduce(
      (s, l) => s + l.course.contents.length,
      0
    )

    // ── PLAN ÖZETİ ──
    console.log('\n── PLAN ──')
    console.log(`Paket: ${pkg ? `mevcut (id=${pkg.id})` : 'YOK → oluşturulacak'}`)
    let createAreas = 0
    let updateAreas = 0
    for (const a of areas) {
      const ex = existingLinks.find((l) => l.course.title === a.courseTitle)
      if (ex) {
        updateAreas++
        const exTitles = new Set(ex.course.contents.map((c) => c.title))
        const desiredTitles = new Set(a.tasks.map((t) => t.title))
        const addT = a.tasks.filter((t) => !exTitles.has(t.title)).length
        const delT = ex.course.contents.filter((c) => !desiredTitles.has(c.title)).length
        console.log(
          `  ~ GÜNCELLE alan "${a.sheetName}": +${addT} görev ekle, ${a.tasks.length - addT} güncelle, -${delT} görev sil`
        )
      } else {
        createAreas++
        console.log(`  + OLUŞTUR alan "${a.sheetName}": ${a.tasks.length} görev`)
      }
    }
    if (toDeleteAreas.length) {
      for (const l of toDeleteAreas) {
        const shared = l.course._count.packageCourses > 1
        console.log(
          `  - SİL alan "${l.course.title}": ${l.course.contents.length} görev ${shared ? '(başka pakete de bağlı → yalnız bağlantı kaldırılır)' : '(kurs silinir)'}`
        )
      }
    }
    console.log(
      `\nÖZET: alan +${createAreas} / ~${updateAreas} / -${toDeleteAreas.length}` +
        `  |  SİLİNECEK görev (alan silmeden): ${deleteTaskCount}`
    )

    if (dryRun) {
      console.log('\n[DRY-RUN] Hiçbir yazma yapılmadı.')
      return
    }

    // ── COMMIT (atomik) ──
    await prisma.$transaction(async (tx) => {
      // Paket: yoksa oluştur. VARSA metadata/coverImageUrl/referenceDocs'a DOKUNMA.
      let pkgId = pkg?.id
      if (!pkgId) {
        const created = await tx.coursePackage.create({
          data: { name: pkgName, isIfs: true, isActive: true },
        })
        pkgId = created.id
      }

      // 1) Excel'de OLMAYAN alanları sil (görevleriyle birlikte — cascade).
      for (const l of toDeleteAreas) {
        if (l.course._count.packageCourses > 1) {
          // Kurs başka pakete de bağlı → yalnız bu paket bağlantısını kaldır.
          await tx.packageCourse.delete({ where: { id: l.id } })
        } else {
          // Orphan IFS kursu → kursu sil (Content + IfsTaskMeta + PackageCourse cascade).
          await tx.course.delete({ where: { id: l.courseId } })
        }
      }

      // 2) Excel alanlarını upsert + görevleri reconcile.
      for (const a of areas) {
        const existing = existingLinks.find((l) => l.course.title === a.courseTitle)
        let courseId: string
        if (existing) {
          courseId = existing.courseId
          await tx.course.update({
            where: { id: courseId },
            data: { isActive: true, isIfs: true },
          })
        } else {
          const c = await tx.course.create({
            data: { title: a.courseTitle, isIfs: true, isActive: true },
          })
          courseId = c.id
        }

        // Paket-kurs bağlantısı + sortOrder.
        await tx.packageCourse.upsert({
          where: { packageId_courseId: { packageId: pkgId, courseId } },
          create: { packageId: pkgId, courseId, order: a.sortOrder },
          update: { order: a.sortOrder },
        })

        // Mevcut GOREV görevleri.
        const existingContents = await tx.content.findMany({
          where: { courseId, type: 'GOREV' },
          select: { id: true, title: true },
        })
        const desiredTitles = new Set(a.tasks.map((t) => t.title))

        // Excel'de olmayan görevleri sil (IfsTaskMeta cascade).
        for (const c of existingContents) {
          if (!desiredTitles.has(c.title)) {
            await tx.content.delete({ where: { id: c.id } })
          }
        }

        // Görevleri upsert + IfsTaskMeta.
        for (const t of a.tasks) {
          const ex = existingContents.find((c) => c.title === t.title)
          let contentId: string
          if (ex) {
            contentId = ex.id
            await tx.content.update({
              where: { id: contentId },
              data: { order: t.order, isActive: true },
            })
          } else {
            const c = await tx.content.create({
              data: {
                courseId,
                title: t.title,
                type: 'GOREV',
                order: t.order,
                isActive: true,
              },
            })
            contentId = c.id
          }
          await tx.ifsTaskMeta.upsert({
            where: { contentId },
            create: {
              contentId,
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
        }
      }
    })

    // ── Sonuç sayıları ──
    const after = await prisma.coursePackage.findFirst({
      where: { name: pkgName, isIfs: true },
      include: {
        packageCourses: {
          orderBy: { order: 'asc' },
          include: {
            course: {
              include: { _count: { select: { contents: true } } },
            },
          },
        },
      },
    })
    console.log('\n── SONUÇ ──')
    console.log(`Paket: ${after?.name} (isIfs=${after?.isIfs}, id=${after?.id})`)
    console.log(`Alan sayısı: ${after?.packageCourses.length}`)
    for (const l of after?.packageCourses ?? []) {
      console.log(
        `  [${l.order}] ${l.course.title} → ${l.course._count.contents} görev`
      )
    }
    console.log('\n✅ Reconcile tamamlandı (atomik).')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('❌ HATA:', e instanceof Error ? e.message : e)
  process.exit(1)
})
