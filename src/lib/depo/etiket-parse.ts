// Depo etiket okuma — barkod/DataMatrix ham metnini yorumlar.
//
// KURAL: girdinin İÇERİĞİNE değil, GELİŞ YOLUNA (kaynak) bakılır — çünkü çıplak sayı hem
// geçerli barkod ID hem geçerli iş emri no olabilir. Kaynak ayrımı bu çakışmayı çözer.
//
// OKUTMA (kamera/scanner):
//   1. B:{id}|...                      → barkod_id  (bizim etiketlerimiz; B: öncelik, P:/T: yedek)
//   2. P:/T:/Q:/S: segmentleri         → yerel kimlik (ILERIHub etiketleri)
//   3. Çıplak sayı ("133")             → barkod_id  (Aurena etiketleri) — İŞ EMRİ DENENMEZ
//   4. STOKKODU|LOT / düz metin        → yerel (geriye dönük)
//
// ELLE ("veya elle gir" alanı):
//   • BARKOD ASLA DENENMEZ. Değer daima 'yerel' döner (stokKodu[+lot]).
//   • Kısa sayı → iş emri / uzun-alfanumerik → stok kodu ayrımını ÇAĞIRAN yapar
//     (önce iş emri dener, olmazsa stok kodu). parseEtiket yalnız 'yerel' üretir.
//
// Barkod_id ÇÖZÜMÜ sunucuda (IFS) yapılır; bu fonksiyon yalnız SINIFLANDIRIR (senkron).
// Raf kodları adım bağlamıyla ayrıca çözülür (parseEtiket raf çözmez).

export type EtiketKaynak = 'okutma' | 'elle'
export type EtiketTip = 'barkodId' | 'yerel'

export interface EtiketParse {
  tip: EtiketTip
  /** tip='barkodId' → çözülecek IFS barkod ID'si (yalnız kaynak='okutma'da olabilir). */
  barkodId?: number
  /** yerel kimlik alanları (ayrıca barkodId sonuçlarında yedek olarak dolabilir). */
  stokKodu?: string
  lot?: string
  miktar?: number
  etiketNo?: string
}

/** Salt-sayısal okuma → pozitif tamsayı adayı. Değilse null. */
export function barkodIdAday(ham: string): number | null {
  const s = (ham ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** STOKKODU|LOT ya da düz metin → yerel kimlik (barkod DENENMEZ). Okutma'nın son adımı + tüm elle. */
function yerelCoz(s: string): EtiketParse {
  if (s.includes('|')) {
    const [stokKodu, lot] = s.split('|')
    if (stokKodu.trim()) return { tip: 'yerel', stokKodu: stokKodu.trim(), lot: lot?.trim() || undefined }
    return { tip: 'yerel' }
  }
  return { tip: 'yerel', stokKodu: s }
}

export function parseEtiket(ham: string, kaynak: EtiketKaynak = 'okutma'): EtiketParse {
  const s = (ham ?? '').trim()
  if (!s) return { tip: 'yerel' }

  // ELLE: barkod asla denenmez → daima yerel.
  if (kaynak === 'elle') return yerelCoz(s)

  // OKUTMA:
  // 1/2. Segment formatı (B:/P:/T:/Q:/S:)
  if (/(^|\|)[BPTQS]:/i.test(s)) {
    const seg: Record<string, string> = {}
    for (const part of s.split('|')) {
      const i = part.indexOf(':')
      if (i > 0) seg[part.slice(0, i).trim().toUpperCase()] = part.slice(i + 1).trim()
    }
    const q = Number(seg.Q)
    const yerel: EtiketParse = {
      tip: 'yerel',
      stokKodu: seg.P || undefined,
      lot: seg.T && seg.T !== '*' ? seg.T : undefined,
      miktar: seg.Q !== undefined && seg.Q !== '' && Number.isFinite(q) ? q : undefined,
      etiketNo: seg.S || undefined,
    }
    const bid = seg.B ? barkodIdAday(seg.B) : null
    if (bid != null) return { ...yerel, tip: 'barkodId', barkodId: bid } // B: öncelik, P:/T: yedek
    if (yerel.stokKodu) return yerel
    // ne geçerli B ne P → aşağı düş
  }

  // 3. Çıplak sayı → barkod_id (Aurena; iş emri DENENMEZ)
  const bare = barkodIdAday(s)
  if (bare != null) return { tip: 'barkodId', barkodId: bare }

  // 4. STOKKODU|LOT / düz metin → yerel
  return yerelCoz(s)
}
