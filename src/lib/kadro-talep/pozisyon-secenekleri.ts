// Kadro (personel) talebi — "Pozisyon Adı" seçenekleri: bir bölümün org ağacındaki
// POZİSYON UNVANLARI (07.10.2026).
//
// Bölüm değişikliği talebindeki `gorev-secenekleri` ucundan AYRILDIĞI yer: orada
// yalnız BOŞ kutular listelenir (koltuk taşınacağı için boş kutu şart). Kadro
// talebinde kadro HENÜZ YOK — dolu/boş ayrımı bilgi taşımaz, bu yüzden unvanlar
// tekilleştirilerek verilir (Melih kararı: "unvan listesi yeter").
//
// Kurul/komite kutuları (ORG-KR-*) listelenmez: ek görev, ana kadro değil.
//
// Saf modül — DB'ye GİTMEZ. Birim listesi çağıran uç tarafından tek sorguda okunur.

export type OrgBirim = {
  id: string
  code: string
  name: string
  parentId: string | null
}

export type PozisyonSecenek = {
  /** Unvan (PersonnelRequest.title'a yazılacak metin). */
  ad: string
  /** Temsilci kutu kodu. Aynı unvanda birden çok kutu varsa EN KÜÇÜK kod (kararlı seçim). */
  kod: string
}

/**
 * `kokId` dahil tüm alt ağacın birim id'leri. Bozuk veride döngü olursa (parentId
 * halkası) sonsuz dönmez — ziyaret edilen id bir kez işlenir.
 */
export function altAgacIdleri(birimler: OrgBirim[], kokId: string): Set<string> {
  const cocuklar = new Map<string, string[]>()
  for (const b of birimler) {
    if (!b.parentId) continue
    const liste = cocuklar.get(b.parentId)
    if (liste) liste.push(b.id)
    else cocuklar.set(b.parentId, [b.id])
  }
  const idler = new Set<string>()
  const yigin = [kokId]
  while (yigin.length) {
    const id = yigin.pop()!
    if (idler.has(id)) continue
    idler.add(id)
    for (const c of cocuklar.get(id) ?? []) yigin.push(c)
  }
  return idler
}

/**
 * Bölümün (kokOrgUnitId) alt ağacındaki TEKİL pozisyon unvanları, tr-TR'ye göre
 * sıralı. Aynı unvanda birden çok kutu varsa tek satır döner, kodu en küçük kutunun
 * kodudur (org koltuk seçiminde kullanılan "en küçük code" kuralıyla aynı).
 */
export function pozisyonUnvanlari(birimler: OrgBirim[], kokOrgUnitId: string): PozisyonSecenek[] {
  const idler = altAgacIdleri(birimler, kokOrgUnitId)
  const enKucukKod = new Map<string, string>()
  for (const b of birimler) {
    if (!idler.has(b.id)) continue
    if (b.code.startsWith('ORG-KR-')) continue
    const ad = b.name.trim()
    if (!ad) continue
    const mevcut = enKucukKod.get(ad)
    if (mevcut === undefined || b.code.localeCompare(mevcut) < 0) enKucukKod.set(ad, b.code)
  }
  return [...enKucukKod.entries()]
    .map(([ad, kod]) => ({ ad, kod }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
}
