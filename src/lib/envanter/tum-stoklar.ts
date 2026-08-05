import { prisma } from '@/lib/prisma'

export type TumStokSatiri = {
  stokId: string
  urunId: string
  urunKodu: string
  urunAdi: string
  kategori: string
  varyantAdi: string | null
  mevcut: number
  minStok: number | null
  kritikStok: number | null
  depo: string | null
  durum: string
}

export async function getTumStoklar(): Promise<TumStokSatiri[]> {
  const stoklar = await prisma.envanterStok.findMany({
    include: {
      urun: { select: { id: true, kod: true, ad: true, kategori: true } },
      varyant: { select: { varyantAdi: true } },
    },
    orderBy: [{ urun: { kod: 'asc' } }],
  })

  return stoklar.map((s) => ({
    stokId: s.id,
    urunId: s.urunId,
    urunKodu: s.urun.kod,
    urunAdi: s.urun.ad,
    kategori: s.urun.kategori ?? '',
    varyantAdi: s.varyant?.varyantAdi ?? null,
    mevcut: s.mevcut,
    minStok: s.minStok,
    kritikStok: s.kritikStok,
    depo: s.depo,
    durum: s.durum,
  }))
}
