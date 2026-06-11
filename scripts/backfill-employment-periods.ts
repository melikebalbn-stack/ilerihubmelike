/**
 * PR-A — EmploymentPeriod backfill.
 *
 * Her Personnel için TEK EmploymentPeriod oluşturur (mevcut tek-dönem alanlarını
 * birebir kopyalar — DEĞER UYDURMAZ):
 *   girisTarihi = iseGirisTarihi
 *   cikisTarihi = exitDate
 *   exit* + exitRecordedById/At  KOPYALANIR
 *   entryRecordedById/At = null (Personnel'de giriş-kaydeden alanı yok)
 *
 * IDEMPOTENT: periyodu zaten olan personeli atlar (re-run güvenli).
 * Anomalileri DEĞİŞTİRMEZ; manuel inceleme listesi olarak raporlar.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-employment-periods.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-employment-periods.ts --commit
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

type Mode = 'dry-run' | 'commit'

function parseMode(argv: string[]): Mode {
  const dry = argv.includes('--dry-run')
  const commit = argv.includes('--commit')
  if (dry && commit) throw new Error('--dry-run ve --commit aynı anda kullanılamaz')
  if (!dry && !commit) throw new Error('--dry-run veya --commit belirtilmeli')
  return dry ? 'dry-run' : 'commit'
}

async function main() {
  const mode = parseMode(process.argv.slice(2))

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // Hedef DB teyidi
    const dbName = (process.env.DATABASE_URL || '').replace(/.*\/([^?]+).*/, '$1')
    console.log(`Mod: ${mode}  |  Hedef DB: ${dbName}`)

    const personnel = await prisma.personnel.findMany({
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        aktif: true,
        iseGirisTarihi: true,
        exitDate: true,
        exitParty: true,
        exitCode: true,
        exitReason: true,
        exitRootCause: true,
        exitTurnoverType: true,
        exitGeneralNote: true,
        exitRecordedById: true,
        exitRecordedAt: true,
      },
    })

    // Idempotency: hâlihazırda periyodu olan personelId'ler
    const existing = await prisma.employmentPeriod.findMany({
      select: { personnelId: true },
    })
    const havePeriod = new Set(existing.map((e) => e.personnelId))

    const toCreate: Array<{
      personnelId: string
      girisTarihi: Date
      cikisTarihi: Date | null
      exitParty: string | null
      exitCode: string | null
      exitReason: string | null
      exitRootCause: string | null
      exitTurnoverType: string | null
      exitGeneralNote: string | null
      exitRecordedById: string | null
      exitRecordedAt: Date | null
    }> = []

    const anomalies: Array<{ id: string; sicilNo: string | null; adSoyad: string; reason: string }> = []
    let skippedExisting = 0
    let skippedNoEntryDate = 0

    for (const p of personnel) {
      if (havePeriod.has(p.id)) {
        skippedExisting++
        continue
      }

      // Anomali tespiti (DEĞİŞTİRME — sadece raporla)
      if (!p.iseGirisTarihi) {
        anomalies.push({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, reason: 'iseGirisTarihi NULL (periyot oluşturulamadı — atlandı)' })
        skippedNoEntryDate++
        continue // girisTarihi NOT NULL → bu kaydı oluşturamayız
      }
      if (p.aktif === false && p.exitDate == null) {
        anomalies.push({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, reason: 'aktif=false ama exitDate NULL (açık dönem olarak kopyalandı)' })
      }
      if (p.aktif === true && p.exitDate != null) {
        anomalies.push({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, reason: 'aktif=true ama exitDate DOLU (kapalı dönem olarak kopyalandı)' })
      }

      toCreate.push({
        personnelId: p.id,
        girisTarihi: p.iseGirisTarihi,
        cikisTarihi: p.exitDate ?? null,
        exitParty: p.exitParty ?? null,
        exitCode: p.exitCode ?? null,
        exitReason: p.exitReason ?? null,
        exitRootCause: p.exitRootCause ?? null,
        exitTurnoverType: p.exitTurnoverType ?? null,
        exitGeneralNote: p.exitGeneralNote ?? null,
        exitRecordedById: p.exitRecordedById ?? null,
        exitRecordedAt: p.exitRecordedAt ?? null,
      })
    }

    // ── Rapor ──
    const line = '─'.repeat(64)
    console.log(`\n${line}`)
    console.log(`Toplam Personnel        : ${personnel.length}`)
    console.log(`Zaten periyodu var (atla): ${skippedExisting}`)
    console.log(`Oluşturulacak periyot    : ${toCreate.length}`)
    console.log(`  - açık dönem (cikisTarihi null): ${toCreate.filter((t) => t.cikisTarihi == null).length}`)
    console.log(`  - kapalı dönem (cikisTarihi dolu): ${toCreate.filter((t) => t.cikisTarihi != null).length}`)
    console.log(`iseGirisTarihi NULL (atlandı): ${skippedNoEntryDate}`)
    console.log(`${line}`)
    console.log(`ANOMALİLER (manuel inceleme — ${anomalies.length} kayıt):`)
    if (anomalies.length === 0) {
      console.log('  (yok)')
    } else {
      for (const a of anomalies) {
        console.log(`  [${a.sicilNo ?? '—'}] ${a.adSoyad}  →  ${a.reason}`)
      }
    }
    console.log(line)

    if (mode === 'dry-run') {
      console.log('DRY-RUN: hiçbir şey yazılmadı. Onaylarsanız --commit ile uygulayın.')
      return
    }

    // ── COMMIT ──
    const result = await prisma.employmentPeriod.createMany({ data: toCreate })
    console.log(`COMMIT: ${result.count} EmploymentPeriod oluşturuldu.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('HATA:', e)
  process.exit(1)
})
