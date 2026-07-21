import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api-response'

// POST /api/ipro/kiosk/durus-bitir — body { tezgahId }. Tezgahın AÇIK duruşunu (bitis=null)
// kapatır. Duruş tezgah-seviyesi → hangi operatör bitirirse bitirsin (kiosk bağlamı yeter).
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  if (typeof tezgahId !== 'string') return apiBadRequest('tezgahId gerekli')

  // GUVENLIK: tezgah kiosk'a bagli olmali.
  if (!kiosk.tezgahlar.some((k) => k.tezgah.id === tezgahId)) return apiForbidden()

  const acik = await prisma.iproMachineDowntime.findFirst({
    where: { tezgahId, bitis: null },
    select: { id: true },
  })
  if (!acik) return apiNotFound('Açık duruş bulunamadı')

  const durus = await prisma.iproMachineDowntime.update({
    where: { id: acik.id },
    data: { bitis: new Date() },
    select: { id: true, baslangic: true, bitis: true },
  })

  return apiSuccess({ id: durus.id, baslangic: durus.baslangic, bitis: durus.bitis })
}
