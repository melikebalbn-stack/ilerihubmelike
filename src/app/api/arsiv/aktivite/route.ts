/**
 * GET /api/arsiv/aktivite?koliId=X&limit=N
 *   Bir ANA koli'ye ait + onun bağlı tüm alt kolilerine ait aktivite log'unu döner.
 *
 * Yetki: ana koli'nin bolum'u kullanıcının bolum'u olmalı; SUPER_ADMIN tümü.
 * Default limit: 50, max 200.
 *
 * NOT: Eski sürüm `altKoliId` query parametresini de destekliyordu, ama
 * koliTipi ayrımı yapmadığı için cross-koli leak'e neden oluyordu (ana koli
 * id=2 ile alt koli id=2 aynı namespace'te birleşiyordu). Yeni sürüm
 * sadece `koliId`'yi (ana koli id'si) kabul ediyor; altKoli filtresi
 * kullanılmıyor — frontend tek kullanım yeri (aktivite-log-timeline) zaten
 * sadece `koliId` gönderiyor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  canAccessBolum,
} from '@/lib/arsiv-auth'
import { toJSONSafe } from '@/lib/arsiv-serialize'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)
  const koliIdParam = searchParams.get('koliId')

  const limitRaw = Number(searchParams.get('limit') ?? '50')
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(200, limitRaw) : 50

  if (!koliIdParam) {
    return badRequest('koliId zorunlu')
  }

  let anaKoliId: bigint
  try {
    anaKoliId = BigInt(koliIdParam)
  } catch {
    return badRequest(`koliId geçersiz: ${koliIdParam}`)
  }

  const anaKoli = await prisma.arsivKoli.findUnique({
    where: { id: anaKoliId },
    select: {
      id: true,
      bolumId: true,
      altKoliler: { select: { id: true } },
    },
  })

  if (!anaKoli) return notFound('Koli')

  if (!canAccessBolum(ctx, anaKoli.bolumId)) {
    return forbidden("Bu koliye ait log'u göremezsiniz")
  }

  const altKoliIds = anaKoli.altKoliler.map((a) => a.id)

  const items = await prisma.arsivAktiviteLog.findMany({
    where: {
      OR: [
        { koliTipi: 'Ana', koliId: anaKoli.id },
        { koliTipi: 'Alt', koliId: { in: altKoliIds } },
      ],
    },
    include: {
      kullanici: { select: { id: true, name: true, email: true } },
    },
    orderBy: { tarih: 'desc' },
    take: limit,
  })

  return NextResponse.json({ items: toJSONSafe(items) })
}
