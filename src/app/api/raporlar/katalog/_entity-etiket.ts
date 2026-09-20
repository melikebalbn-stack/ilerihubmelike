import { prisma } from '@/lib/prisma'

/**
 * rapor_katalog_entity → "kaynakAd|entity" → {etiket, aciklama}. Tablo henüz migrate edilmemişse
 * (P2021) boş döner ki katalog ekranı çalışmaya devam etsin.
 */
export async function entityEtiketleri(kaynakAd?: string): Promise<Map<string, { etiket: string | null; aciklama: string | null }>> {
  try {
    const l = await prisma.raporKatalogEntity.findMany({ where: kaynakAd ? { kaynakAd } : {}, select: { kaynakAd: true, entity: true, etiket: true, aciklama: true } })
    return new Map(l.map((e) => [`${e.kaynakAd}|${e.entity}`, { etiket: e.etiket, aciklama: e.aciklama }]))
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2021') return new Map()
    throw e
  }
}
