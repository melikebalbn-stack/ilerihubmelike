import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api-response'
import { birKaydiIfseYaz } from '@/lib/ipro/ifs-geri-yazim'

// POST /api/ipro/kiosk/is-bitir — body { tezgahId, personnelId, ifsOrderNo, ifsOperationNo,
//   iyi, hurda, tamamlandi, hurdaSebebiKod? }. ACIK uretim satirini KAPALI'ya ceker (once bize yaz).
// Sinyalli tezgahta bitis sayacini poller /status'ten okur (KARAR B: poller down BLOKLAMAZ, null kalir).
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  const personnelId = body?.personnelId
  const ifsOrderNo = body?.ifsOrderNo
  const ifsOperationNo = body?.ifsOperationNo
  const iyi = body?.iyi
  const hurda = body?.hurda
  const tamamlandi = body?.tamamlandi
  const hurdaSebebiKod = body?.hurdaSebebiKod

  if (
    typeof tezgahId !== 'string' ||
    typeof personnelId !== 'string' ||
    typeof ifsOrderNo !== 'string' ||
    typeof ifsOperationNo !== 'number' ||
    typeof iyi !== 'number' || !Number.isInteger(iyi) || iyi < 0 ||
    typeof hurda !== 'number' || !Number.isInteger(hurda) || hurda < 0 ||
    typeof tamamlandi !== 'boolean'
  ) {
    return apiBadRequest('tezgahId, personnelId, ifsOrderNo, ifsOperationNo, iyi (>=0 int), hurda (>=0 int), tamamlandi (bool) gerekli')
  }

  // Hurda varsa sebep ZORUNLU.
  const sebep: string | null = typeof hurdaSebebiKod === 'string' ? hurdaSebebiKod : null
  if (hurda > 0 && !sebep) return apiBadRequest('Hurda sebebi zorunlu')

  // GUVENLIK: tezgah kiosk'un bagli tezgahlarindan biri OLMALI.
  const kt = kiosk.tezgahlar.find((k) => k.tezgah.id === tezgahId)
  if (!kt) return apiForbidden()
  const tezgahKod = kt.tezgah.kod

  // Acik satiri bul.
  const acik = await prisma.iproProductionLog.findFirst({
    where: { personnelId, tezgahId, ifsOrderNo, ifsOperationNo, durum: 'ACIK' },
    select: { id: true, plcSayacBaslangic: true },
  })
  if (!acik) return apiNotFound('Açık iş bulunamadı')
  const plcSayacBaslangic = acik.plcSayacBaslangic

  // Sinyal tespiti — is-basla ile ayni sorgu.
  const sinyalli = (await prisma.iproPlcPin.count({
    where: { tezgahId, aktif: true, plc: { aktif: true } },
  })) > 0

  // Bitis sayaci (KARAR B: poller down BLOKLAMAZ — plcSayacBitis null kalir, is kapanir).
  let plcSayacBitis: number | null = null
  if (sinyalli) {
    const port = process.env.IPRO_POLLER_PORT ?? '3020'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/status`, { signal: ctrl.signal })
      if (res.ok) {
        const list = (await res.json()) as Array<{ tezgahKod?: string; sayacToplam?: unknown }>
        const kayit = Array.isArray(list) ? list.find((x) => x.tezgahKod === tezgahKod) : undefined
        if (kayit && typeof kayit.sayacToplam === 'number') plcSayacBitis = kayit.sayacToplam
      }
    } catch {
      // poller down / timeout → plcSayacBitis null kalir (503 DEGIL)
    } finally {
      clearTimeout(t)
    }
  }

  // Model C dogrulamasi — yalniz sinyalli + iki sayac da varsa.
  let toplam: number | null = null
  if (sinyalli && plcSayacBaslangic != null && plcSayacBitis != null) {
    toplam = plcSayacBitis - plcSayacBaslangic
    if (toplam < 0) return apiBadRequest('Sayaç tutarsız (bitiş < başlangıç)')
    if (iyi + hurda > toplam) return apiBadRequest(`İyi+hurda makine sayacını (${toplam}) aşamaz`)
    // kalan (toplam - iyi - hurda) = ayar/deneme; ayri alan yok, turetilir.
  }

  // Kapat (atomik update). ifsYazildi false kalir (IFS geri-yazimi ayri adim).
  const log = await prisma.iproProductionLog.update({
    where: { id: acik.id },
    data: {
      durum: 'KAPALI',
      bitirildiAt: new Date(),
      qtyComplete: iyi,
      qtyScrap: hurda,
      hurdaSebebiKod: hurda > 0 ? sebep : null,
      plcSayacBitis,
      tamamlandi,
    },
    select: { id: true, durum: true, qtyComplete: true, qtyScrap: true, tamamlandi: true },
  })

  // Hibrit: bitir anında IFS'e bir kez dene. Başarısızsa cron toparlar — response'u
  // BLOKLAMA/HATA VERME. IFS hatası operatöre 4xx/5xx OLARAK YANSIMAZ (iş kapandı).
  let ifsDenendi: { ok: boolean; hata: string | null } = { ok: false, hata: null }
  try {
    ifsDenendi = await birKaydiIfseYaz(log.id)
  } catch (e) {
    // birKaydiIfseYaz kendi içinde catch'liyor; buradaki garanti, olası throw response'u bozmasın.
    ifsDenendi = { ok: false, hata: (e as Error)?.message ?? null }
  }

  return apiSuccess({
    id: log.id,
    durum: log.durum,
    qtyComplete: log.qtyComplete,
    qtyScrap: log.qtyScrap,
    tamamlandi: log.tamamlandi,
    toplam,
    ayarDeneme: toplam != null ? toplam - iyi - hurda : null,
    ifs: ifsDenendi.ok ? 'yazıldı' : 'kuyrukta',
  })
}
