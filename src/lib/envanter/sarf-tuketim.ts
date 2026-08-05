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
