/**
 * GET /api/arsiv/bolum
 * - Tüm aktif kullanıcılar erişebilir (form dropdown'ları için)
 * - Default: sadece aktifMi=true bolum'lar
 * - ?aktif=false ile pasif olanlar dahil edilir (SUPER_ADMIN için yararlı)
 * - Sıralama: siraNo ASC, ad ASC
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getArsivUserContext, unauthorized } from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)
  const includePasif = searchParams.get('aktif') === 'false'

  const items = await prisma.arsivBolum.findMany({
    where: includePasif ? {} : { aktifMi: true },
    select: {
      id: true,
      ad: true,
      kod: true,
      renkHex: true,
      siraNo: true,
      aktifMi: true,
    },
    orderBy: [{ siraNo: 'asc' }, { ad: 'asc' }],
  })

  return NextResponse.json({ items })
}
