import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { closeSession } from '@/lib/ipro/operator-session'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api-response'

// POST /api/ipro/kiosk/oturum-kapat — body { sessionId }. Operator oturumu kapatir.
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const sessionId = body?.sessionId
  if (typeof sessionId !== 'string') {
    return apiBadRequest('sessionId gerekli')
  }

  const oturum = await prisma.iproOperatorSession.findUnique({
    where: { id: sessionId },
    select: { tezgahId: true },
  })
  if (!oturum) return apiNotFound('Oturum bulunamadi')

  // GUVENLIK: oturumun tezgahi kiosk'un bagli tezgahlarindan biri OLMALI.
  const izinli = kiosk.tezgahlar.some((kt) => kt.tezgah.id === oturum.tezgahId)
  if (!izinli) return apiForbidden()

  const count = await closeSession(sessionId)
  return apiSuccess({
    kapatildi: count === 1,
    mesaj: count === 1 ? 'Oturum kapatildi' : 'Oturum zaten kapali',
  })
}
