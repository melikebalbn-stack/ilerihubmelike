import { prisma } from '@/lib/prisma'

export interface KatalogDeger { deger: string; etiket: string | null; kaynak: string }

/**
 * rapor_katalog_deger okuma yardımcıları. Tablo henüz migrate edilmemişse (P2021) BOŞ döner —
 * katalog ekranı ve rapor çalıştırma çalışmaya devam eder.
 */
export const tabloYok = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2021'

export async function alanDegerleri(kaynakAd: string, entity: string, alan: string): Promise<KatalogDeger[]> {
  try {
    return await prisma.raporKatalogDeger.findMany({ where: { kaynakAd, entity, alan }, select: { deger: true, etiket: true, kaynak: true }, orderBy: { deger: 'asc' } })
  } catch (e) { if (tabloYok(e)) return []; throw e }
}

/**
 * Bir projeksiyonun (kaynakAd) alan adlarına göre etiket haritası: alan → { ham değer → etiket }.
 * ENTITY'ye bakılmaz: veri seti kaynağı EntitySet adını tutar, EntityType'ı değil (veri-seti-alanlar.ts
 * ile aynı varsayım). Aynı alan adı iki entity'de farklı etiketlenmişse son okunan kazanır.
 */
export async function projeksiyonDegerEtiketleri(kaynakAd: string): Promise<Record<string, Record<string, string>>> {
  try {
    const satirlar = await prisma.raporKatalogDeger.findMany({ where: { kaynakAd, etiket: { not: null } }, select: { alan: true, deger: true, etiket: true } })
    const out: Record<string, Record<string, string>> = {}
    for (const s of satirlar) if (s.etiket) (out[s.alan] ??= {})[s.deger] = s.etiket
    return out
  } catch (e) { if (tabloYok(e)) return {}; throw e }
}
