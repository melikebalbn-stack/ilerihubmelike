// Depo etiket okuma — barkod/DataMatrix ham metnini yorumlar.
//
// ⚠️ MOCK KURALLAR: Ayrıştırma geçicidir. Gerçek IFS DataMatrix formatı (GS1 AI'ları /
// IFS raf & lot kodlama şeması) netleşince güncellenecek.
//
// EL-3b: Raf kodları artık ADIM BAĞLAMIYLA yorumlanır (KAYNAK_RAF/HEDEF_RAF adımında
// okunan kod doğrudan API'ye raf olarak sorulur) — 'RF' ön-ek varsayımı KALDIRILDI.
// parseEtiket yalnız MALZEME etiketini çözer: 'STOKKODU|LOT' → lotlu; aksi halde tüm
// metin stok kodu (lotsuz). Geçerlilik, rafın gerçek stok listesiyle eşleştirilerek
// belirlenir (bu yüzden katı format kısıtı yok).

export type EtiketTip = 'MALZEME' | 'BILINMEYEN'

export interface EtiketParse {
  tip: EtiketTip
  stokKodu?: string
  lot?: string
}

export function parseEtiket(ham: string): EtiketParse {
  const s = (ham ?? '').trim()
  if (!s) return { tip: 'BILINMEYEN' }

  // 'STOKKODU|LOT' formatı.
  if (s.includes('|')) {
    const [stokKodu, lot] = s.split('|')
    if (stokKodu.trim()) {
      return { tip: 'MALZEME', stokKodu: stokKodu.trim(), lot: lot?.trim() ? lot.trim() : undefined }
    }
    return { tip: 'BILINMEYEN' }
  }

  // Lotsuz — tüm metin stok kodu (geçerlilik raf stoğuyla eşleştirilir).
  return { tip: 'MALZEME', stokKodu: s }
}

/**
 * Salt-sayısal okuma → IFS barkod_id adayı (pozitif tamsayı). Değilse null.
 * Kural (EL-9b): sayısal değer önce barkod_id olarak çözülmeye çalışılır; çözülmezse
 * çağıran mevcut davranışa düşer (raf/partNo yorumu). 'STOKKODU|LOT' iç formatı korunur.
 */
export function barkodIdAday(ham: string): number | null {
  const s = (ham ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
