/**
 * Kalite uygunsuzluk numarası — atomik tek kesintisiz seri (KAL-KYT-15 Bölüm 2).
 *
 * rma-no.ts deseni; FARKLAR:
 *   - Kilit adı ayrı: hashtext('kyt15_no') — RMA serisiyle çakışmasın.
 *   - Seed YOK: seri 1'den başlar (RMA 3622'den devam ediyordu). Yıl/prefix yok.
 *
 * Race-safe: pg_advisory_xact_lock(hashtext('kyt15_no')) ile concurrent POST'lar serialize.
 * Kayıt oluşturma ile AYNI $transaction içinde çağrılmalı (tx parametresi geç).
 */

import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function generateNextUygunsuzlukNo(tx?: TxClient): Promise<number> {
  const run = async (client: TxClient | typeof prisma): Promise<number> => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('kyt15_no'))`

    const rows = await client.$queryRaw<{ next: bigint }[]>`
      SELECT COALESCE(MAX("no"), 0) + 1 AS next FROM "KaliteUygunsuzluk"
    `
    return Number(rows[0].next)
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
