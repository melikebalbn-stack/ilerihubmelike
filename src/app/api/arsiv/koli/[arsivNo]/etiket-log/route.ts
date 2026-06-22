/**
 * POST /api/arsiv/koli/[arsivNo]/etiket-log
 *   Etiket basma işlemi audit logu (ISO 27001 EtiketBas).
 *
 * - Auth + bolum yetki kontrolü
 * - Aktivite log: 'EtiketBas' (koliTipi='Ana')
 * - Detay: { arsivNo }
 * - Response: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  canAccessBolum,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from '@/lib/arsiv-auth'
import {
  logArsivAktivite,
  getClientIp,
  getUserAgent,
} from '@/lib/arsiv-aktivite'

export const dynamic = 'force-dynamic'

const ARSIV_NO_REGEX = /^ARK-[A-Z]{3}-[0-9]{4}-[0-9]{3}$/

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ arsivNo: string }> }
) {
  const { arsivNo } = await params
  if (!ARSIV_NO_REGEX.test(arsivNo)) {
    return badRequest(`Geçersiz arşiv numarası formatı: ${arsivNo}`)
  }

  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const koli = await prisma.arsivKoli.findUnique({
    where: { arsivNo },
    select: { id: true, bolumId: true },
  })
  if (!koli) return notFound('Koli')

  if (!canAccessBolum(ctx, koli.bolumId)) {
    return forbidden('Bu koliye etiket basma yetkiniz yok')
  }

  await logArsivAktivite(prisma, {
    userId: ctx.userId,
    islemTuru: 'EtiketBas',
    koliTipi: 'Ana',
    koliId: koli.id,
    detay: { arsivNo },
    ipAdresi: getClientIp(req),
    kullaniciAjan: getUserAgent(req),
  })

  return NextResponse.json({ success: true })
}
