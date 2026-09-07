import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { tezgahDetay } from '@/lib/ipro/izleme-service'
import { prisma } from '@/lib/prisma'
import { iproHata } from '@/lib/ipro/yonetim-hata'
import { planliSaniyeHesapla } from '@/lib/ipro/oee-hesap'
import { durusSaniyeCanli, oeeCanliBilesenleri } from '@/lib/ipro/oee-canli'
import { gecerliTatilTip, tarihAnahtari, type IproTatilTip } from '@/lib/ipro/takvim-util'
import { cevrimSaniye } from '@/lib/ipro/cevrim-util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/terminal/uretim/tezgah/[id] → tek tezgah detayı (terminal kart tıklaması
// → dialog). İzleme panosunun /api/ipro/izleme/tezgah/[id] route'unun TERMINAL İKİZİ:
// aynı tezgahDetay(id) servisini + aynı guard'ı (ipro.view | ipro.admin) kullanır.
// id = ipro_tezgah.id (page.tsx iproId olarak geçirir). SALT OKUMA.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const { id } = await params
    const detay = await tezgahDetay(id)
    if (!detay) return NextResponse.json({ ok: false, error: 'Tezgah bulunamadı' }, { status: 404 })

    // AÇIK işte canlı üretim — iş penceresinde Σdelta + son sinyal. TEK sorgu.
    // izleme-service/is-bitir'deki isPenceresiDeltaToplami mantığının aynısı; o dosyalara
    // DOKUNMADAN burada kuruldu (SALT OKUMA, toplu). adet::int (BigInt önlenir).
    // seriVar=false → hiç delta yok (modal "sinyal gelmedi" der, sessiz 0 değil).
    let canliUretim: { adet: number; seriVar: boolean; sonSinyal: string | null } | null = null
    if (detay.aktifIs?.baslatildiAt) {
      try {
        const bas = new Date(detay.aktifIs.baslatildiAt)
        const rows = await prisma.$queryRaw<{ toplam: number; seri: number; son: Date | null }[]>`
          SELECT COALESCE(SUM(delta) FILTER (WHERE ts >= ${bas}), 0)::int AS toplam,
                 COUNT(*) FILTER (WHERE ts >= ${bas})::int AS seri,
                 MAX(ts) AS son
          FROM ipro_sayac_okuma WHERE "tezgahKod" = ${detay.kod}
        `
        const r = rows[0]
        canliUretim = {
          adet: Number(r?.toplam ?? 0),
          seriVar: Number(r?.seri ?? 0) > 0,
          sonSinyal: r?.son ? new Date(r.son).toISOString() : null,
        }
      } catch {
        // Canlı üretim alınamadı → null; modal mevcut gerceklesen davranışına düşer.
      }
    }

    // AÇIK işte CANLI OEE — oee-canli.ts (SAF/DB helper) + planliSaniyeHesapla (oee-hesap, SAF).
    // O dosyalara DOKUNULMADAN import edildi (pano-service ile aynı wiring). Availability +
    // Performance canlı; Quality açık işte NULL (iyi/hurda iş bitince → oeeCanliBilesenleri null verir).
    // idealSaniyeAdet: güvenilir IproIdealCevrim tercih; yoksa IFS planlı çevrime (MachRunFactor→sn) düşer.
    let canliOee: {
      availability: number | null
      performance: number | null
      oeeCanli: number | null
      planliSaniye: number
      durusSaniye: number
      uretilen: number
      idealSaniyeAdet: number | null
      idealKaynak: 'OLCULEN' | 'IFS' | null
      ornekSayisi: number
    } | null = null
    if (detay.aktifIs?.baslatildiAt) {
      try {
        const bas = new Date(detay.aktifIs.baslatildiAt)
        const simdi = new Date()
        const parcaKod = detay.aktifIs.ifsPartNo
        const [vardiyalar, tatiller, ideal, durusSaniye] = await Promise.all([
          prisma.iproVardiya.findMany({
            where: { aktif: true },
            select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true },
          }),
          prisma.iproTatil.findMany({ select: { tarih: true, tip: true } }),
          parcaKod
            ? prisma.iproIdealCevrim.findUnique({
                where: { tezgahKod_parcaKod: { tezgahKod: detay.kod, parcaKod } },
                select: { idealSaniyeAdet: true, guvenilir: true, ornekSayisi: true },
              })
            : Promise.resolve(null),
          durusSaniyeCanli(prisma, id, bas, simdi),
        ])
        const tatilMap = new Map<string, IproTatilTip>()
        for (const t of tatiller) if (gecerliTatilTip(t.tip)) tatilMap.set(tarihAnahtari(t.tarih), t.tip)

        const planliSaniye = planliSaniyeHesapla(bas, simdi, vardiyalar, tatilMap)
        const uretilen = canliUretim?.adet ?? 0

        // Güvenilir ölçülen ideal → onu; yoksa IFS planlı çevrimi (sn) referans al.
        const ifsPlanSn = cevrimSaniye(detay.aktifIs.ifsMachRunFactor, detay.aktifIs.ifsRunTimeCode)
        const idealSaniyeAdet = ideal?.guvenilir ? ideal.idealSaniyeAdet : (ifsPlanSn ?? null)
        const idealKaynak: 'OLCULEN' | 'IFS' | null = ideal?.guvenilir
          ? 'OLCULEN'
          : ifsPlanSn != null
            ? 'IFS'
            : null

        const b = oeeCanliBilesenleri({ planliSaniye, durusSaniye, uretilen, idealSaniyeAdet })
        canliOee = {
          availability: b.availability,
          performance: b.performance,
          oeeCanli: b.oeeCanli,
          planliSaniye,
          durusSaniye,
          uretilen,
          idealSaniyeAdet,
          idealKaynak,
          ornekSayisi: ideal?.ornekSayisi ?? 0,
        }
      } catch {
        // Canlı OEE alınamadı → null; modal göstergeleri "—" gösterir.
      }
    }

    // BUGÜN KAPANAN işlere OEE kaydını bağla — TEK toplu sorgu (iş başına ayrı sorgu YASAK).
    // bugunKapanan izleme-service'ten geliyor (o dosyaya DOKUNMADAN); her satırın id'si =
    // IproProductionLog.id = ipro_oee_kaydi.productionLogId (1:1). OEE kaydı yoksa (motor
    // tetiklenmemiş eski kayıt) null bağlanır. Yanıtta bugunKapanan zenginleştirilmiş sürümle
    // OVERRIDE edilir (spread'den sonra geldiği için kazanır).
    let bugunKapananOee = detay.bugunKapanan as Array<
      (typeof detay.bugunKapanan)[number] & {
        oee: {
          oee: number | null
          availability: number | null
          performance: number | null
          quality: number | null
          hesapKaynagi: string
        } | null
      }
    >
    try {
      const kapananIds = detay.bugunKapanan.map((k) => k.id)
      if (kapananIds.length > 0) {
        const kayitlar = await prisma.iproOeeKaydi.findMany({
          where: { productionLogId: { in: kapananIds } },
          select: {
            productionLogId: true,
            oee: true,
            availability: true,
            performance: true,
            quality: true,
            hesapKaynagi: true,
          },
        })
        const oeeByLog = new Map(kayitlar.map((k) => [k.productionLogId, k]))
        bugunKapananOee = detay.bugunKapanan.map((k) => {
          const o = oeeByLog.get(k.id)
          return {
            ...k,
            oee: o
              ? {
                  oee: o.oee,
                  availability: o.availability,
                  performance: o.performance,
                  quality: o.quality,
                  hesapKaynagi: o.hesapKaynagi,
                }
              : null,
          }
        })
      } else {
        bugunKapananOee = []
      }
    } catch {
      // OEE bağlanamadı → kayıtlar oee:null ile döner (tablo "—" + "hesaplanmadı" gösterir).
      bugunKapananOee = detay.bugunKapanan.map((k) => ({ ...k, oee: null }))
    }

    return NextResponse.json({ ok: true, ...detay, bugunKapanan: bugunKapananOee, canliUretim, canliOee })
  } catch (e) {
    return iproHata(e, 'Tezgah detayı alınamadı')
  }
}
