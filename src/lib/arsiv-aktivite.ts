/**
 * Arşiv modülü aktivite log helper'ı.
 *
 * ISO 27001 audit gerekçesi ile her CUD işlemi loglanır.
 * Helper transaction-aware: hem ana prisma client hem de
 * $transaction içinden çağrılabilir.
 *
 * Convention:
 *   - Ana koli aksiyonu  : koliId = ana.id,  koliTipi = 'Ana'
 *   - Alt koli aksiyonu  : koliId = alt.id,  koliTipi = 'Alt'
 *                          detay = { anaKoliId: bigint, anaArsivNo: string }
 *   - Toplu/global aksiyon: koliId = null,    koliTipi = null
 */

import { Prisma } from '@/generated/prisma'
import type {
  PrismaClient,
  ArsivIslemTuru,
  ArsivKoliTipi,
} from '@/generated/prisma'
import type { NextRequest } from 'next/server'

// Helper hem ana prisma client'ta hem de $transaction içinden çağrılabilir.
type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient

export type ArsivLogParams = {
  userId: string
  islemTuru: ArsivIslemTuru
  koliId?: bigint | null
  koliTipi?: ArsivKoliTipi | null
  detay?: Record<string, unknown>
  ipAdresi?: string | null
  kullaniciAjan?: string | null
}

export async function logArsivAktivite(
  client: PrismaTxOrClient,
  p: ArsivLogParams
): Promise<void> {
  await client.arsivAktiviteLog.create({
    data: {
      kullaniciId: p.userId,
      islemTuru: p.islemTuru,
      koliId: p.koliId ?? null,
      koliTipi: p.koliTipi ?? null,
      detay: p.detay ? (p.detay as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAdresi: p.ipAdresi ?? null,
      kullaniciAjan: p.kullaniciAjan ?? null,
    },
  })
}

/** İstemci IP'sini header'lardan çıkarır. */
export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? null
}

export function getUserAgent(req: NextRequest): string | null {
  return req.headers.get('user-agent')?.slice(0, 500) ?? null
}
