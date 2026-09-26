import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { KartNoHatasi, kartHamCoz, kartHamPanelden, kartNoBicimiOku, kartNoDonustur, kartNoGoster, type KartNoBicimi } from './kart-no'
import { boslukUyarilariOku } from './olay-depo'
import { SAAT_SAPMA_ESIGI_SN, type HubOlayTipi } from './olay-alim'
import { sonMutabakatOku } from './senkron'

/**
 * /pdks/gecisler — Geçiş Kayıtları (canlı) sorguları. Salt okuma (pdks.view).
 * Gün sınırı Europe/Istanbul (+03:00 sabit).
 */

export const ICERIDE_PENCERE_SAAT = 16 // son olayı GİRİŞ olan — ama en fazla 16 saat önce (unutulan çıkış süresiz saymasın)
export const CEVRIMICI_DK = 3 // cihaz son 3 dk içinde push/poll ile görüldüyse çevrimiçi
export const HUB_OLAY_TIPLERI: HubOlayTipi[] = ['GECERLI_KART', 'TANIMSIZ_KART', 'PASIF_KART', 'YETKISIZ', 'GECIS_SENSORU', 'YANGIN_ALARMI', 'DIGER']

export function gunAraligi(tarih: string | null | undefined): { tarih: string; bas: Date; bit: Date; bugun: boolean } {
  const bugunStr = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
  const t = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : bugunStr
  const bas = new Date(`${t}T00:00:00+03:00`)
  return { tarih: t, bas, bit: new Date(bas.getTime() + 24 * 3600_000), bugun: t === bugunStr }
}

function kartGoster(kartNo: string | null, bicim: KartNoBicimi): string | null {
  if (!kartNo) return null
  const ham = kartHamPanelden(kartNo, bicim)
  return ham ? kartNoGoster(ham) : kartNo
}

/** Arama kart numarasına benziyorsa panel biçimine çevir (kartNo panel değerini tutar). */
function aramaKartNo(q: string, bicim: KartNoBicimi): string | null {
  try {
    return kartNoDonustur(kartHamCoz(q).ham, bicim)
  } catch (e) {
    if (e instanceof KartNoHatasi) return null
    throw e
  }
}

export interface GecisFiltre {
  tarih?: string | null
  kapiId?: string | null
  tip?: string | null
  q?: string | null
}

export async function gecisEkrani(f: GecisFiltre) {
  const gun = gunAraligi(f.tarih)
  const bicim = await kartNoBicimiOku(prisma).catch(() => 'BIRLESIK' as KartNoBicimi)
  const simdi = new Date()

  const kapilar = await prisma.pdksKapi.findMany({
    where: { aktif: true, cihaz: { aktif: true } },
    orderBy: [{ cihaz: { kod: 'asc' } }, { kapiNo: 'asc' }],
    select: { id: true, ad: true, grup: true, kapiNo: true, cihazId: true, cihaz: { select: { kod: true, sonGorulmeAt: true } } },
  })
  const kapiAdi = new Map(kapilar.map((k) => [`${k.cihazId}:${k.kapiNo}`, k.ad]))

  // ── Tablo ──
  const q = (f.q ?? '').trim()
  const secKapi = f.kapiId ? kapilar.find((k) => k.id === f.kapiId) : undefined
  const qKart = q ? aramaKartNo(q, bicim) : null
  const where: Prisma.PdksGecisWhereInput = {
    olayZamani: { gte: gun.bas, lt: gun.bit },
    ...(secKapi ? { cihazId: secKapi.cihazId, kapiNo: secKapi.kapiNo } : {}),
    ...(f.tip && (HUB_OLAY_TIPLERI as string[]).includes(f.tip) ? { olayTipi: f.tip } : {}),
    ...(q
      ? {
          OR: [
            { personnel: { sicilNo: { contains: q, mode: 'insensitive' } } },
            { personnel: { adSoyad: { contains: q, mode: 'insensitive' } } },
            { kartNo: { contains: q.replace(/[\s-]/g, '') } },
            ...(qKart ? [{ kartNo: qKart }] : []),
          ],
        }
      : {}),
  }
  const [gecisler, toplamSatir] = await Promise.all([
    prisma.pdksGecis.findMany({
      where,
      orderBy: [{ olayZamani: 'desc' }, { seriNo: 'desc' }],
      take: 500,
      select: {
        id: true, olayZamani: true, cihazId: true, kapiNo: true, yon: true, kartNo: true, olayTipi: true, kaynak: true,
        bagliGecisId: true, personnel: { select: { sicilNo: true, adSoyad: true } },
      },
    }),
    prisma.pdksGecis.count({ where }),
  ])
  const satirlar = gecisler.map((g) => ({
    id: g.id,
    zaman: g.olayZamani.toISOString(),
    kapi: g.kapiNo !== null ? kapiAdi.get(`${g.cihazId}:${g.kapiNo}`) ?? `Kapı ${g.kapiNo}` : '—',
    yon: g.yon,
    kartNo: kartGoster(g.kartNo, bicim),
    sicil: g.personnel?.sicilNo ?? null,
    adSoyad: g.personnel?.adSoyad ?? null,
    tip: g.olayTipi as HubOlayTipi,
    kaynak: g.kaynak,
    sensorBagli: !!g.bagliGecisId,
  }))

  // ── Turnikeler (grup = aynı turnikenin giriş + çıkış kapısı) ──
  const [sayim, sonOlay] = await Promise.all([
    prisma.pdksGecis.groupBy({
      by: ['cihazId', 'kapiNo', 'yon'],
      where: { olayZamani: { gte: gun.bas, lt: gun.bit }, olayTipi: 'GECERLI_KART' },
      _count: { _all: true },
    }),
    prisma.pdksGecis.groupBy({
      by: ['cihazId', 'kapiNo'],
      where: { olayZamani: { gte: gun.bas, lt: gun.bit } },
      _max: { olayZamani: true },
    }),
  ])
  const turnikeMap = new Map<string, { ad: string; giris: number; cikis: number; sonOlay: Date | null; cevrimici: boolean; kapilar: string[] }>()
  for (const k of kapilar) {
    const anahtar = k.grup || k.ad
    const t = turnikeMap.get(anahtar) ?? { ad: anahtar, giris: 0, cikis: 0, sonOlay: null, cevrimici: false, kapilar: [] }
    t.kapilar.push(k.ad)
    for (const s of sayim.filter((x) => x.cihazId === k.cihazId && x.kapiNo === k.kapiNo)) {
      if (s.yon === 'GIRIS') t.giris += s._count._all
      if (s.yon === 'CIKIS') t.cikis += s._count._all
    }
    const so = sonOlay.find((x) => x.cihazId === k.cihazId && x.kapiNo === k.kapiNo)?._max.olayZamani ?? null
    if (so && (!t.sonOlay || so > t.sonOlay)) t.sonOlay = so
    const g = k.cihaz.sonGorulmeAt
    if (g && simdi.getTime() - g.getTime() <= CEVRIMICI_DK * 60_000) t.cevrimici = true
    turnikeMap.set(anahtar, t)
  }
  const turnikeler = [...turnikeMap.values()].map((t) => ({ ...t, sonOlay: t.sonOlay?.toISOString() ?? null }))

  // ── Şu an içeride ──
  const [{ adet: iceride }] = await prisma.$queryRaw<{ adet: number }[]>`
    SELECT count(*)::int AS adet FROM (
      SELECT DISTINCT ON (g."personnelId") g."personnelId", g.yon
      FROM pdks_gecis g
      WHERE g."olayTipi" = 'GECERLI_KART' AND g."personnelId" IS NOT NULL
        AND g."olayZamani" > now() - make_interval(hours => ${ICERIDE_PENCERE_SAAT})
      ORDER BY g."personnelId", g."olayZamani" DESC
    ) s JOIN "Personnel" p ON p.id = s."personnelId"
    WHERE s.yon = 'GIRIS' AND p.aktif`

  // ── Panel sağlığı ──
  const cihazlar = await prisma.pdksCihaz.findMany({
    where: { aktif: true, marka: 'HIKVISION' },
    orderBy: { kod: 'asc' },
    select: { id: true, kod: true, seriDonem: true, sonSeriNo: true, saatSapmaSn: true, saatKontrolAt: true, sonPushAt: true, sonPollAt: true, sonGorulmeAt: true },
  })
  const [kayiplar, mutabakat] = await Promise.all([boslukUyarilariOku(prisma), sonMutabakatOku(prisma)])
  const yediGun = simdi.getTime() - 7 * 24 * 3600_000
  const saglik = await Promise.all(
    cihazlar.map(async (c) => {
      const [maks, sonrasi] = await Promise.all([
        prisma.pdksGecis.aggregate({ where: { cihazId: c.id, seriDonem: c.seriDonem }, _max: { seriNo: true } }),
        prisma.pdksGecis.count({ where: { cihazId: c.id, seriDonem: c.seriDonem, seriNo: { gt: c.sonSeriNo ?? -1 } } }),
      ])
      const maksSeri = maks._max.seriNo
      const bekleyenBosluk = maksSeri !== null && c.sonSeriNo !== null ? Math.max(0, maksSeri - c.sonSeriNo - sonrasi) : 0
      return {
        kod: c.kod,
        saatSapmaSn: c.saatSapmaSn,
        saatUyari: c.saatSapmaSn !== null && Math.abs(c.saatSapmaSn) > SAAT_SAPMA_ESIGI_SN,
        saatKontrolAt: c.saatKontrolAt?.toISOString() ?? null,
        sonPushAt: c.sonPushAt?.toISOString() ?? null,
        sonPollAt: c.sonPollAt?.toISOString() ?? null,
        cevrimici: !!c.sonGorulmeAt && simdi.getTime() - c.sonGorulmeAt.getTime() <= CEVRIMICI_DK * 60_000,
        bekleyenBosluk,
        kayipBosluklar: kayiplar.filter((k) => k.cihazKod === c.kod && Date.parse(k.tespit) >= yediGun),
      }
    }),
  )

  // ── Tanımsız / pasif kart okutmaları (seçili gün) ──
  const tanimsizHam = await prisma.pdksGecis.groupBy({
    by: ['kartNo', 'olayTipi'],
    where: { olayZamani: { gte: gun.bas, lt: gun.bit }, olayTipi: { in: ['TANIMSIZ_KART', 'PASIF_KART'] }, kartNo: { not: null } },
    _count: { _all: true },
    _max: { olayZamani: true },
    orderBy: { _max: { olayZamani: 'desc' } },
    take: 50,
  })
  const pasifKisi = await prisma.pdksGecis.findMany({
    where: { olayZamani: { gte: gun.bas, lt: gun.bit }, olayTipi: 'PASIF_KART', personnelId: { not: null } },
    distinct: ['kartNo'],
    select: { kartNo: true, personnel: { select: { sicilNo: true, adSoyad: true } } },
  })
  const tanimsizlar = tanimsizHam.map((t) => {
    const ham = t.kartNo ? kartHamPanelden(t.kartNo, bicim) : null
    const p = pasifKisi.find((x) => x.kartNo === t.kartNo)?.personnel
    return {
      kartNo: ham ? kartNoGoster(ham) : t.kartNo,
      bagla: ham ? kartNoGoster(ham) : null, // Kartlar ekranına ön-doldurma için; çözülemezse bağlanamaz
      tip: t.olayTipi as 'TANIMSIZ_KART' | 'PASIF_KART',
      deneme: t._count._all,
      son: t._max.olayZamani?.toISOString() ?? null,
      sicil: p?.sicilNo ?? null,
      adSoyad: p?.adSoyad ?? null,
    }
  })

  return {
    gun: { tarih: gun.tarih, bugun: gun.bugun },
    satirlar,
    toplamSatir,
    kapilar: kapilar.map((k) => ({ id: k.id, ad: k.ad })),
    turnikeler,
    iceride,
    saglik,
    sonMutabakat: mutabakat?.zaman ?? null,
    tanimsizlar,
  }
}
