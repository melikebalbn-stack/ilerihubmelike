/**
 * IFS OData yazma hatalarını kullanıcıya dostane, tek satırlık mesaja indirger.
 * Ham gövde (JSON / ORA yığını) sunucu console'una yazılır; UI'a yalnız sadeleşmiş
 * mesaj döner. Bilinen ORA kodları Türkçe karşılığa map'lenir.
 */

// Bilinen IFS/Oracle hata kodları → Türkçe karşılık. Zamanla genişletilecek.
const ORA_TR: Record<string, string> = {
  'ORA-20110': 'Seçilen rafta yeterli miktar yok',
}

function temizle(s: string): string {
  const d = s.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\s+/g, ' ').trim()
  return d.length > 180 ? `${d.slice(0, 177)}…` : d
}

/**
 * @param raw lib write fonksiyonlarından dönen ham hata metni (ör. "... HTTP 500: {json}")
 * @param fallback hiçbir şey ayıklanamazsa gösterilecek genel mesaj
 */
export function dostaneIfsHata(raw: string, fallback = 'İşlem başarısız (IFS)'): string {
  if (!raw) return fallback
  console.error('[IFS ham hata]', raw)

  // 1) Bilinen ORA kodu → Türkçe
  const ora = raw.match(/ORA-\d{4,5}/)?.[0]
  if (ora && ORA_TR[ora]) return ORA_TR[ora]

  // 2) JSON details[0].message / error.message
  const jsonStart = raw.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const obj = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string; details?: { message?: string }[] }
      }
      const detay = obj?.error?.details?.[0]?.message ?? obj?.error?.message
      if (typeof detay === 'string' && detay.trim()) return temizle(detay)
    } catch {
      /* truncated JSON → regex fallback */
    }
  }

  // 3) Regex fallback: son "message":"..." (details mesajı genelde sonda)
  const msgs = [...raw.matchAll(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  if (msgs.length) return temizle(msgs[msgs.length - 1])

  // 4) ORA kodu var ama map yok → kod + fallback
  if (ora) return `${ora} — ${fallback}`
  return fallback
}
