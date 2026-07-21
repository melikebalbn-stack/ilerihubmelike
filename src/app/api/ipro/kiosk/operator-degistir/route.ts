import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'

// POST /api/ipro/kiosk/operator-degistir — body { tezgahId, personnelId }.
// Vardiya/kişi değişimi: cihaz (KIOSK) oturumu KORUNUR, yalnız operatör bırakır.
//
// KURAL: AÇIK İŞ varken engellenir (409) — açık iş operatöre bağlı, sahipsiz
// bırakılamaz; önce bitir/durdur. Açık DURUŞ tezgah-seviyesi → operatör değişimini
// ENGELLEMEZ (duruş sürer, yeni operatör devralır) — bu yüzden duruş HİÇ kontrol edilmez.
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  const personnelId = body?.personnelId
  if (typeof tezgahId !== 'string' || typeof personnelId !== 'string') {
    return apiBadRequest('tezgahId ve personnelId gerekli')
  }

  // GUVENLIK: tezgah kiosk'a bagli olmali.
  if (!kiosk.tezgahlar.some((k) => k.tezgah.id === tezgahId)) return apiForbidden()

  // Açık iş engeli — YALNIZCA açık iş bakılır (duruş bilinçli olarak yok sayılır).
  const acikIs = await prisma.iproProductionLog.findFirst({
    where: { tezgahId, personnelId, durum: 'ACIK' },
    select: { id: true },
  })
  if (acikIs) return apiError('Açık iş var — operatör değiştirmeden önce işi bitirin veya durdurun', 409)

  // Mevcut operatörün oturumunu kapat (temiz devir). Duruş tezgah-seviyesi → dokunulmaz.
  await prisma.iproOperatorSession.updateMany({
    where: { tezgahId, personnelId, cikisAt: null },
    data: { cikisAt: new Date() },
  })

  return apiSuccess({ ok: true })
}
