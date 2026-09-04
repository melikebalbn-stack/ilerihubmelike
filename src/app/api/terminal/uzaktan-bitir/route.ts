import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api-response'
import { birKaydiIfseYaz } from '@/lib/ipro/ifs-geri-yazim'
import { faz2DeltaAktif, isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'
import { oeeKaydiHesaplaVeYaz } from '@/lib/ipro/oee-hesap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/terminal/uzaktan-bitir — body { productionLogId, qtyComplete, qtyScrap }
// Terminalden UZAKTAN iş bitirme: ipro.admin yetkili kullanıcı, açık bir üretim satırını
// KAPALI'ya çeker. Kiosk /kiosk/is-bitir ÇEKİRDEĞİNİN KOPYASI (o dosyaya DOKUNULMADI).
// Farklar:
//   (1) Guard: ipro.admin (kiosk-session DEĞİL, ipro.view YETMEZ).
//   (2) İş, kiosk kimliği (personnelId+order+op) yerine productionLogId ile bulunur (tek anahtar).
//   (3) Hurda sebebi / tamamlandi SORULMAZ — admin kapanışı: tamamlandi=true, hurdaSebebiKod=null.
//   (4) Poller /status okunamazsa BLOKLAMAZ — plcSayacBitis null kalır (is-bitir KARAR B ile aynı).
//   (5) kaynak update'e DAHİL EDİLMEZ → başlangıç damgası ('TERMINAL' | 'KIOSK') korunur.
//   (6) Faz2 Σdelta / çıkarma fallback, hesapKaynagi damgası, IFS geri-yazımı ve OEE motoru
//       is-bitir'deki mantığın AYNISI (OEE/IFS bloklamayan try/catch).
export async function POST(req: NextRequest) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error

  const body = await req.json().catch(() => null)
  const productionLogId = body?.productionLogId
  const iyi = body?.qtyComplete
  const hurda = body?.qtyScrap
  if (
    typeof productionLogId !== 'string' ||
    typeof iyi !== 'number' || !Number.isInteger(iyi) || iyi < 0 ||
    typeof hurda !== 'number' || !Number.isInteger(hurda) || hurda < 0
  ) {
    return apiBadRequest('productionLogId, qtyComplete (>=0 int), qtyScrap (>=0 int) gerekli')
  }

  // Açık satırı ID ile bul (kiosk kimliği yerine). tezgah/kod/başlangıç sayacı buradan türer.
  const acik = await prisma.iproProductionLog.findUnique({
    where: { id: productionLogId },
    select: {
      id: true,
      durum: true,
      tezgahId: true,
      plcSayacBaslangic: true,
      baslatildiAt: true,
      tezgah: { select: { kod: true } },
    },
  })
  if (!acik) return apiNotFound('İş kaydı bulunamadı')
  if (acik.durum !== 'ACIK') return apiError('İş zaten kapalı', 409)
  const tezgahId = acik.tezgahId
  const tezgahKod = acik.tezgah.kod
  const plcSayacBaslangic = acik.plcSayacBaslangic
  const bitisAt = new Date() // hem delta penceresi üst sınırı hem bitirildiAt (tutarlı)

  // DURUS KILIDI — is-bitir ile aynı invariant: durusAktifkenIsBitirilemez bayraklı açık
  // duruş varsa iş bitirilemez (sunucu tarafı garanti).
  const kilitliDurus = await prisma.iproMachineDowntime.findFirst({
    where: { tezgahId, bitis: null, durusSebebi: { durusAktifkenIsBitirilemez: true } },
    select: { id: true },
  })
  if (kilitliDurus) return apiError('Önce duruşu bitirin (aktif duruş iş bitirmeyi engelliyor)', 409)

  // Sinyal tespiti — is-bitir kopyası.
  const sinyalli = (await prisma.iproPlcPin.count({
    where: { tezgahId, aktif: true, plc: { aktif: true } },
  })) > 0

  // Bitiş sayacı (KARAR B: poller down BLOKLAMAZ — plcSayacBitis null kalır, iş kapanır).
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
      // poller down / timeout → plcSayacBitis null kalır (503 DEGIL)
    } finally {
      clearTimeout(t)
    }
  }

  // Model C — makine sayacından gerçekleşen toplam (is-bitir birebir):
  //  - FAZ 2 açık + iş penceresinde delta serisi VAR → toplam = Σ delta ('DELTA').
  //  - Aksi hâlde plcSayacBaslangic/Bitis ikisi de doluysa → ÇIKARMA fallback ('CIKARMA').
  //  - Poller down + seri yok → toplam null (KARAR B: bloklamaz).
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
    }
  }

  // Kapat (atomik update). kaynak DOKUNULMAZ → başlangıç damgası korunur; tamamlandi=true
  // (admin kapanışı = iş tamam); hurdaSebebiKod null (terminal akışı sebep sormaz).
  const log = await prisma.iproProductionLog.update({
    where: { id: acik.id },
    data: {
      durum: 'KAPALI',
      bitirildiAt: bitisAt,
      qtyComplete: iyi,
      qtyScrap: hurda,
      hurdaSebebiKod: null,
      plcSayacBitis,
      tamamlandi: true,
      uretimAdet: toplam, // FAZ 2: makine sayacından toplam (Σ delta veya çıkarma); null olabilir
      hesapKaynagi, // 'DELTA' | 'CIKARMA' | null — audit marker
    },
    select: { id: true, durum: true, qtyComplete: true, qtyScrap: true, tamamlandi: true },
  })

  // Hibrit: bitir anında IFS'e bir kez dene. Başarısızsa cron toparlar — response'u BLOKLAMA.
  let ifsDenendi: { ok: boolean; hata: string | null } = { ok: false, hata: null }
  try {
    ifsDenendi = await birKaydiIfseYaz(log.id)
  } catch (e) {
    ifsDenendi = { ok: false, hata: (e as Error)?.message ?? null }
  }

  // OEE motoru — iş kapanınca hesapla-yaz. BLOKLAMAZ (Faz2/mail deseni). İLK gerçek OEE
  // kaydını bu üretebilir; hata is-bitir'deki gibi response'u 500 yapmaz.
  try {
    await oeeKaydiHesaplaVeYaz(prisma, log.id)
  } catch {
    // OEE hesabı hatası response'u bozmaz (iş zaten kapandı).
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
