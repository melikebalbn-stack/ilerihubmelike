import { prisma } from '@/lib/prisma'

export type YenilemeDurum = 'GECIKMIS' | 'YAKLASIYOR' | 'GUNCEL' | 'PERIYOT_YOK' | 'TARIH_BELIRSIZ'

export type YenilemeSatiri = {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  bolum: string
  urunKod: string
  urunAd: string
  kategori: string | null
  teslimTarihi: string
  periyotAy: number | null
  sonrakiHakEdis: string | null
  kalanGun: number | null
  durum: YenilemeDurum
  tarihBelirsiz: boolean
}

const YAKLASIYOR_ESIK_GUN = 90

function upper(v: string) {
  return v.trim().toLocaleUpperCase('tr-TR')
}

function gunFarki(hedef: Date, simdi: Date): number {
  const h = new Date(hedef.getFullYear(), hedef.getMonth(), hedef.getDate())
  const s = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())
  return Math.round((h.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
}

function aySonrasi(tarih: Date, ay: number): Date {
  const sonuc = new Date(tarih)
  sonuc.setMonth(sonuc.getMonth() + ay)
  return sonuc
}

export async function hesaplaYenilemeler(options?: {
  bolum?: string
  durum?: YenilemeDurum
}): Promise<YenilemeSatiri[]> {
  const [zimmetler, kategoriler] = await Promise.all([
    prisma.envanterZimmet.findMany({
      where: { durum: 'AKTIF' },
      include: {
        personnel: {
          select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
        },
        urun: {
          select: { kod: true, ad: true, kategori: true },
        },
      },
    }),
    prisma.envanterKategori.findMany({
      select: { ad: true, yenilemePeriyoduAy: true },
    }),
  ])

  const periyotByKategori = new Map(
    kategoriler.map((k) => [upper(k.ad), k.yenilemePeriyoduAy]),
  )

  // Aynı (personnelId, urunId) için sadece en son teslimTarihi'li kaydı dikkate al —
  // eski teslimler yenilenmiş sayılır.
  const enSonByKey = new Map<string, (typeof zimmetler)[number]>()
  for (const zimmet of zimmetler) {
    const key = `${zimmet.personnelId}::${zimmet.urunId}`
    const mevcut = enSonByKey.get(key)
    if (!mevcut || zimmet.teslimTarihi > mevcut.teslimTarihi) {
      enSonByKey.set(key, zimmet)
    }
  }

  const simdi = new Date()
  const satirlar: YenilemeSatiri[] = []

  for (const zimmet of enSonByKey.values()) {
    const tarihBelirsiz = (zimmet.aciklama ?? '').includes('[TARİHSİZ-HİSTORİK]')
    const periyotAy = zimmet.urun.kategori
      ? (periyotByKategori.get(upper(zimmet.urun.kategori)) ?? null)
      : null

    let sonrakiHakEdis: Date | null = null
    let kalanGun: number | null = null
    let durum: YenilemeDurum

    // Tarihsiz historik kayıtlarda gerçek teslim tarihi bilinmiyor — bu "gecikmiş"
    // değil "veri eksik" demektir; hak ediş hesaplanamaz, ayrı bir durumla işaretlenir.
    if (tarihBelirsiz) {
      durum = 'TARIH_BELIRSIZ'
    } else if (periyotAy === null) {
      durum = 'PERIYOT_YOK'
    } else {
      sonrakiHakEdis = aySonrasi(zimmet.teslimTarihi, periyotAy)
      kalanGun = gunFarki(sonrakiHakEdis, simdi)

      if (kalanGun < 0) {
        durum = 'GECIKMIS'
      } else if (kalanGun <= YAKLASIYOR_ESIK_GUN) {
        durum = 'YAKLASIYOR'
      } else {
        durum = 'GUNCEL'
      }
    }

    satirlar.push({
      personnelId: zimmet.personnelId,
      sicilNo: zimmet.personnel.sicilNo,
      adSoyad: zimmet.personnel.adSoyad,
      bolum: zimmet.personnel.bolum,
      urunKod: zimmet.urun.kod,
      urunAd: zimmet.urun.ad,
      kategori: zimmet.urun.kategori,
      teslimTarihi: zimmet.teslimTarihi.toISOString(),
      periyotAy,
      sonrakiHakEdis: sonrakiHakEdis ? sonrakiHakEdis.toISOString() : null,
      kalanGun,
      durum,
      tarihBelirsiz,
    })
  }

  const filtreli = satirlar.filter((satir) => {
    if (options?.bolum && satir.bolum !== options.bolum) return false
    if (options?.durum && satir.durum !== options.durum) return false
    return true
  })

  filtreli.sort((a, b) => {
    if (a.kalanGun === null && b.kalanGun === null) return 0
    if (a.kalanGun === null) return 1
    if (b.kalanGun === null) return -1
    return a.kalanGun - b.kalanGun
  })

  return filtreli
}
