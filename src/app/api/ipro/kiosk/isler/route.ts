import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'

/**
 * GET /api/ipro/kiosk/isler?tezgahId= — ILER2'nin TÜM açık operasyonları.
 *
 * WORK CENTER FİLTRESİ YOK — bilinçli. IFS'te iki paralel work-center dünyası var:
 *   • sayısal WC (705 "PSA MONTAJ") → makine kaynakları burada (IproTezgah.ifsWorkCenterNo bunu tutar)
 *   • alfanumerik WC (WMM01 "MONTAJ HATTI") → iş emri operasyonları BUNLARA planlanıyor
 * İkisi Reference_WorkCenter'da AYRI satırlar; bağlayan alan yok (DepartmentNo alfanumeriklerin
 * 10/11'inde null). Operasyon satırında da makine-seviyesi resource yok
 * (ScheduledResource = planlama WC'si, MachineNo 47/47 null). Bu yüzden tezgah→operasyon
 * filtresi kurulamıyor; tezgah↔planlama-WC eşlemesi üretim/IFS tarafından alınınca filtre geri gelir.
 * IproTezgah.ifsWorkCenterNo verisi ve backfill script'i DOKUNULMADAN duruyor.
 */
export async function GET(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const tezgahId = req.nextUrl.searchParams.get('tezgahId')
  if (!tezgahId) return apiBadRequest('tezgahId gerekli')

  // GÜVENLİK: tezgah kiosk'a bağlı olmalı (liste filtresiz olsa da yetki kontrolü kalır).
  if (!kiosk.tezgahlar.some((kt) => kt.tezgah.id === tezgahId)) return apiForbidden()

  try {
    const isler = await getShopOrderOperations({})
    return apiSuccess({ isler, tumAcikIsler: true })
  } catch (e) {
    console.error('[ipro-kiosk-isler] IFS hata', e)
    return apiError('İş listesi alınamadı, tekrar deneyin', 503)
  }
}
