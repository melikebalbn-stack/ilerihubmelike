import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api-response'
import { birKaydiIfseYaz } from '@/lib/ipro/ifs-geri-yazim'
import { faz2DeltaAktif, isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'

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

  // DURUS KILIDI: tezgahta durusAktifkenIsBitirilemez bayrakli acik durus varsa is
  // bitirilemez. UI de kilitler ama gercek garanti burada (sunucu tarafi).
  const kilitliDurus = await prisma.iproMachineDowntime.findFirst({
    where: { tezgahId, bitis: null, durusSebebi: { durusAktifkenIsBitirilemez: true } },
    select: { id: true },
  })
  if (kilitliDurus) return apiError('Önce duruşu bitirin (aktif duruş iş bitirmeyi engelliyor)', 409)

  // Acik satiri bul.
  const acik = await prisma.iproProductionLog.findFirst({
    where: { personnelId, tezgahId, ifsOrderNo, ifsOperationNo, durum: 'ACIK' },
    select: { id: true, plcSayacBaslangic: true, baslatildiAt: true },
  })
  if (!acik) return apiNotFound('Açık iş bulunamadı')
  const plcSayacBaslangic = acik.plcSayacBaslangic
  const bitisAt = new Date() // hem delta penceresi üst sınırı hem bitirildiAt (tutarlı)

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

  // Model C — makine sayacından gerçekleşen toplam. Kaynak flag'e ve seri varlığına bağlı:
  //  - FAZ 2 açık + iş penceresinde delta serisi VAR → toplam = Σ delta ('DELTA').
  //    (Sayaç iş ortasında sıfırlansa bile doğru; poller reset'i delta=cur olarak yutar.)
  //  - Aksi hâlde (flag kapalı, ya da seri YOK: ısınmamış/eşsiz tezgah) → ÇIKARMAYA fallback
  //    ('CIKARMA'). FALLBACK GUARD kritik: boş seriyle Σ=0 her işi "iyi+hurda>0 → 400" yapardı.
  //  - Poller down + seri yok + çıkarma yapılamıyor → toplam null (KARAR B: bloklamaz).
  let toplam: number | null = null
  let hesapKaynagi: string | null = null
  if (sinyalli) {
    if (faz2DeltaAktif() && acik.baslatildiAt) {
      const { toplam: delta, seriVar } = await isPenceresiDeltaToplami(prisma, tezgahKod, acik.baslatildiAt, bitisAt)
      if (seriVar) {
        toplam = delta
        hesapKaynagi = 'DELTA'
      }
    }
    if (toplam == null && plcSayacBaslangic != null && plcSayacBitis != null) {
      toplam = plcSayacBitis - plcSayacBaslangic
      hesapKaynagi = 'CIKARMA'
    }
    // KORUNAN doğrulama (kaynak ne olursa olsun aynı):
    if (toplam != null) {
      if (toplam < 0) return apiBadRequest('Sayaç tutarsız (bitiş < başlangıç)')
      if (iyi + hurda > toplam) return apiBadRequest(`İyi+hurda makine sayacını (${toplam}) aşamaz`)
      // kalan (toplam - iyi - hurda) = ayar/deneme; ayri alan yok, turetilir.
    }
  }

  // Kapat (atomik update). ifsYazildi false kalir (IFS geri-yazimi ayri adim).
  const log = await prisma.iproProductionLog.update({
    where: { id: acik.id },
    data: {
      durum: 'KAPALI',
      bitirildiAt: bitisAt,
      qtyComplete: iyi,
      qtyScrap: hurda,
      hurdaSebebiKod: hurda > 0 ? sebep : null,
      plcSayacBitis,
      tamamlandi,
      uretimAdet: toplam, // FAZ 2: makine sayacından toplam (Σ delta veya çıkarma); null olabilir
      hesapKaynagi, // 'DELTA' | 'CIKARMA' | null — audit marker
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
    hesapKaynagi,
    ayarDeneme: toplam != null ? toplam - iyi - hurda : null,
    ifs: ifsDenendi.ok ? 'yazıldı' : 'kuyrukta',
  })
}
