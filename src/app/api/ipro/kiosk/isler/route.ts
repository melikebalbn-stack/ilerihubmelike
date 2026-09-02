import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import {
  getWorkCenters,
  getWorkCenterResources,
  getWorkCenterDepartments,
} from '@/lib/ifs/work-center-departments'
import { isEmriWcDepartmanKoku } from '@/lib/ipro/departman-eslesme'

/**
 * GET /api/ipro/kiosk/isler?tezgahId= — seçili tezgahın BÖLÜMÜNE ait açık operasyonlar.
 *
 * Zincir (terminal ana ekranıyla AYNI mantık; helper'lar ortak, kopya değil):
 *   ipro_tezgah.kod == IFS ResourceId
 *     → Reference_WorkCenterResource.WorkCenterNo (tezgahın iş merkezi)
 *       → WorkCenterSet.DepartmentNo (bölüm kodu; ör. WPH)
 * Açık işleri o bölüme süzeriz: operasyonun W-prefixli WC'si (WPH01, WCN01, WCN02…)
 * → isEmriWcDepartmanKoku ile İSİM KÖKÜNE indirilir (WPH01→WPH) ve bölüm koduyla
 * eşleştirilir. Böylece bir bölümün TÜM W-WC'leri (WCN01+WCN02) tek geçişte birleşir.
 * NOT: W-prefixli WC'lerin kendi DepartmentNo'su boş/tutarsız → o alanla değil, kökle eşlenir.
 *
 * Bölüm belirlenemezse (IFS'te kaynak yok / eşleşme yok / metadata alınamadı) TÜM açık
 * işler döner (operatör işsiz kalmasın) ve filtreliMi=false bayrağı konur.
 * IFS iş listesi hatası: mevcut 503 yolu korunur.
 */
export async function GET(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const tezgahId = req.nextUrl.searchParams.get('tezgahId')
  if (!tezgahId) return apiBadRequest('tezgahId gerekli')

  // GÜVENLİK: tezgah kiosk'a bağlı olmalı.
  const kt = kiosk.tezgahlar.find((k) => k.tezgah.id === tezgahId)
  if (!kt) return apiForbidden()
  const tezgahKod = kt.tezgah.kod

  // Bölüm çözümü — kaynak + WC metadata'sı PARALEL. Hata/eşleşme yoksa departmanKod null
  // (→ filtresiz tüm işler). Bu metadata çağrıları iş listesini BLOKLAMAZ.
  let departmanKod: string | null = null
  try {
    const [kaynaklar, wcler] = await Promise.all([getWorkCenterResources(), getWorkCenters()])
    const kaynak = kaynaklar.find(
      (r) => r.resourceId.toLocaleLowerCase('tr-TR') === tezgahKod.toLocaleLowerCase('tr-TR'),
    )
    if (kaynak) {
      const wc = wcler.find((w) => w.workCenterNo === kaynak.workCenterNo && w.departmentNo)
      if (wc) departmanKod = wc.departmentNo
    }
  } catch {
    // Kaynak/WC metadata'sı alınamadı → filtresiz davranışa düş (operatör işsiz kalmasın).
  }

  // Bölüm adı (ör. "PRESHANE") — yalnız gösterim; alınamazsa kod gösterilir. Best-effort.
  let departmanAd: string | null = null
  if (departmanKod) {
    try {
      const depts = await getWorkCenterDepartments()
      departmanAd = depts.find((d) => d.kod === departmanKod)?.ad ?? null
    } catch {
      // ad alınamadı → UI kodu gösterir.
    }
  }

  try {
    const tumIsler = await getShopOrderOperations({})
    if (departmanKod) {
      const isler = tumIsler.filter((o) => isEmriWcDepartmanKoku(o.isMerkezi) === departmanKod)
      return apiSuccess({ isler, filtreliMi: true, departmanKod, departmanAd })
    }
    // Bölüm belirlenemedi → tüm açık işler (mevcut davranış).
    return apiSuccess({ isler: tumIsler, filtreliMi: false, departmanKod: null, departmanAd: null })
  } catch (e) {
    console.error('[ipro-kiosk-isler] IFS hata', e)
    return apiError('İş listesi alınamadı, tekrar deneyin', 503)
  }
}
