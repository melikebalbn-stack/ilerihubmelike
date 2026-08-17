import { prisma } from '@/lib/prisma'

export type SarfTuketimSatiri = {
  urunId: string
  urunKodu: string
  urunAdi: string
  kategori: string
  bolum: string
  alanPersonelAd: string
  toplamMiktar: number
  islemSayisi: number
  sonTarih: string
}

export type PersonelRaporuDetaySatiri = {
  urunKodu: string
  urunAdi: string
  kategori: string
  miktar: number
  islemSayisi: number
  sonTarih: string
}
export type PersonelRaporuSatiri = {
  personelId: string | null
  personelAd: string
  bolum: string
  toplamMiktar: number
  islemSayisi: number
  urunSayisi: number
  sonTarih: string
  detaylar: PersonelRaporuDetaySatiri[]
}
export type PersonelRaporuSonuc = {
  satirlar: PersonelRaporuSatiri[]
  bolumler: string[]
  toplamCikis: number
}
export async function getPersonelRaporu(options?: {
  baslangic?: string
  bitis?: string
}): Promise<PersonelRaporuSonuc> {
  const where: Record<string, unknown> = { hareketTipi: 'CIKIS' }
  if (options?.baslangic || options?.bitis) {
    const createdAt: Record<string, Date> = {}
    if (options.baslangic) createdAt.gte = new Date(options.baslangic + 'T00:00:00')
    if (options.bitis) createdAt.lte = new Date(options.bitis + 'T23:59:59')
    where.createdAt = createdAt
  }
  const hareketler = await prisma.envanterStokHareket.findMany({
    where,
    include: {
      urun: { select: { id: true, kod: true, ad: true, kategori: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  type IcGrup = {
    personelAd: string
    bolum: string
    toplamMiktar: number
    islemSayisi: number
    sonTarih: string
    urunMap: Map<string, PersonelRaporuDetaySatiri>
  }
  const personelMap = new Map<string, IcGrup>()
  const bolumSet = new Set<string>()
  let toplamCikis = 0
  for (const h of hareketler) {
    if (!h.alanPersonelId && !h.alanPersonelAd) continue
    toplamCikis += h.miktar
    const bolum = h.bolum || '(Belirtilmemiş)'
    const kisi = h.alanPersonelAd || '(Belirtilmemiş)'
    const kategori = h.urun?.kategori || '(Kategorisiz)'
    const urunAdi = h.urun?.ad || ''
    const urunKodu = h.urun?.kod || ''
    if (h.bolum) bolumSet.add(h.bolum)
    const personelKey = h.alanPersonelId || `ad::${kisi}`
    const tarihIso = h.createdAt.toISOString().slice(0, 10)
    let grup = personelMap.get(personelKey)
    if (!grup) {
      grup = { personelAd: kisi, bolum, toplamMiktar: 0, islemSayisi: 0, sonTarih: tarihIso, urunMap: new Map() }
      personelMap.set(personelKey, grup)
    }
    grup.toplamMiktar += h.miktar
    grup.islemSayisi += 1
    if (tarihIso > grup.sonTarih) grup.sonTarih = tarihIso
    const mevcutUrun = grup.urunMap.get(h.urunId)
    if (!mevcutUrun) {
      grup.urunMap.set(h.urunId, { urunKodu, urunAdi, kategori, miktar: h.miktar, islemSayisi: 1, sonTarih: tarihIso })
    } else {
      mevcutUrun.miktar += h.miktar
      mevcutUrun.islemSayisi += 1
      if (tarihIso > mevcutUrun.sonTarih) mevcutUrun.sonTarih = tarihIso
    }
  }
  const satirlar: PersonelRaporuSatiri[] = Array.from(personelMap.entries()).map(([key, g]) => ({
    personelId: key.startsWith('ad::') ? null : key,
    personelAd: g.personelAd,
    bolum: g.bolum,
    toplamMiktar: g.toplamMiktar,
    islemSayisi: g.islemSayisi,
    urunSayisi: g.urunMap.size,
    sonTarih: g.sonTarih,
    detaylar: Array.from(g.urunMap.values()).sort((a, b) => b.miktar - a.miktar),
  })).sort((a, b) => b.toplamMiktar - a.toplamMiktar)
  return {
    satirlar,
    bolumler: Array.from(bolumSet).sort((a, b) => a.localeCompare(b, 'tr')),
    toplamCikis,
  }
}

export type SarfTuketimSonuc = {
  satirlar: SarfTuketimSatiri[]
  bolumler: string[]
  kategoriler: string[]
  toplamCikis: number
}

export async function getSarfTuketim(options?: {
  baslangic?: string
  bitis?: string
}): Promise<SarfTuketimSonuc> {
  const where: Record<string, unknown> = { hareketTipi: 'CIKIS' }
  if (options?.baslangic || options?.bitis) {
    const createdAt: Record<string, Date> = {}
    if (options.baslangic) createdAt.gte = new Date(options.baslangic + 'T00:00:00')
    if (options.bitis) createdAt.lte = new Date(options.bitis + 'T23:59:59')
    where.createdAt = createdAt
  }

  const hareketler = await prisma.envanterStokHareket.findMany({
    where,
    include: {
      urun: { select: { id: true, kod: true, ad: true, kategori: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Gruplama anahtarı: urun + bolum + kisi
  const grup = new Map<string, SarfTuketimSatiri>()
  const bolumSet = new Set<string>()
  const kategoriSet = new Set<string>()
  let toplamCikis = 0

  for (const h of hareketler) {
    toplamCikis += h.miktar
    const bolum = h.bolum || '(Belirtilmemiş)'
    const kisi = h.alanPersonelAd || '(Belirtilmemiş)'
    const kategori = h.urun?.kategori || '(Kategorisiz)'
    if (h.bolum) bolumSet.add(h.bolum)
    if (kategori) kategoriSet.add(kategori)

    const key = `${h.urunId}::${bolum}::${kisi}`
    const mevcut = grup.get(key)
    const tarihIso = h.createdAt.toISOString().slice(0, 10)
    if (!mevcut) {
      grup.set(key, {
        urunId: h.urunId,
        urunKodu: h.urun?.kod || '',
        urunAdi: h.urun?.ad || '',
        kategori,
        bolum,
        alanPersonelAd: kisi,
        toplamMiktar: h.miktar,
        islemSayisi: 1,
        sonTarih: tarihIso,
      })
    } else {
      mevcut.toplamMiktar += h.miktar
      mevcut.islemSayisi += 1
      if (tarihIso > mevcut.sonTarih) mevcut.sonTarih = tarihIso
    }
  }

  const satirlar = Array.from(grup.values()).sort(
    (a, b) => b.toplamMiktar - a.toplamMiktar,
  )

  return {
    satirlar,
    bolumler: Array.from(bolumSet).sort((a, b) => a.localeCompare(b, 'tr')),
    kategoriler: Array.from(kategoriSet).sort((a, b) => a.localeCompare(b, 'tr')),
    toplamCikis,
  }
}

export type IslemKaydiSatiri = {
  id: string
  aktorId: string | null
  aktorAd: string
  islemTipi: string
  hedefTip: string
  hedefId: string | null
  detay: unknown
  createdAt: string
}

export type IslemKaydiSonuc = {
  satirlar: IslemKaydiSatiri[]
  islemTipleri: string[]
  hedefTipleri: string[]
  toplamKayit: number
}

export async function getIslemKaydi(options?: {
  baslangic?: string
  bitis?: string
  islemTipi?: string
  hedefTip?: string
  limit?: number
}): Promise<IslemKaydiSonuc> {
  const where: Record<string, unknown> = {}
  if (options?.baslangic || options?.bitis) {
    where.createdAt = {
      ...(options?.baslangic ? { gte: new Date(options.baslangic) } : {}),
      ...(options?.bitis ? { lte: new Date(options.bitis + 'T23:59:59') } : {}),
    }
  }
  if (options?.islemTipi) where.islemTipi = options.islemTipi
  if (options?.hedefTip) where.hedefTip = options.hedefTip

  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 1000) : 200

  const [loglar, toplamKayit, islemTipiGruplari, hedefTipGruplari] = await Promise.all([
    prisma.envanterIslemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.envanterIslemLog.count({ where }),
    prisma.envanterIslemLog.groupBy({ by: ['islemTipi'] }),
    prisma.envanterIslemLog.groupBy({ by: ['hedefTip'] }),
  ])

  const aktorIdler = Array.from(
    new Set(loglar.map((l) => l.aktorId).filter((id): id is string => !!id))
  )
  const aktorler = aktorIdler.length
    ? await prisma.user.findMany({
        where: { id: { in: aktorIdler } },
        select: { id: true, name: true, email: true },
      })
    : []
  const aktorMap = new Map(aktorler.map((a) => [a.id, a.name || a.email]))

  const satirlar: IslemKaydiSatiri[] = loglar.map((l) => ({
    id: l.id,
    aktorId: l.aktorId,
    aktorAd: (l.aktorId ? aktorMap.get(l.aktorId) : undefined) || l.aktorAd || l.aktorId || 'Sistem',
    islemTipi: l.islemTipi,
    hedefTip: l.hedefTip,
    hedefId: l.hedefId,
    detay: l.detay,
    createdAt: l.createdAt.toISOString(),
  }))

  return {
    satirlar,
    islemTipleri: islemTipiGruplari.map((g) => g.islemTipi).sort(),
    hedefTipleri: hedefTipGruplari.map((g) => g.hedefTip).sort(),
    toplamKayit,
  }
}
