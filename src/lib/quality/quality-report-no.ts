/**
 * Quality report number atomic sequence (KALITE-2)
 *
 * Format: OR-{year}-{seq:5digits} → 'OR-2026-00001'
 *
 * Race-safe: pg_advisory_xact_lock(hashtext('quality_report_no_<year>'))
 * ile yıl bazlı concurrent POST'lar serialize olur (akademi attempt finalize
 * pattern'i ile uyumlu).
 *
 * Çağırıcı kendi $transaction'ında bunu kullanmamalı — bu helper kendi
 * tx'ini açar; sonuçta dönen string ile MeasurementReport.create yapılır.
 *
 * Eğer çağırıcı zaten bir transaction'da ise, tx parametresini geçirerek
 * advisory lock'u aynı tx'e ekleyebilir.
 */

import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function generateNextReportNo(
  year: number,
  tx?: TxClient,
): Promise<string> {
  const run = async (client: TxClient | typeof prisma) => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quality_report_no_${year}`}))`

    const prefix = `OR-${year}-`
    const last = await client.measurementReport.findFirst({
      where: { reportNo: { startsWith: prefix } },
      orderBy: { reportNo: 'desc' },
      select: { reportNo: true },
    })

    const lastSeq = last ? parseInt(last.reportNo.slice(prefix.length), 10) : 0
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
    return `${prefix}${String(next).padStart(5, '0')}`
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
