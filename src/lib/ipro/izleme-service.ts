import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * IPRO izleme panosu — SALT OKUMA veri katmanı (FAZ 2).
 *
 * Hiçbir yazma yok. Tek toplu çağrı (panoData) tüm panoyu tek istekte döndürür;
 * N tezgah kartı için N istek YAPILMAZ.
 *
 * NOT (IPRO bloğu deseni): personnelId FK'sız çıplak String — operatör adı
 * ilişki üzerinden çekilemez, ikinci sorguyla eşlenir.
 *
 * Poller YOK → sinyalli tezgah canlı sayaçları GÖSTERİLMEZ (backlog).
 */

export type TezgahKart = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  /** Açık iş varsa dolu — kart "çalışıyor" görünür. */
  calisan: {
    adSoyad: string | null
    sicilNo: string | null
    ifsOrderNo: string | null
    ifsOperationNo: number | null
    baslatildiAt: string // ISO — süre istemcide hesaplanır (canlı sayaç)
  } | null
}

export type GunOzeti = {
  kapananIs: number
  toplamIyi: number
  toplamHurda: number
  aktifOperator: number // açık oturum sayısı (distinct personel)
}

export type IfsKuyruk = {
  bekleyen: number // KAPALI, ifsCompleteYazildi=false, qty>0
  enEskiBeklemeAt: string | null // ISO — en eski bekleyenin bitirildiAt'ı
  hataliKayit: number // ifsCompleteHata dolu
}

export type PanoData = {
  olusturuldu: string // ISO — istemci "en son … güncellendi" için
  tezgahlar: TezgahKart[]
  ozet: GunOzeti
  kuyruk: IfsKuyruk
}

function gununBasi(): Date {
  // Sunucu saatiyle bugünün 00:00'ı. Prod tek TZ (Europe/Istanbul).
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function panoData(): Promise<PanoData> {
  const bugun = gununBasi()

  // ── Tek turda topla: tezgahlar + açık işler + gün özeti + kuyruk ──
  const [tezgahlar, acikIsler, kapananBugun, toplamlar, acikOturumlar, bekleyen, enEski, hatali] = await Promise.all([
    prisma.iproTezgah.findMany({
      where: { aktif: true },
      orderBy: { kod: 'asc' },
      select: {
        id: true,
        kod: true,
        ad: true,
        masGrupAdi: true,
        aktif: true,
        _count: { select: { plcPinler: true } },
      },
    }),
    prisma.iproProductionLog.findMany({
      where: { durum: 'ACIK' },
      select: { tezgahId: true, personnelId: true, ifsOrderNo: true, ifsOperationNo: true, baslatildiAt: true },
    }),
    prisma.iproProductionLog.count({ where: { durum: 'KAPALI', bitirildiAt: { gte: bugun } } }),
    prisma.iproProductionLog.aggregate({
      where: { bitirildiAt: { gte: bugun } },
      _sum: { qtyComplete: true, qtyScrap: true },
    }),
    prisma.iproOperatorSession.findMany({ where: { cikisAt: null }, select: { personnelId: true } }),
    prisma.iproProductionLog.count({
      where: { durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
    }),
    prisma.iproProductionLog.findFirst({
      where: { durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
      orderBy: { bitirildiAt: 'asc' },
      select: { bitirildiAt: true },
    }),
    prisma.iproProductionLog.count({ where: { ifsCompleteHata: { not: null } } }),
  ])

  // ── Açık işlerdeki operatör adlarını ikinci sorguyla eşle (FK yok) ──
  const acikByTezgah = new Map(acikIsler.map((a) => [a.tezgahId, a]))
  const personIds = [...new Set(acikIsler.map((a) => a.personnelId))]
  const personeller = personIds.length
    ? await prisma.personnel.findMany({
        where: { id: { in: personIds } },
        select: { id: true, adSoyad: true, sicilNo: true },
      })
    : []
  const personById = new Map(personeller.map((p) => [p.id, p]))

  const kartlar: TezgahKart[] = tezgahlar.map((t) => {
    const acik = acikByTezgah.get(t.id)
    const person = acik ? personById.get(acik.personnelId) : null
    return {
      id: t.id,
      kod: t.kod,
      ad: t.ad,
      masGrupAdi: t.masGrupAdi,
      aktif: t.aktif,
      sinyalli: t._count.plcPinler > 0,
      calisan:
        acik && acik.baslatildiAt
          ? {
              adSoyad: person?.adSoyad ?? null,
              sicilNo: person?.sicilNo ?? null,
              ifsOrderNo: acik.ifsOrderNo,
              ifsOperationNo: acik.ifsOperationNo,
              baslatildiAt: acik.baslatildiAt.toISOString(),
            }
          : null,
    }
  })

  return {
    olusturuldu: new Date().toISOString(),
    tezgahlar: kartlar,
    ozet: {
      kapananIs: kapananBugun,
      toplamIyi: toplamlar._sum.qtyComplete ?? 0,
      toplamHurda: toplamlar._sum.qtyScrap ?? 0,
      aktifOperator: new Set(acikOturumlar.map((o) => o.personnelId)).size,
    },
    kuyruk: {
      bekleyen,
      enEskiBeklemeAt: enEski?.bitirildiAt?.toISOString() ?? null,
      hataliKayit: hatali,
    },
  }
}
