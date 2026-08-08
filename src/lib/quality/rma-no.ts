/**
 * RMA/SMA iade numarası — atomik tek kesintisiz seri (KAL-KYT-16).
 *
 * quality-report-no.ts deseni; FARKLAR:
 *   - Yıl bazlı DEĞİL: tek kesintisiz seri (RMA ve SMA AYNI seriyi paylaşır).
 *   - Seed: mevcut en büyük no yoksa 3622 → +1 = 3623'ten başlar.
 *
 * Race-safe: pg_advisory_xact_lock(hashtext('rma_no')) ile concurrent POST'lar serialize.
 * Kayıt oluşturma ile AYNI $transaction içinde çağrılmalı (tx parametresi geç).
 */

import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function generateNextRmaNo(tx?: TxClient): Promise<number> {
  const run = async (client: TxClient | typeof prisma): Promise<number> => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rma_no'))`

    const rows = await client.$queryRaw<{ next: bigint }[]>`
      SELECT COALESCE(MAX("no"), 3622) + 1 AS next FROM "RmaKayit"
    `
    return Number(rows[0].next)
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
