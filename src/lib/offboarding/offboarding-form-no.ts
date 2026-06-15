/**
 * Offboarding form number atomic sequence (OFFB-2)
 *
 * Format: ZI-{year}-{seq:5digits} → 'ZI-2026-00001'
 *
 * Race-safe: pg_advisory_xact_lock(hashtext('offboarding-formno-<year>'))
 * ile yıl bazlı concurrent POST'lar serialize olur (KALITE-2
 * generateNextReportNo pattern'i ile birebir uyumlu).
 *
 * Çağırıcı zaten bir transaction'da ise tx parametresini geçirir; advisory
 * lock aynı tx'e eklenir (transaction commit'te otomatik release). tx
 * verilmezse helper kendi tx'ini açar.
 */

import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function generateNextFormNo(
  year: number,
  tx?: TxClient,
): Promise<string> {
  const run = async (client: TxClient | typeof prisma) => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`offboarding-formno-${year}`}))`

    const prefix = `ZI-${year}-`
    const last = await client.offboardingForm.findFirst({
      where: { formNo: { startsWith: prefix } },
      orderBy: { formNo: 'desc' },
      select: { formNo: true },
    })

    const lastSeq = last ? parseInt(last.formNo.slice(prefix.length), 10) : 0
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
    return `${prefix}${String(next).padStart(5, '0')}`
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
