// PR-PERSONNEL-DEPARTMENT-HISTORY: Eşleşen 22 transferi DB'ye yaz.
//
// /tmp/historical-transfers-matched.json'dan okur (match scripti üretmiş olmalı).
// Her transfer için PersonnelDepartmentTransfer kaydı + tek bulk audit log
// (PERSONNEL_DEPARTMENT_TRANSFER_BULK_IMPORT). isHistorical=true,
// form alanları (talep/onay) null. transferTarihi varsa Date, yoksa null.
//
// Personnel.bolum GÜNCELLENMEZ — historical bir kaydı current state için
// kanıt değil, sadece geçmiş audit. Tüm güncel bölüm bilgisi Excel'in son
// state'i değil, ILERIHub'taki mevcut Personnel.bolum.
//
// Kullanım: npx tsx --env-file=.env scripts/import-historical-transfers.ts

import fs from 'fs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface MatchedEntry {
  excel: {
    adSoyad: string
    transferEdenBolum: string
    transferEdilenBolum: string
    transferTarihi: string | null
  }
  personnelId: string
  personnelAdSoyad: string
  personnelSicilNo: string
  aktif: boolean
  currentBolum: string | null
  method: string
}

interface UnmatchedEntry {
  excel: MatchedEntry['excel']
  reason: string
}

async function main() {
  const raw = JSON.parse(fs.readFileSync('/tmp/historical-transfers-matched.json', 'utf-8'))
  const matched: MatchedEntry[] = raw.matched
  const unmatched: UnmatchedEntry[] = raw.unmatched

  console.log(`\nImport edilecek: ${matched.length} kayıt`)
  console.log(`Atlanan (DB'de yok): ${unmatched.length} kayıt`)

  // Halihazırda historical kayıt var mı? Idempotency check
  const existing = await prisma.personnelDepartmentTransfer.count({
    where: { isHistorical: true },
  })
  if (existing > 0) {
    console.error(
      `\n❌ ABORT: DB'de zaten ${existing} historical kayıt var. Yeniden import etmeyin.\n` +
        `Devam etmek için önce mevcutları silin (kapsam dışı işlem).`
    )
    await prisma.$disconnect()
    await pool.end()
    process.exit(2)
  }

  const actor = await prisma.user.findUnique({
    where: { email: 'melih.dilben@ilerigroup.com' },
    select: { id: true, email: true, name: true },
  })

  console.log(`Actor: ${actor?.email ?? '(bulunamadı)'}`)

  const result = await prisma.$transaction(async (tx) => {
    const created: { id: string; personnelName: string }[] = []
    for (const m of matched) {
      const transferTarihi = m.excel.transferTarihi ? new Date(m.excel.transferTarihi) : null

      const transfer = await tx.personnelDepartmentTransfer.create({
        data: {
          personnelId: m.personnelId,
          transferEdenBolum: m.excel.transferEdenBolum,
          transferEdilenBolum: m.excel.transferEdilenBolum,
          transferTarihi,
          gerekceler: [],
          isHistorical: true,
          kayitEdenId: actor?.id ?? null,
          // talepTarihi, talepEden, isgOnayi, doktorOnayi → null (historical)
        },
      })
      created.push({ id: transfer.id, personnelName: m.personnelAdSoyad })
    }

    if (!actor) {
      throw new Error(
        "Audit log için actor (melih.dilben@ilerigroup.com) bulunamadı. Transaction rollback edildi."
      )
    }

    await tx.permissionAuditLog.create({
      data: {
        action: 'PERSONNEL_DEPARTMENT_TRANSFER_BULK_IMPORT',
        actorId: actor.id,
        targetType: 'PERSONNEL',
        targetId: 'BULK',
        details: {
          source: 'İK Excel — Bölüm Değiştiren Personel Listesi',
          importedCount: created.length,
          skippedCount: unmatched.length,
          skippedNames: unmatched.map((u) => u.excel.adSoyad),
          dateRange: '2015-2026',
          note: 'Tüm kayıtlar isHistorical=true. talepTarihi/talepEden/isgOnayi/doktorOnayi null.',
          actorEmail: actor.email,
          actorName: actor.name,
        },
      },
    })

    return created
  })

  console.log(`\n✅ ${result.length} transfer import edildi.`)
  console.log(`Audit log: PERSONNEL_DEPARTMENT_TRANSFER_BULK_IMPORT (actor=${actor?.email})`)

  // Eşleşmeyenler CSV
  const csvLines = [
    'adSoyad,transferEdenBolum,transferEdilenBolum,transferTarihi',
    ...unmatched.map((u) => {
      const tarih = u.excel.transferTarihi
        ? new Date(u.excel.transferTarihi).toLocaleDateString('tr-TR')
        : ''
      return [u.excel.adSoyad, u.excel.transferEdenBolum, u.excel.transferEdilenBolum, tarih]
        .map((v) => `"${(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    }),
  ]
  fs.writeFileSync('/tmp/historical-transfers-unmatched.csv', csvLines.join('\n'))
  console.log(`Eşleşmeyenler: /tmp/historical-transfers-unmatched.csv (${unmatched.length} satır)`)

  await prisma.$disconnect()
  await pool.end()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  await pool.end().catch(() => {})
  process.exit(1)
})
