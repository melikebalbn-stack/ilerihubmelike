import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiForbidden, apiBadRequest } from '@/lib/api-response'

// GET /api/ipro/kiosk/acik-is?tezgahId=&personnelId= — operatörün bu tezgahta AÇIK işi var mı
// (devam ekranı). Dönüş: { acik: {...} | null }.
export async function GET(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const tezgahId = req.nextUrl.searchParams.get('tezgahId')
  const personnelId = req.nextUrl.searchParams.get('personnelId')
  if (!tezgahId || !personnelId) return apiBadRequest('tezgahId ve personnelId gerekli')

  if (!kiosk.tezgahlar.some((kt) => kt.tezgah.id === tezgahId)) return apiForbidden()

  const acik = await prisma.iproProductionLog.findFirst({
    where: { tezgahId, personnelId, durum: 'ACIK' },
    select: {
      id: true,
      ifsOrderNo: true,
      ifsOperationNo: true,
      ifsOperationId: true,
      baslatildiAt: true,
      plcSayacBaslangic: true,
    },
    orderBy: { baslatildiAt: 'desc' },
  })

  return apiSuccess({ acik })
}
