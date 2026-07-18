import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiForbidden, apiBadRequest } from '@/lib/api-response'

// GET /api/ipro/kiosk/operatorler?tezgahId= — tezgaha bağlı aktif operatörler (seç ekranı).
export async function GET(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const tezgahId = req.nextUrl.searchParams.get('tezgahId')
  if (!tezgahId) return apiBadRequest('tezgahId gerekli')

  // GÜVENLİK: tezgah kiosk'a bağlı olmalı.
  if (!kiosk.tezgahlar.some((kt) => kt.tezgah.id === tezgahId)) return apiForbidden()

  // IproOperatorTezgah.personnelId çıplak string → Personnel'i ayrı çek.
  const eslemeler = await prisma.iproOperatorTezgah.findMany({
    where: { tezgahId, aktif: true },
    select: { personnelId: true },
  })
  const ids = eslemeler.map((e) => e.personnelId)
  const operatorler = await prisma.personnel.findMany({
    where: { id: { in: ids }, aktif: true },
    select: { id: true, adSoyad: true, sicilNo: true },
    orderBy: { adSoyad: 'asc' },
  })

  return apiSuccess({ operatorler })
}
