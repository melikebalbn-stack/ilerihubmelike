// IPRO çalışma takvimi — SAF yardımcılar (prisma YOK → client + server + test paylaşır).
// Pazar otomatik türetme, tip/saat validation. Melike #5.

export const IPRO_TATIL_TIPLERI = ['TATIL', 'YARIM', 'MESAI'] as const
export type IproTatilTip = (typeof IPRO_TATIL_TIPLERI)[number]

export function gecerliTatilTip(v: unknown): v is IproTatilTip {
  return typeof v === 'string' && (IPRO_TATIL_TIPLERI as readonly string[]).includes(v)
}

const SAAT_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export function gecerliSaat(v: unknown): v is string {
  return typeof v === 'string' && SAAT_RE.test(v)
}

/** UTC gün anahtarı 'YYYY-MM-DD' — @db.Date ile tutarlı (TZ kayması yok). */
export function tarihAnahtari(tarih: Date): string {
  return tarih.toISOString().slice(0, 10)
}

/** Pazar OTOMATİK tatildir — tabloda TUTULMAZ, burada türetilir (UTC gün 0). */
export function pazarMi(tarih: Date): boolean {
  return tarih.getUTCDay() === 0
}

export type GunDurum = 'TATIL' | 'YARIM' | 'MESAI' | 'CALISMA'

/**
 * Bir günün çalışma durumu. Önce İSTİSNA kaydı (tatilMap 'YYYY-MM-DD'→tip), yoksa Pazar
 * türetmesi, yoksa normal çalışma. MESAI istisnası Pazar'ı bile çalışmaya çevirir (kayıt ezer).
 */
export function gunDurumu(tarih: Date, tatilMap: Map<string, IproTatilTip>): GunDurum {
  const istisna = tatilMap.get(tarihAnahtari(tarih))
  if (istisna) return istisna
  if (pazarMi(tarih)) return 'TATIL'
  return 'CALISMA'
}

/** Prototip renk kodları (pano/takvim tutarlılığı). */
export const TATIL_RENK: Record<GunDurum, string> = {
  TATIL: '#c0454a',
  YARIM: '#d99b3c',
  MESAI: '#2f8f5b',
  CALISMA: 'transparent',
}
