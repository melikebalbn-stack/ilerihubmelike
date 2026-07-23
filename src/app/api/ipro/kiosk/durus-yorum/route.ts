import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api-response'
import { yorumNormalize } from '@/lib/ipro/durus-yorum'

// POST /api/ipro/kiosk/durus-yorum — body { tezgahId, yorum }
// Tezgahın AÇIK duruşuna opsiyonel yorum yazar/günceller.
//
// NEDEN AYRI ENDPOINT: duruş sebep seçilir seçilmez BAŞLAR (saha hızı korunur, klavye
// açılışı duruşun başlamasını geciktirmez). Yorum sonrasında, duruş sürerken yazılır.
// Yorum ZORUNLU DEĞİL — hiç çağrılmazsa duruş akışı bugünkü gibi işler.
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  if (typeof tezgahId !== 'string') return apiBadRequest('tezgahId gerekli')

  // GUVENLIK: tezgah kiosk'a bagli olmali.
  if (!kiosk.tezgahlar.some((k) => k.tezgah.id === tezgahId)) return apiForbidden()

  const yorum = yorumNormalize(body?.yorum)

  const acik = await prisma.iproMachineDowntime.findFirst({
    where: { tezgahId, bitis: null },
    select: { id: true },
  })
  if (!acik) return apiNotFound('Açık duruş bulunamadı')

  const durus = await prisma.iproMachineDowntime.update({
    where: { id: acik.id },
    data: { yorum },
    select: { id: true, yorum: true },
  })

  return apiSuccess({ id: durus.id, yorum: durus.yorum })
}
