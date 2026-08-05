import { prisma } from '@/lib/prisma'

export type MaliyetSatiri = {
  urunId: string
  urunKodu: string
  urunAdi: string
  kategori: string
  varyantAdi: string | null
  paraBirimi: string
  birimMaliyet: number
  cikisAdet: number
  cikisMaliyet: number
  girisAdet: number
  girisMaliyet: number
}

export type MaliyetOzet = { paraBirimi: string; toplamCikis: number; toplamGiris: number }

export type MaliyetRaporuSonuc = {
  satirlar: MaliyetSatiri[]
  ozetler: MaliyetOzet[]
  kategoriler: string[]
}

export async function getMaliyetRaporu(options?: {
  baslangic?: string
  bitis?: string
}): Promise<MaliyetRaporuSonuc> {
  const where: Record<string, unknown> = { hareketTipi: { in: ['GIRIS', 'CIKIS'] } }
  if (options?.baslangic || options?.bitis) {
    const createdAt: Record<string, Date> = {}
    if (options.baslangic) createdAt.gte = new Date(options.baslangic + 'T00:00:00')
    if (options.bitis) createdAt.lte = new Date(options.bitis + 'T23:59:59')
    where.createdAt = createdAt
  }

  const hareketler = await prisma.envanterStokHareket.findMany({
    where,
    include: { urun: { select: { id: true, kod: true, ad: true, kategori: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Maliyet önbelleği: urunId+varyantId -> {birimMaliyet, paraBirimi}
  const maliyetCache = new Map<string, { birimMaliyet: number; paraBirimi: string }>()
  async function getMaliyet(urunId: string, varyantId: string | null) {
    const key = `${urunId}::${varyantId ?? ''}`
    if (maliyetCache.has(key)) return maliyetCache.get(key)!
    const stok = await prisma.envanterStok.findFirst({ where: { urunId, varyantId } })
    const val = {
      birimMaliyet: stok?.birimMaliyet ?? 0,
      paraBirimi: stok?.paraBirimi ?? 'TL',
    }
    maliyetCache.set(key, val)
    return val
  }

  const grup = new Map<string, MaliyetSatiri>()
  const kategoriSet = new Set<string>()

  for (const h of hareketler) {
    const m = await getMaliyet(h.urunId, h.varyantId)
    const kategori = h.urun?.kategori || '(Kategorisiz)'
    if (kategori) kategoriSet.add(kategori)
    const key = `${h.urunId}::${h.varyantId ?? ''}`
    let satir = grup.get(key)
    if (!satir) {
      // varyant adını bul
      let varyantAdi: string | null = null
      if (h.varyantId) {
        const v = await prisma.envanterUrunVaryant.findUnique({ where: { id: h.varyantId }, select: { varyantAdi: true } })
        varyantAdi = v?.varyantAdi ?? null
      }
      satir = {
        urunId: h.urunId,
        urunKodu: h.urun?.kod || '',
        urunAdi: h.urun?.ad || '',
        kategori,
        varyantAdi,
        paraBirimi: m.paraBirimi,
        birimMaliyet: m.birimMaliyet,
        cikisAdet: 0,
        cikisMaliyet: 0,
        girisAdet: 0,
        girisMaliyet: 0,
      }
      grup.set(key, satir)
    }
    const tutar = h.miktar * m.birimMaliyet
    if (h.hareketTipi === 'CIKIS') {
      satir.cikisAdet += h.miktar
      satir.cikisMaliyet += tutar
    } else if (h.hareketTipi === 'GIRIS') {
      satir.girisAdet += h.miktar
      satir.girisMaliyet += tutar
    }
  }

  const satirlar = Array.from(grup.values()).sort((a, b) => b.cikisMaliyet - a.cikisMaliyet)

  // Para birimine göre özet
  const ozetMap = new Map<string, MaliyetOzet>()
  for (const s of satirlar) {
    const o = ozetMap.get(s.paraBirimi) ?? { paraBirimi: s.paraBirimi, toplamCikis: 0, toplamGiris: 0 }
    o.toplamCikis += s.cikisMaliyet
    o.toplamGiris += s.girisMaliyet
    ozetMap.set(s.paraBirimi, o)
  }

  return {
    satirlar,
    ozetler: Array.from(ozetMap.values()),
    kategoriler: Array.from(kategoriSet).sort((a, b) => a.localeCompare(b, 'tr')),
  }
}
